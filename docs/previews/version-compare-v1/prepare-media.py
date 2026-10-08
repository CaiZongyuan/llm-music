"""Prepare verified historical music and a real 31-second review crop; CPU only."""
from argparse import ArgumentParser
from datetime import datetime, timezone
from pathlib import Path
from urllib.request import urlopen
import base64
import hashlib
import json
import wave

import av
import numpy as np

parser = ArgumentParser(description=__doc__)
parser.add_argument('--output-dir', type=Path, required=True)
parser.add_argument('--source-a', type=Path)
parser.add_argument('--source-b', type=Path)
args = parser.parse_args()
out = args.output_dir.resolve()
out.mkdir(parents=True, exist_ok=True)


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def source(local, filename, revision, repository_path, expected):
    path = local.resolve() if local else out / filename
    if not local and not path.exists():
        url = f'https://raw.githubusercontent.com/CaiZongyuan/llm-music/{revision}/{repository_path}'
        with urlopen(url, timeout=30) as response:
            content = response.read()
        if hashlib.sha256(content).hexdigest() != expected:
            raise ValueError(f'Historical sample hash mismatch: {filename}')
        path.write_bytes(content)
    if sha(path) != expected:
        raise ValueError(f'Historical sample hash mismatch: {filename}')
    return path


source_a = source(args.source_a, 'melody-cover.mp3', '7435af7a92b047d1a0acbd983d4c331be31dda80',
                  'docs/evidence/p4-melody-cover/melody-cover.mp3',
                  '557a933bc217976dac521f0699ac78e9762b58148793dd350a8b810170befa5f')
source_b = source(args.source_b, 'full-cover.mp3', 'c8072b80dcf54c6eef8eb5d649a3beef559cdb91',
                  'docs/evidence/p4-full-cover/full-cover.mp3',
                  'beffee708a9ae829132cf7f6bc82ce86540e1daa36500d32c0eac246b931768f')
original = {str(path): sha(path) for path in (source_a, source_b)}
target = out / 'full-cover-review-31s.wav'
if target in (source_a, source_b):
    raise ValueError('The crop must not overwrite a source sample')
count = 0
with av.open(str(source_b)) as incoming, wave.open(str(target), 'wb') as outgoing:
    outgoing.setnchannels(2)
    outgoing.setsampwidth(2)
    outgoing.setframerate(48000)
    for frame in incoming.decode(audio=0):
        if frame.sample_rate != 48000 or len(frame.layout.channels) != 2:
            raise ValueError('Expected historical stereo48k audio')
        remaining = 31 * 48000 - count
        if remaining <= 0:
            break
        samples = min(frame.samples, remaining)
        array = np.ascontiguousarray(frame.to_ndarray()[:, :samples])
        outgoing.writeframesraw((np.clip(array.T, -1, 1) * 32767).astype('<i2').tobytes())
        count += samples
if count != 31 * 48000:
    raise ValueError('The source is too short for the specified crop')


def decode(path):
    samples = 0
    with av.open(str(path)) as audio:
        for frame in audio.decode(audio=0):
            if frame.sample_rate != 48000 or len(frame.layout.channels) != 2 or not np.isfinite(frame.to_ndarray()).all():
                raise ValueError('Invalid decoded sample')
            samples += frame.samples
    return samples / 48000


durations = {'melody': decode(source_a), 'full': decode(target)}
if durations['full'] != 31 or not 34 < durations['melody'] < 36:
    raise ValueError('Unexpected actual decoded duration')
if {str(path): sha(path) for path in (source_a, source_b)} != original:
    raise ValueError('A source sample changed during preparation')
fixtures = {
    key: dict(mime='audio/wav' if key == 'full' else 'audio/mpeg', duration=durations[key],
              sha256=sha(path), base64=base64.b64encode(path.read_bytes()).decode('ascii'))
    for key, path in [('melody', source_a), ('full', target)]
}
bad_bytes = b'isolated invalid MP3 bytes'
fixtures['bad'] = dict(mime='audio/mpeg', duration=None, sha256=hashlib.sha256(bad_bytes).hexdigest(),
                       base64=base64.b64encode(bad_bytes).decode('ascii'))
(out / 'media.js').write_text('export const mediaFixtures = ' + json.dumps(fixtures) + ';\n', encoding='utf-8')
receipt = dict(recorded_at=datetime.now(timezone.utc).isoformat(), source_hashes=original,
               original_unchanged=True, range_seconds=[0, 31], crop_file=str(target), crop_sha256=sha(target),
               decoded_seconds=durations, full_decode=True, no_gpu=True,
               media_module_sha256=sha(out / 'media.js'), crop_bytes=target.stat().st_size)
(out / 'media-receipt.json').write_text(json.dumps(receipt, indent=2) + '\n', encoding='utf-8')
print(json.dumps(receipt))
