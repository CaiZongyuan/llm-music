"""User-facing Runtime failures contain domain actions, never native exception text."""

from music_api.runtime_types import Operation
from music_api.schemas import ErrorDetail


FAILURES = {
    "runtime_out_of_memory": ("The Runtime ran out of GPU memory.", "Retain this Job; restore the verified memory profile before explicitly retrying."),
    "model_missing": ("A required model could not be loaded.", "Restore the pinned model file and current verification evidence before explicitly retrying."),
    "workflow_invalid": ("The Runtime rejected the Workflow.", "Restore the pinned Workflow and required nodes; retain this Job before trying again."),
    "runtime_unavailable": ("The Runtime outcome could not be confirmed.", "Inspect the original attempt before retrying; unconfirmed work may still exist."),
    "transcription_failed": ("Transcription failed in the Runtime.", "Retain the original Reference Audio and inspect development logs before explicitly retrying."),
    "generation_failed": ("Generation failed in the Runtime.", "Retain style, lyrics and seed; inspect development logs before explicitly retrying."),
}


def failure_detail(operation: Operation, code: str | None) -> ErrorDetail:
    normalized = code if code in FAILURES else "transcription_failed" if operation == "Transcribe" else "generation_failed"
    message, recovery = FAILURES[normalized]
    return ErrorDetail(code=normalized, message=message, recovery=recovery)
