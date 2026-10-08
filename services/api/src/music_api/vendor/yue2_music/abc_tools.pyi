from fractions import Fraction

class Voice:
    notes: list[list[Fraction | int]]
    time: Fraction
    bars: list[tuple[Fraction, Fraction, tuple[int, int]]]
    chords: list[tuple[Fraction, str]]

class Score:
    voices: dict[str, Voice]
    bpm: int

def parse_abc(text: str) -> Score: ...
def strip_chords(text: str, keep_voice: str = "both") -> str: ...
