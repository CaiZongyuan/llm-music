"""Persist first, submit once, and complete only after an owned result import."""

from datetime import datetime, timedelta, timezone
from dataclasses import replace
from copy import deepcopy
import logging
import hashlib
import math
from queue import Empty, Queue
import threading
import time
from typing import Callable, cast
from uuid import UUID, uuid4

from sqlalchemy.dialects.sqlite import insert
from sqlalchemy import select, update

from music_api.config import Settings
from music_api.database import Asset, Database, utc_now
from music_api.errors import DomainError
from music_api.job_models import Job, Namespace, job_for_write
from music_api.result_import import ImportMaterial, ResultRegistrar
from music_api.result_import import import_result
from music_api.midi_validation import note_count
from music_api.runtime_types import InferenceRuntime, JobState, Operation, RuntimeArtifact, RuntimeRequest, RuntimeResult, RuntimeStatus
from music_api.schemas import JobRead
from music_api.storage import Storage
from music_api.workflow_registry import WorkflowRegistry
from music_api.runtime_errors import failure_detail


log = logging.getLogger("music_api")
ResultValidator = Callable[[RuntimeResult], tuple[ImportMaterial, ...]]
SubscriptionFactory = Callable[[str, Operation, Callable[[RuntimeStatus], None]], Callable[[], None]]
OPERATION_PHASES: dict[Operation, tuple[str, ...]] = {
    "Transcribe": ("loading_model", "transcribing"),
    "Generate": ("loading_model", "planning_score", "generating_semantic", "synthesizing", "decoding_audio"),
}


def measured_progress(value: float | None) -> float | None:
    return float(value) if isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1 else None


def mark_cancelled(job: Job) -> None:
    """Only the transaction owner commits this confirmed terminal state."""
    job.status, job.phase, job.progress = "cancelled", None, None
    job.error = dict(code="cancelled", message="This Job was cancelled.", recovery="Explicitly create a new Job to repeat the operation.")
    job.updated_at = utc_now()


def validate_score(result: RuntimeResult) -> RuntimeArtifact:
    if len([item for item in result.artifacts if item.role == "abc"]) != 1:
        raise DomainError(503, "result_invalid", "Required ABC output is missing or duplicated.", "Retain the Job evidence and inspect the Runtime output.")
    abc = next(item for item in result.artifacts if item.role == "abc")
    try:
        text = abc.data.decode("utf-8")
        validation = result.score_validation
        count = validation.get("note_count") if validation is not None else None
        if abc.format != "abc" or not text.strip() or "X:" not in text or "K:" not in text or validation is None or validation.get("valid") is not True or type(count) is not int or count <= 0:
            raise ValueError("ABC has no complete validated Score")
    except (UnicodeDecodeError, ValueError) as error:
        raise DomainError(503, "result_invalid", "ABC output has no complete validated Score.", "Retain the Job inputs and output validation evidence.") from error
    return abc


def validate_transcription(result: RuntimeResult) -> tuple[ImportMaterial, ...]:
    for role in ("abc", "midi"):
        if len([item for item in result.artifacts if item.role == role]) != 1:
            raise DomainError(503, "transcription_failed", "Required " + role.upper() + " output is missing or duplicated.", "Retain the Job evidence and inspect the Runtime output; do not silently rerun inference.")
    abc = validate_score(result)
    midi = next(item for item in result.artifacts if item.role == "midi")
    try:
        if midi.format != "mid":
            raise ValueError("MIDI format differs")
        note_count(midi.data)
    except (UnicodeDecodeError, ValueError) as error:
        raise DomainError(503, "transcription_failed", "ABC/MIDI output is invalid or incomplete.", "Retain the Job inputs and inspect its output validation evidence.") from error
    return tuple(ImportMaterial(item.role, item.data, item.format, item.media_type, item.name) for item in (abc, midi))


