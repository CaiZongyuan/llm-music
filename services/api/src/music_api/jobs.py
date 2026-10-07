"""Persist first, submit once, and complete only after an owned result import."""

from datetime import datetime, timezone
import logging
from queue import Empty, Queue
import threading
import time
from typing import Callable, cast
from uuid import UUID, uuid4

from sqlalchemy.dialects.sqlite import insert

from music_api.config import Settings
from music_api.database import Database, utc_now
from music_api.errors import DomainError
from music_api.job_models import Job, Namespace
from music_api.result_import import ImportMaterial, ResultRegistrar
from music_api.result_import import import_result
from music_api.midi_validation import note_count
from music_api.runtime_types import InferenceRuntime, JobState, Operation, RuntimeArtifact, RuntimeRequest, RuntimeResult
from music_api.schemas import JobRead
from music_api.storage import Storage
from music_api.workflow_registry import WorkflowRegistry


log = logging.getLogger("music_api")
ResultValidator = Callable[[RuntimeResult], tuple[ImportMaterial, ...]]


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
                with self.database.sessions() as session:
                    job = session.get(Job, identifier)
                    if job is not None and job.status != "completed":
                        job.status = "failed"
                        job.phase, job.progress = None, None
                        job.updated_at = utc_now()
                        job.error = dict(code=error.detail.code if isinstance(error, DomainError) else "runtime_unavailable",
                                         message=error.detail.message if isinstance(error, DomainError) else "Runtime work could not be confirmed.",
                                         recovery=error.detail.recovery if isinstance(error, DomainError) else "Inspect this Job's retained attempt before retrying.")
                        session.commit()
            finally:
                self.pending.task_done()

    def _execute(self, identifier: str) -> None:
        with self.database.sessions() as session:
            job = session.get(Job, identifier)
            if job is None or job.status == "completed":
                return
            operation = cast(Operation, job.operation)
            request = RuntimeRequest(UUID(job.attempt_id), operation, dict(job.inputs))
        receipt = self.runtime.submit(request)
        with self.database.sessions() as session:
            job = session.get(Job, identifier)
            assert job is not None
            job.submission_state = receipt.outcome
            job.runtime_handle = receipt.handle
            job.updated_at = utc_now()
            session.commit()
        if receipt.outcome != "accepted" or receipt.handle is None:
            raise DomainError(503, receipt.code or "submission_unconfirmed", receipt.message or "Native submission acknowledgement is unconfirmed; accepted work may exist.", "Inspect the saved attempt/correlation before explicitly retrying.")
        deadline = time.monotonic() + 1800
        while not self.stop_event.is_set():
            observed = self.runtime.status(receipt.handle)
            with self.database.sessions() as session:
                job = session.get(Job, identifier)
                assert job is not None
                if observed.state in {"queued", "running"}:
                    job.status, job.phase, job.progress = observed.state, observed.phase, observed.progress
                    job.updated_at = utc_now()
                    session.commit()
            if observed.state == "completed":
                result = self.runtime.result(receipt.handle, operation)
                materials = self.validators[operation](result)
                import_result(self.database, self.storage, identifier, materials, result, self.registrars.get(operation))
                return
            if observed.state in {"failed", "cancelled"}:
                raise DomainError(503, observed.code or "runtime_unavailable", observed.message or "Native work did not complete successfully.", "Retain the Job inputs and native attempt mapping.")
            if time.monotonic() >= deadline:
                raise DomainError(503, "runtime_unavailable", "Native work was not confirmed within the execution window.", "Inspect the saved attempt before retrying.")
            self.stop_event.wait(0.01)


def job_read(job: Job) -> JobRead:
    return JobRead(id=UUID(job.id), project_id=UUID(job.project_id), operation=cast(Operation, job.operation), status=cast(JobState, job.status),
                   phase=job.phase, progress=job.progress, inputs=job.inputs, provenance=job.provenance, error=job.error, result=job.result_refs,
                   recovery_required=job.submission_state == "unconfirmed", created_at=datetime.fromisoformat(job.created_at), updated_at=datetime.fromisoformat(job.updated_at))
