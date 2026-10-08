from fractions import Fraction

class Voice:
    notes: list[tuple[Fraction, int, Fraction]]
    time: Fraction
    bars: list[tuple[Fraction, Fraction, tuple[int, int]]]

class Score:
    voices: dict[str, Voice]
    bpm: int

def parse_abc(text: str) -> Score: ...