class JobService:
    def __init__(self, database: Database, storage: Storage, runtime: InferenceRuntime, registry: WorkflowRegistry, settings: Settings) -> None:
        self.database, self.storage, self.runtime, self.registry, self.settings = database, storage, runtime, registry, settings
        self.pending: Queue[str] = Queue()
        self.stop_event = threading.Event()
        self.thread = threading.Thread(target=self._run, daemon=True, name="application-jobs")
        self.registrars: dict[Operation, ResultRegistrar] = {}
        self.validators: dict[Operation, ResultValidator] = {"Transcribe": validate_transcription}
        self.transition_lock = threading.RLock()
        self.on_change: Callable[[JobRead], None] | None = None
        self.subscription_factory: SubscriptionFactory | None = None
        self.recovery_ids: set[str] = set()

    def notify(self, identifier: str) -> None:
        """Observers receive committed public state and cannot change Job outcomes."""
        if self.on_change is None:
            return
        try:
            with self.database.sessions() as session:
                job = session.get(Job, identifier)
                if job is not None:
                    self.on_change(job_read(job))
        except Exception:
            log.exception("Job observer unavailable", extra={"event": "job_observer_failed", "job_id": identifier})

    def cancel(self, project_id: UUID, identifier: UUID) -> Job:
        with self.transition_lock:
            with self.database.sessions() as session:
                job = job_for_write(session, str(identifier), str(project_id))
                if job is None:
                    raise DomainError(404, "job_not_found", "Job does not exist in this Project.", "Query its owning Project.")
                if job.status in {"completed", "failed", "cancelled"}:
                    return job
                if not job.cancel_requested:
                    job.cancel_requested = True
                    job.updated_at = utc_now()
                try:
                    session.commit()
                except Exception as error:
                    log.exception("Cancellation intent acknowledgement unconfirmed", extra={"event": "job_cancel_intent_unconfirmed", "job_id": str(identifier)})
                    self.notify(str(identifier))
                    raise DomainError(503, "cancellation_unconfirmed", "The cancellation intent could not be confirmed.",
                                      "Query this Job and explicitly repeat cancellation if still needed; intent alone is not dispatch proof.", identifier) from error
                state, handle = job.submission_state, job.runtime_handle
            # The SQLite writer is released during bounded native HTTP work.
            # Intent never substitutes for this request's ownership-checked dispatch.
            if state == "pending":
                observed = RuntimeStatus("cancelled")
            elif handle is not None:
                try:
                    observed = self.runtime.cancel(handle)
                except Exception:
                    log.exception("Runtime cancellation outcome unconfirmed", extra={"event": "job_cancellation_unconfirmed", "job_id": str(identifier),
                                  "runtime_handle": handle})
                    observed = RuntimeStatus("unconfirmed", code="runtime_unavailable")
            else:
                observed = RuntimeStatus("unconfirmed", code="cancellation_unconfirmed")
            failure = None
            with self.database.sessions() as session:
                job = job_for_write(session, str(identifier), str(project_id))
                assert job is not None
                if job.status in {"completed", "failed", "cancelled"}:
                    return job
                if observed.code == "cancellation_not_dispatched":
                    job.cancel_requested = False
                    job.error = dict(code="cancellation_not_dispatched", message="This cancellation did not reach its active target.",
                                     recovery="Read the current Job and explicitly request cancellation again if needed.")
                    job.updated_at = utc_now()
                    failure = DomainError(409, "cancellation_not_dispatched", "The target changed state before cancellation was confirmed.",
                                          "Read the current Job and explicitly request cancellation again if needed.", identifier)
                elif observed.state == "cancelled":
                    mark_cancelled(job)
                elif observed.state == "unconfirmed":
                    code = observed.code if observed.code in {"cancellation_ownership_unverified", "runtime_unavailable"} else "cancellation_unconfirmed"
                    if code == "cancellation_ownership_unverified":
                        job.cancel_requested = False
                    job.error = dict(code=code, message="The cancellation target or outcome is unconfirmed.",
                                     recovery="Retain this Job and inspect its owned Runtime mapping before any new attempt.")
                    job.updated_at = utc_now()
                    failure = DomainError(503 if code == "runtime_unavailable" else 409, code, "Cancellation is unconfirmed.",
                                          "Retain this Job and inspect the Runtime before any new attempt.", identifier)
                session.commit()
        self.notify(job.id)
        if failure is not None:
            raise failure
        return job

    def retry(self, project_id: UUID, identifier: UUID) -> Job:
        with self.transition_lock:
            with self.database.sessions() as session:
                job = session.scalar(select(Job).where(Job.id == str(identifier), Job.project_id == str(project_id)))
                if job is None:
                    raise DomainError(404, "job_not_found", "Job does not exist in this Project.", "Query its owning Project.")
                if job.status not in {"failed", "cancelled"}:
                    raise DomainError(409, "job_not_retryable", "Only a failed or cancelled Job can be explicitly retried.",
                                      "Retain the current Job and wait for its confirmed outcome.", identifier)
                operation = cast(Operation, job.operation)
                inputs = deepcopy(job.inputs)
                safe = job.status == "cancelled" and job.submission_state in {"pending", "accepted"} or job.submission_state == "rejected"
                if not safe:
                    try:
                        original = RuntimeRequest(UUID(job.attempt_id),operation,inputs,proof=job.runtime_proof,runtime_handle=job.runtime_handle)
                        recovered = self.runtime.recover(original)
                        handle = recovered.handle if recovered.outcome == "accepted" else None
                        observed = recovered.status or (self.runtime.status(handle) if handle is not None else RuntimeStatus("unconfirmed"))
                        safe = observed.state in {"completed", "failed", "cancelled"}
                    except Exception:
                        log.exception("Retry ownership confirmation unavailable", extra={"event": "job_retry_unconfirmed", "job_id": job.id})
                if not safe:
                    raise DomainError(409, "retry_unconfirmed", "The original native attempt has no confirmed safe terminal outcome.",
                                      "Retain this Job and confirm the owned Runtime attempt before explicitly retrying.", identifier)
            # Never write the original Job. New submission rechecks current readiness
            # and records current registry evidence with a fresh application/attempt id.
            return self.submit(project_id, operation, inputs, retry_of_job_id=str(identifier))

    def register_result(self, operation: Operation, registrar: ResultRegistrar, validator: ResultValidator | None = None) -> None:
        self.registrars[operation] = registrar
        if validator is not None:
            self.validators[operation] = validator

    def start(self) -> None:
        with self.database.sessions() as session:
            session.execute(insert(Namespace).values(id=1, runtime_mode=self.runtime.mode).on_conflict_do_nothing())
            namespace = session.get(Namespace, 1)
            if namespace is None or namespace.runtime_mode != self.runtime.mode:
                session.rollback()
                raise DomainError(409, "runtime_namespace_mismatch", "This data directory belongs to a different Runtime mode.", "Select the separate data directory for the configured mode.")
            originals = list(session.scalars(select(Job).where(Job.status.in_(("queued","running")))))
            self.recovery_ids = {job.id for job in originals}
            session.commit()
        self.thread.start()

    def close(self) -> None:
        self.stop_event.set()
        if self.thread.ident is not None:
            self.thread.join(timeout=60)
        if self.thread.is_alive():
            log.error("Application Job worker still finishing an owned bounded Runtime request", extra={"event": "job_shutdown_unconfirmed"})

    def submit(self, project_id: UUID, operation: Operation, inputs: dict[str, object], retry_of_job_id: str | None = None) -> Job:
        observation = self.runtime.health()
        capability = next(item for item in self.runtime.capabilities(observation) if item.operation == operation)
        if not capability.ready:
            raise DomainError(503, capability.reasons[0], "The requested Runtime capability is not currently ready.", "Inspect current Runtime/model evidence before submitting.")
        workflow = self.registry.workflow(operation)
        requirements = self.registry.requirements()
        provenance: dict[str, object] = dict(runtime_kind=self.runtime.mode, workflow_id=workflow.id, workflow_version=workflow.version,
                                            settings=self.registry.settings(operation),
                                            manifest_sha256=workflow.manifest_sha256, definition_sha256=workflow.definition_sha256,
                                            runtime_revision=requirements.runtime_revision if self.runtime.mode == "comfyui" else "fake-fixture-v1",
                                            plugin_revision=requirements.plugin_revision if self.runtime.mode == "comfyui" else None,
                                            models=[dict(id=model.id, revision=model.revision, declared_sha256=model.sha256) for model in requirements.models if model.id in workflow.required_models])
        if retry_of_job_id is not None:
            provenance["retry_of_job_id"] = retry_of_job_id
        job = Job(id=str(uuid4()), project_id=str(project_id), operation=operation, inputs=dict(inputs), provenance=provenance,
                  runtime_mode=self.runtime.mode, attempt_id=str(uuid4()), status="queued", phase="preparing", progress=None, submission_state="pending")
        with self.database.sessions() as session:
            session.add(job)
            session.commit()
        self.pending.put(job.id)
        self.notify(job.id)
        return job

    def _run(self) -> None:
        self._recover_startup()
        while not self.stop_event.is_set():
            try:
                identifier = self.pending.get(timeout=0.05)
            except Empty:
                continue
            try:
                self._execute(identifier)
            except Exception as error:
                self._record_failure(identifier,error)
            finally:
                self.pending.task_done()

    def _record_failure(self,identifier: str,error: Exception) -> None:
        log.exception("Application Job failed",extra={"event":"job_failed","job_id":identifier})
        with self.transition_lock,self.database.sessions() as session:
            job = job_for_write(session,identifier)
            if job is not None and job.status not in {"completed","failed","cancelled"}:
                if job.submission_state == "submitting":
                    job.submission_state = "unconfirmed"
                job.status,job.phase,job.progress = "failed",None,None
                job.updated_at = utc_now()
                job.error = dict(code=error.detail.code if isinstance(error,DomainError) else "runtime_unavailable",
                                 message=error.detail.message if isinstance(error,DomainError) else "Runtime work could not be confirmed.",
                                 recovery=error.detail.recovery if isinstance(error,DomainError) else "Inspect this Job's retained attempt before retrying.")
                session.commit()
        self.notify(identifier)

    def _begin(self, identifier: str) -> tuple[Operation, str] | None:
        with self.database.sessions() as session:
            job = session.get(Job, identifier)
            if job is None or job.status in {"completed", "failed", "cancelled"}:
                return None
            operation = cast(Operation, job.operation)
            reference_path = None
            if operation == "Transcribe":
                reference = session.get(Asset, str(job.inputs["reference_asset_id"]))
                if reference is None or reference.project_id != job.project_id:
                    raise DomainError(409, "reference_audio_unavailable", "Job Reference Audio is unavailable.", "Restore the original Project Asset.")
                reference_path = self.storage.readable(reference.storage_key, reference.size_bytes)
                if hashlib.sha256(reference_path.read_bytes()).hexdigest() != job.inputs["reference_sha256"]:
                    raise DomainError(409, "reference_audio_unavailable", "Reference Audio changed after the Job input snapshot.", "Restore its original bytes before any new inference.")
            request = RuntimeRequest(UUID(job.attempt_id), operation, dict(job.inputs), reference_path)
        # First DML in a fresh transaction avoids upgrading the input-read snapshot.
        # A crash/exception after this durable point cannot mean "never dispatched".
        with self.database.sessions() as session:
            proof = self.runtime.prepare(request)
            session.execute(update(Job).where(Job.id == identifier).values(submission_state="submitting",runtime_proof=proof, updated_at=utc_now()))
            session.commit()
        request = replace(request,proof=proof)
        self.notify(identifier)
        receipt = self.runtime.submit(request)
        with self.database.sessions() as session:
            job = job_for_write(session, identifier)
            assert job is not None
            job.submission_state = receipt.outcome
            job.runtime_handle = receipt.handle
            job.updated_at = utc_now()
            session.commit()
        self.notify(identifier)
        if receipt.outcome != "accepted" or receipt.handle is None:
            raise DomainError(503, receipt.code or "submission_unconfirmed", receipt.message or "Native submission acknowledgement is unconfirmed; accepted work may exist.", "Inspect the saved attempt/correlation before explicitly retrying.")
        return operation, receipt.handle

    def _execute(self, identifier: str) -> None:
        with self.transition_lock:
            started = self._begin(identifier)
        if started is None:
            return
        operation, handle = started
        self._watch(identifier,operation,handle)

    def _watch(self,identifier: str,operation: Operation,handle: str) -> None:
        observations: Queue[RuntimeStatus] = Queue()
        close_observer = None
        try:
            if self.subscription_factory is not None:
                try:
                    close_observer = self.subscription_factory(handle, operation, observations.put)
                except Exception:
                    log.exception("Runtime observation subscription unavailable", extra={"event": "job_subscription_failed", "job_id": identifier})
            self._observe(identifier, operation, handle, observations)
        finally:
            if close_observer is not None:
                try:
                    close_observer()
                except Exception:
                    log.exception("Runtime observation stop acknowledgement unavailable", extra={"event": "job_subscription_stop_failed", "job_id": identifier})

    def _observe(self, identifier: str, operation: Operation, handle: str, observations: Queue[RuntimeStatus], one_pass: bool = False) -> None:
        deadline = time.monotonic() + 1800
        while not self.stop_event.is_set():
            read_deadline,sibling_bound = self._recovery_read_deadline() if one_pass else (datetime.now(timezone.utc),False)
            if one_pass and read_deadline <= datetime.now(timezone.utc):
                return
            try:
                budget = max(0.001,(read_deadline-datetime.now(timezone.utc)).total_seconds())
                observed = self.runtime.observe(handle,budget) if one_pass else self.runtime.status(handle)
            except Exception:
                if one_pass and sibling_bound:
                    # Yield a borrowed read slice without spending this confirmed
                    # source's ownership probe on another original's deadline.
                    return
                log.exception("Original Runtime status unavailable",extra={"event":"job_status_unconfirmed","job_id":identifier})
                observed = RuntimeStatus("unconfirmed",code="runtime_unavailable")
            if observed.state == "unconfirmed":
                confirmed = self._confirm_original(identifier,one_pass)
                if confirmed is None:
                    return
                operation,handle = confirmed
                if one_pass:
                    return
                continue
            with self.transition_lock, self.database.sessions() as session:
                job = job_for_write(session, identifier)
                assert job is not None
                if job.status in {"completed", "failed", "cancelled"}:
                    return
                if observed.state in {"queued", "running"}:
                    job.status = observed.state
                    if observed.phase is not None:
                        self._project_phase(job, operation, observed)
                    else:
                        job.progress = measured_progress(observed.progress)
                    while True:
                        try:
                            event = observations.get_nowait()
                        except Empty:
                            break
                        if event.code == "native_event_source_lost":
                            job.phase, job.progress = None, None
                        elif event.state == "running" and job.status == "running":
                            self._project_phase(job, operation, event)
                    job.updated_at = utc_now()
                    session.commit()
            self.notify(identifier)
            if observed.state == "completed":
                with self.transition_lock, self.database.sessions() as session:
                    job = job_for_write(session, identifier)
                    assert job is not None
                    if job.status in {"completed", "failed", "cancelled"}:
                        return
                    job.status, job.phase, job.progress = "running", "saving", None
                    job.updated_at = utc_now()
                    session.commit()
                self.notify(identifier)
                result = self.runtime.result(handle, operation)
                materials = self.validators[operation](result)
                with self.transition_lock:
                    import_result(self.database, self.storage, identifier, materials, result, self.registrars.get(operation))
                self.notify(identifier)
                return
            if observed.state in {"failed", "cancelled"}:
                if observed.state == "cancelled":
                    with self.transition_lock, self.database.sessions() as session:
                        job = job_for_write(session, identifier)
                        assert job is not None
                        if job.status not in {"completed", "failed", "cancelled"}:
                            mark_cancelled(job)
                            session.commit()
                    self.notify(identifier)
                    return
                detail = failure_detail(operation, observed.code)
                log.error("Runtime reported a failed Job", extra={"event": "job_runtime_failed", "job_id": identifier,
                          "operation": operation, "runtime_message": observed.message})
                raise DomainError(503, detail.code, detail.message, detail.recovery)
            if time.monotonic() >= deadline:
                raise DomainError(503, "runtime_unavailable", "Native work was not confirmed within the execution window.", "Inspect the saved attempt before retrying.")
            if one_pass:
                return
            self.stop_event.wait(0.01)

    def _project_phase(self, job: Job, operation: Operation, observed: RuntimeStatus) -> None:
        if job.status in {"completed", "failed", "cancelled"} or job.phase == "saving":
            return
        phases = OPERATION_PHASES[operation]
        if observed.phase is None:
            job.progress = measured_progress(observed.progress)
        elif observed.phase in phases:
            job.phase, job.progress = observed.phase, measured_progress(observed.progress)


    def _initial_cursor(self,now: datetime) -> dict[str,object]:
        return dict(started_at=now.isoformat(),deadline=(now+timedelta(seconds=self.settings.recovery_confirmation_window_seconds)).isoformat(),
                    attempts=0,confirmed=False,reason="original_mapping_unconfirmed")

    def _recovery_read_deadline(self,exclude: str | None = None) -> tuple[datetime,bool]:
        """A slow known source cannot spend another original's remaining window."""
        deadline = datetime.now(timezone.utc)+timedelta(seconds=self.settings.runtime_timeout_seconds)
        if not self.recovery_ids:
            return deadline,False
        sibling_bound = False
        with self.database.sessions() as session:
            for job in session.scalars(select(Job).where(Job.id.in_(self.recovery_ids),Job.status.in_(("queued","running")))):
                cursor = job.recovery_cursor or {}
                if job.id != exclude and cursor.get("confirmed") is not True:
                    original_deadline = datetime.fromisoformat(cast(str,cursor["deadline"]))
                    if original_deadline < deadline:
                        deadline,sibling_bound = original_deadline,True
        return deadline,sibling_bound

    def _recover_startup(self) -> None:
        sources: dict[str,tuple[Operation,str,Queue[RuntimeStatus],Callable[[],None] | None]] = {}
        admitted = False
        try:
            while self.recovery_ids and not self.stop_event.is_set():
                if not admitted:
                    try:
                        self._admit_recovery()
                    except Exception:
                        log.exception("Recovery admission persistence unconfirmed",extra={"event":"job_recovery_admission_unconfirmed"})
                        self.stop_event.wait(0.01)
                        continue
                    admitted = True
                # Unknown originals get disposition before confirmed observation.
                for identifier in sorted(self.recovery_ids,key=lambda item:item in sources):
                    try:
                        with self.database.sessions() as session:
                            job = session.get(Job,identifier)
                            finished = job is None or job.status in {"completed","failed","cancelled"}
                            confirmed_before = job is not None and (job.recovery_cursor or {}).get("confirmed") is True
                        if finished:
                            self.recovery_ids.remove(identifier)
                            source = sources.pop(identifier,None)
                            if source is not None and source[3] is not None:
                                source[3]()
                            continue
                        if not confirmed_before and identifier in sources:
                            source = sources.pop(identifier)
                            if source[3] is not None:
                                source[3]()
                        if identifier not in sources:
                            confirmed = self._confirm_original(identifier,True)
                            if confirmed is None:
                                continue
                            operation,handle = confirmed
                            observations: Queue[RuntimeStatus] = Queue()
                            close = None
                            if self.subscription_factory is not None:
                                try:
                                    close = self.subscription_factory(handle,operation,observations.put)
                                except Exception:
                                    log.exception("Recovered Runtime subscription unavailable",extra={"event":"job_recovery_subscription_failed","job_id":identifier})
                            sources[identifier] = operation,handle,observations,close
                        operation,handle,observations,_ = sources[identifier]
                        try:
                            self._observe(identifier,operation,handle,observations,True)
                        except Exception as error:
                            self._record_failure(identifier,error)
                    except Exception:
                        # The commit may be durable despite a lost acknowledgement.
                        # Fresh-read on the next sweep; never reset or replay a probe.
                        log.exception("Recovery persistence outcome unconfirmed",extra={"event":"job_recovery_persistence_unconfirmed","job_id":identifier})
                self.stop_event.wait(0.01)
        finally:
            for _,_,_,close in sources.values():
                if close is not None:
                    try:
                        close()
                    except Exception:
                        log.exception("Recovered Runtime source shutdown unconfirmed",extra={"event":"job_recovery_source_shutdown_unconfirmed"})

    def _admit_recovery(self) -> None:
        """Create all new budgets after worker metadata admission; retain old ones."""
        with self.transition_lock,self.database.sessions() as session:
            active = Job.id.in_(self.recovery_ids),Job.status.in_(("queued","running"))
            # Acquire the writer before reading, as in ordinary Job transitions.
            session.execute(update(Job).where(*active).values(updated_at=Job.updated_at))
            originals = list(session.scalars(select(Job).where(*active)))
            now = datetime.now(timezone.utc)
            for job in originals:
                if job.recovery_cursor is None:
                    job.recovery_cursor = self._initial_cursor(now)
            session.commit()

    def _confirm_original(self,identifier: str,one_pass: bool = False) -> tuple[Operation,str] | None:
        """Only observe retained work; the durable confirmation budget cannot renew."""
        while not self.stop_event.is_set():
            now = datetime.now(timezone.utc)
            with self.transition_lock,self.database.sessions() as session:
                job = job_for_write(session,identifier)
                if job is None or job.status in {"completed","failed","cancelled"}:
                    return None
                cursor = dict(job.recovery_cursor or {})
                if not cursor:
                    cursor = self._initial_cursor(now)
                deadline = datetime.fromisoformat(cast(str,cursor["deadline"]))
                attempts = cast(int,cursor["attempts"])
                was_confirmed = cursor.get("confirmed") is True
                if not was_confirmed and (now >= deadline or attempts >= self.settings.recovery_max_attempts):
                    job.status,job.phase,job.progress = "failed",None,None
                    job.submission_state = "unconfirmed"
                    job.error = dict(code="runtime_unavailable",message="The original Runtime outcome was not confirmed within the recovery budget.",
                                     recovery="Retain this Job's original attempt and mapping; no inference was resubmitted. Confirmation reason: "+str(cursor.get("reason")))
                    job.recovery_cursor = dict(cursor,exhausted=True)
                    job.updated_at = utc_now()
                    session.commit()
                    self.notify(identifier)
                    return None
                next_attempt = datetime.fromisoformat(cast(str,cursor.get("next_attempt_at",now.isoformat())))
                if one_pass and not was_confirmed and now < next_attempt:
                    return None
                operation = cast(Operation,job.operation)
                read_deadline = now+timedelta(seconds=self.settings.runtime_timeout_seconds) if was_confirmed else deadline
                request = RuntimeRequest(UUID(job.attempt_id),operation,dict(job.inputs),proof=job.runtime_proof,runtime_handle=job.runtime_handle)
                # Consume the one previously confirmed probe before I/O. A crash
                # cannot repeatedly grant fresh reads of expired uncertainty.
                job.recovery_cursor = dict(cursor,attempts=attempts+1,confirmed=False,last_attempt_at=now.isoformat())
                job.submission_state = "unconfirmed"
                job.phase,job.progress = None,None
                job.error = dict(code="runtime_unavailable",message="Original Runtime ownership or state is awaiting confirmation.",
                                 recovery="Read this same Job; its confirmation window is bounded and no inference will be resubmitted.")
                job.updated_at = utc_now()
                session.commit()
            self.notify(identifier)
            reason = "runtime_unavailable"
            read_deadline = min(read_deadline,self._recovery_read_deadline(identifier)[0])
            request = replace(request,confirmation_deadline=read_deadline)
            try:
                receipt = self.runtime.recover(request)
                reason = receipt.code or "original_state_unconfirmed"
                observed = receipt.status or (self.runtime.observe(receipt.handle,max(0.001,(read_deadline-datetime.now(timezone.utc)).total_seconds())) if receipt.outcome == "accepted" and receipt.handle is not None else RuntimeStatus("unconfirmed"))
            except Exception:
                log.exception("Original Runtime recovery observation unavailable",extra={"event":"job_recovery_unconfirmed","job_id":identifier})
                observed = RuntimeStatus("unconfirmed")
                receipt = None
            with self.transition_lock,self.database.sessions() as session:
                job = job_for_write(session,identifier)
                if job is None or job.status in {"completed","failed","cancelled"}:
                    return None
                cursor = dict(job.recovery_cursor or {})
                job.recovery_cursor = dict(cursor,reason=reason,last_observed_at=datetime.now(timezone.utc).isoformat())
                if receipt is not None and receipt.handle is not None and observed.state != "unconfirmed":
                    job.runtime_handle = receipt.handle
                    job.submission_state = "accepted"
                    job.recovery_cursor = dict(job.recovery_cursor or {},confirmed=True)
                    if observed.state in {"queued","running"}:
                        job.status = observed.state
                        job.progress = measured_progress(observed.progress)
                        if observed.phase is not None:
                            self._project_phase(job,operation,observed)
                    job.error = None
                    job.updated_at = utc_now()
                    session.commit()
                    self.notify(identifier)
                    return operation,receipt.handle
                delay = min(self.settings.recovery_max_poll_interval_seconds,self.settings.recovery_poll_interval_seconds*2**min(attempts,30),
                            max(0,(deadline-datetime.now(timezone.utc)).total_seconds()))
                job.recovery_cursor = dict(job.recovery_cursor or {},next_attempt_at=(datetime.now(timezone.utc)+timedelta(seconds=delay)).isoformat())
                session.commit()
            if one_pass:
                return None
            self.stop_event.wait(delay)
        return None


def job_read(job: Job) -> JobRead:
    return JobRead(id=UUID(job.id), project_id=UUID(job.project_id), operation=cast(Operation, job.operation), status=cast(JobState, job.status),
                   phase=job.phase, progress=job.progress, inputs=job.inputs, provenance=job.provenance, error=job.error, result=job.result_refs,
                   recovery_required=job.submission_state in {"unconfirmed", "submitting"} or job.cancel_requested and job.status in {"queued", "running"}
                   or job.error is not None and job.error.get("code") in {"runtime_unavailable", "cancellation_unconfirmed", "cancellation_ownership_unverified"},
                   cancel_requested=job.cancel_requested,
                   created_at=datetime.fromisoformat(job.created_at), updated_at=datetime.fromisoformat(job.updated_at))
