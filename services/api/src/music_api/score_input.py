"""Validate selected ABC with the pinned native parser before any Job is created."""

import hashlib
import re

from music_api.errors import DomainError
from music_api.vendor.yue2_music.abc_tools import parse_abc


WORDS_MARKER = re.compile(r"%yue2-words ([0-9a-f]{16})( keep)?[ \t\r]*")


def effective_score_abc(abc: str) -> tuple[str, tuple[str, ...]]:
    """Version-1 adapter rules change only native control/section comments."""
    lines = abc.split("\n")
    cleaned = [line for line in lines if WORDS_MARKER.fullmatch(line) is None]
    transformations = []
    if cleaned != lines:
        transformations.append("remove_native_words_marker")
    effective = "\n".join(cleaned).strip()
    if not any(line.startswith("% ") for line in effective.split("\n")):
        # The pinned node otherwise rearranges a bare tune around the lyrics.
        # Its native two-voice header has eight lines, ending with K:.
        source_lines = effective.split("\n")
        source_lines.insert(8, "% selected score")
        effective = "\n".join(source_lines)
        transformations.append("preserve_bare_score_sections")
    return effective, tuple(transformations)


def selected_score_validation(abc: str) -> dict[str, object]:
    effective, transformations = effective_score_abc(abc)
    try:
        score = parse_abc(effective)
        count = sum(len(voice.notes) for voice in score.voices.values())
        if not count:
            raise ValueError("Selected Score has no notes")
    except (ValueError, KeyError, IndexError) as error:
        raise DomainError(422, "score_invalid", "Selected ABC is invalid or outside the supported native two-voice dialect: " + str(error),
                          "Keep the edit, restore the native header and complete matching Vocal/Ins bars, then select it again.") from error
    return dict(valid=True, note_count=count, abc_sha256=hashlib.sha256(abc.encode("utf-8")).hexdigest(),
                effective_abc=effective, effective_abc_sha256=hashlib.sha256(effective.encode("utf-8")).hexdigest(),
                transformations=list(transformations), adapter_version="1.0.0",
                parser="pinned-yue2-native-abc", plugin_revision="fc78df9dfb214f396aa281f5b03519cefff5b00a")
