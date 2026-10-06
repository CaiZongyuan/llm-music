"""Validate Score through the pinned Runtime's public ABC parser."""

import math

if __package__:
    from .runtime_client import RuntimeFailure
else:
    from runtime_client import RuntimeFailure


def validate_abc(client, text):
    endpoint = "/yue2/score/read"
    if not isinstance(text, str) or not text.strip():
        raise RuntimeFailure(endpoint, "Transcription returned no ABC Score.")
    result = client.post_json(endpoint, {"abc": text})
    sheet = result.get("sheet")
    if not isinstance(sheet, dict) or sheet.get("cut") is not False:
        raise RuntimeFailure(endpoint, "ABC parser returned no complete Score, or trimmed an incomplete section.", details=result)
    duration = sheet.get("seconds")
    if type(duration) not in (int, float) or not math.isfinite(duration) or duration <= 0 or not sheet.get("bars"):
        raise RuntimeFailure(endpoint, "ABC Score has no valid duration or bars.", details=result)
    parts = sheet.get("notes")
    if not isinstance(parts, dict) or not all(isinstance(part, list) for part in parts.values()):
        raise RuntimeFailure(endpoint, "ABC Score has no parsed notes.", details=result)
    notes = [note for part in parts.values() for note in part]
    if not notes or any(not isinstance(note, dict) or type(note.get("pitch")) is not int
                        or not 0 <= note["pitch"] <= 127 or type(note.get("length")) not in (int, float)
                        or not math.isfinite(note["length"]) or note["length"] <= 0 for note in notes):
        raise RuntimeFailure(endpoint, "ABC Score has no valid pitched notes.", details=result)
    return dict(parser=endpoint, sheet=sheet, note_count=len(notes), valid=True)
