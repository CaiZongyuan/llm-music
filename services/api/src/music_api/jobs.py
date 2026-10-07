"""Persist first, submit once, and complete only after an owned result import."""

from datetime import datetime, timezone
import logging
import hashlib
import math
from queue import Empty, Queue
import threading
import time
from typing import Callable, cast
from uuid import UUID, uuid4

from sqlalchemy.dialects.sqlite import insert
from sqlalchemy import select

from music_api.config import Settings
from music_api.database import Asset, Database, utc_now
from music_api.errors import DomainError
from music_api.job_models import Job, Namespace
from music_api.result_import import ImportMaterial, ResultRegistrar
from music_api.result_import import import_result
from music_api.midi_validation import note_count
from music_api.runtime_types import InferenceRuntime, JobState, Operation, RuntimeArtifact, RuntimeRequest, RuntimeResult, RuntimeStatus
from music_api.schemas import JobRead
from music_api.storage import Storage
from music_api.workflow_registry import WorkflowRegistry


log = logging.getLogger("music_api")
ResultValidator = Callable[[RuntimeResult], tuple[ImportMaterial, ...]]
SubscriptionFactory = Callable[[str, Operation, Callable[[RuntimeStatus], None]], Callable[[], None]]
OPERATION_PHASES: dict[Operation, tuple[str, ...]] = {
    "Transcribe": ("loading_model", "transcribing"),
    "Generate": ("loading_model", "planning_score", "generating_semantic", "synthesizing", "decoding_audio"),
}


def measured_progress(value: float | None) -> float | None:
    return float(value) if value is not None and not isinstance(value, bool) and math.isfinite(value) and 0 <= value <= 1 else None


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
        with self.transition_lock, self.database.sessions() as session:
            job = session.scalar(select(Job).where(Job.id == str(identifier), Job.project_id == str(project_id)))
            if job is None:
                raise DomainError(404, "job_not_found", "Job does not exist in this Project.", "Query its owning Project.")
            if job.status in {"completed", "failed", "cancelled"}:
                return job
            if job.submission_state == "pending":
                observed = RuntimeStatus("cancelled")
            elif job.runtime_handle is not None:
                observed = self.runtime.cancel(job.runtime_handle)
            else:
                raise DomainError(409, "cancellation_unconfirmed", "The native target identity is unavailable.", "Retain this Job's attempt mapping and inspect its Runtime outcome before retrying.")
            if observed.state == "cancelled":
                job.status, job.phase, job.progress = "cancelled", None, None
                job.error = dict(code="cancelled", message="This Job was cancelled.", recovery="Explicitly create a new Job if you want to repeat the operation.")
                job.updated_at = utc_now()
                session.commit()
            elif observed.state == "unconfirmed":
                raise DomainError(409, observed.code or "cancellation_unconfirmed", observed.message or "Cancellation is unconfirmed.",
                                  "Retain this Job and inspect the Runtime before any new attempt.")
        self.notify(job.id)
        return job

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
            session.commit()
        self.thread.start()

    def close(self) -> None:
        self.stop_event.set()
        if self.thread.ident is not None:
            self.thread.join(timeout=60)
        if self.thread.is_alive():
            log.error("Application Job worker still finishing an owned bounded Runtime request", extra={"event": "job_shutdown_unconfirmed"})

    def submit(self, project_id: UUID, operation: Operation, inputs: dict[str, object]) -> Job:
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
        job = Job(id=str(uuid4()), project_id=str(project_id), operation=operation, inputs=dict(inputs), provenance=provenance,
                  runtime_mode=self.runtime.mode, attempt_id=str(uuid4()), status="queued", phase="preparing", progress=None, submission_state="pending")
        with self.database.sessions() as session:
            session.add(job)
            session.commit()
        self.pending.put(job.id)
        self.notify(job.id)
        return job

    def _run(self) -> None:
        while not self.stop_event.is_set():
            try:
                identifier = self.pending.get(timeout=0.05)
            except Empty:
                continue
            try:
                self._execute(identifier)
            except Exception as error:
                log.exception("Application Job failed", extra={"event": "job_failed", "job_id": identifier})
                with self.transition_lock, self.database.sessions() as session:
                    job = session.get(Job, identifier)
                    if job is not None and job.status not in {"completed", "failed", "cancelled"}:
                        job.status = "failed"
                        job.phase, job.progress = None, None
                        job.updated_at = utc_now()
                        job.error = dict(code=error.detail.code if isinstance(error, DomainError) else "runtime_unavailable",
                                         message=error.detail.message if isinstance(error, DomainError) else "Runtime work could not be confirmed.",
                                         recovery=error.detail.recovery if isinstance(error, DomainError) else "Inspect this Job's retained attempt before retrying.")
                        session.commit()
                self.notify(identifier)
            finally:
                self.pending.task_done()

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
        receipt = self.runtime.submit(request)
        with self.database.sessions() as session:
            job = session.get(Job, identifier)
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

    def _observe(self, identifier: str, operation: Operation, handle: str, observations: Queue[RuntimeStatus]) -> None:
        deadline = time.monotonic() + 1800
        while not self.stop_event.is_set():
            observed = self.runtime.status(handle)
            with self.transition_lock, self.database.sessions() as session:
                job = session.get(Job, identifier)
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
                    job = session.get(Job, identifier)
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
                        job = session.get(Job, identifier)
                        assert job is not None
                        if job.status not in {"completed", "failed", "cancelled"}:
                            job.status, job.phase, job.progress = "cancelled", None, None
                            job.error = dict(code="cancelled", message="This Job was cancelled.", recovery="Explicitly create a new Job to repeat the operation.")
                            job.updated_at = utc_now()
                            session.commit()
                    self.notify(identifier)
                    return
                raise DomainError(503, observed.code or "runtime_unavailable", observed.message or "Native work did not complete successfully.", "Retain the Job inputs and native attempt mapping.")
            if time.monotonic() >= deadline:
                raise DomainError(503, "runtime_unavailable", "Native work was not confirmed within the execution window.", "Inspect the saved attempt before retrying.")
            self.stop_event.wait(0.01)

    def _project_phase(self, job: Job, operation: Operation, observed: RuntimeStatus) -> None:
        if job.status in {"completed", "failed", "cancelled"} or job.phase == "saving":
            return
        phases = OPERATION_PHASES[operation]
        if observed.phase is None:
            job.progress = measured_progress(observed.progress)
        elif observed.phase in phases:
            previous = phases.index(job.phase) if job.phase in phases else -1
            if phases.index(observed.phase) >= previous:
                job.phase, job.progress = observed.phase, measured_progress(observed.progress)


def job_read(job: Job) -> JobRead:
    return JobRead(id=UUID(job.id), project_id=UUID(job.project_id), operation=cast(Operation, job.operation), status=cast(JobState, job.status),
                   phase=job.phase, progress=job.progress, inputs=job.inputs, provenance=job.provenance, error=job.error, result=job.result_refs,
                   recovery_required=job.submission_state == "unconfirmed", created_at=datetime.fromisoformat(job.created_at), updated_at=datetime.fromisoformat(job.updated_at))
