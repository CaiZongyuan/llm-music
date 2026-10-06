"""Original 16-second instrumental fixture, dedicated to CC0-1.0."""

import math
from pathlib import Path
import struct
import wave


SAMPLE_RATE = 48000
DURATION_SECONDS = 16
MELODY = [64, 67, 69, 67, 64, 62, 60, 62, 67, 71, 74, 71, 69, 67, 64, 62,
          69, 72, 76, 72, 71, 69, 67, 64, 65, 69, 72, 69, 67, 65, 64, 60]
CHORDS = [(48, 52, 55), (43, 47, 50), (45, 48, 52), (41, 45, 48)] * 2


def write_reference(path):
    path = Path(path)
    path.parent.mkdir(parents=True, exist_ok=True)
    frequencies = {note: 440.0 * 2 ** ((note - 69) / 12) for note in set(MELODY) | {n for chord in CHORDS for n in chord} | {chord[0] - 12 for chord in CHORDS}}
    pcm = bytearray()
    for frame in range(SAMPLE_RATE * DURATION_SECONDS):
        time = frame / SAMPLE_RATE
        beat_age = time % 0.5
        chord_age = time % 2
        melody_frequency = frequencies[MELODY[min(31, int(time * 2))]]
        attack = min(1, beat_age / 0.015)
        phase = 2 * math.pi * melody_frequency * beat_age
        lead = attack * math.exp(-3 * beat_age) * (0.28 * math.sin(phase) + 0.09 * math.sin(2 * phase) + 0.04 * math.sin(3 * phase))
        chord = CHORDS[min(7, int(time / 2))]
        harmony = min(1, chord_age / 0.025) * math.exp(-0.8 * chord_age) * sum(0.045 * math.sin(2 * math.pi * frequencies[note] * chord_age) for note in chord)
        bass = 0.09 * attack * math.exp(-4 * beat_age) * math.sin(2 * math.pi * frequencies[chord[0] - 12] * beat_age)
        kick = 0.07 * math.exp(-35 * beat_age) * math.sin(2 * math.pi * 55 * beat_age)
        fade = min(1, time / 0.03, (DURATION_SECONDS - time) / 0.2)
        left, right = fade * (lead + 0.95 * harmony + bass + kick), fade * (0.95 * lead + harmony + bass + kick)
        pcm.extend(struct.pack("<hh", round(32767 * left), round(32767 * right)))
    with wave.open(str(path), "wb") as audio:
        audio.setparams((2, 2, SAMPLE_RATE, 0, "NONE", "not compressed"))
        audio.writeframes(pcm)
    return path
