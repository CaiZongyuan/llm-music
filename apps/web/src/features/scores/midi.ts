// Decode the exported SMF, so the audition plays exactly its pitches and timing.
type Note = { pitch: number; start: number; end: number; velocity: number };
type Event = { tick: number; end?: true; tempo?: number; key?: string; pitch?: number; on?: boolean; velocity?: number };
export class MidiError extends Error {
  constructor(public readonly reason: 'invalid' | 'empty' | 'limit') { super(reason); }
}

export function readMidi(bytes: Uint8Array): { notes: Note[]; duration: number } {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const text = (offset: number, count: number) => String.fromCharCode(...bytes.slice(offset, offset + count));
  if (bytes.length < 14 || text(0, 4) !== 'MThd' || view.getUint32(4) !== 6) throw new MidiError('invalid');
  const division = view.getUint16(12), tracks = view.getUint16(10), events: Event[] = [];
  if (!division || division & 0x8000 || !tracks) throw new MidiError('invalid');
  let pos = 14;
  for (let track = 0; track < tracks; track++) {
    if (pos + 8 > bytes.length || text(pos, 4) !== 'MTrk') throw new MidiError('invalid');
    const end = pos + 8 + view.getUint32(pos + 4);
    if (end > bytes.length) throw new MidiError('invalid');
    pos += 8;
    let tick = 0, status = 0, ended = false;
    function byte() {
      if (pos >= end) throw new MidiError('invalid');
      return view.getUint8(pos++);
    }
    function variable() {
      let value = 0;
      for (let count = 0; count < 4; count++) {
        const part = byte(); value = (value << 7) | (part & 127);
        if (!(part & 128)) return value;
      }
      throw new MidiError('invalid');
    }
    while (pos < end) {
      tick += variable();
      let code = byte();
      if (code < 128) { pos--; code = status; }
      else if (code < 240) status = code;
      if (code === 255) {
        const type = byte(), length = variable();
        if (pos + length > end) throw new MidiError('invalid');
        if (type === 81 && length === 3) events.push({ tick, tempo: (view.getUint8(pos) << 16) | (view.getUint8(pos + 1) << 8) | view.getUint8(pos + 2) });
        if (type === 47) { ended = true; events.push({ tick, end: true }); }
        pos += length;
      } else if (code === 240 || code === 247) {
        const length = variable();
        if (pos + length > end) throw new MidiError('invalid');
        pos += length;
      } else {
        if (code < 128 || code >= 240) throw new MidiError('invalid');
        const pitch = byte(), kind = code & 240, velocity = kind === 192 || kind === 208 ? 0 : byte();
        if (kind === 144 || kind === 128) events.push({ tick, key: `${track}:${code & 15}:${pitch}`, pitch, velocity, on: kind === 144 && velocity > 0 });
      }
    }
    if (!ended) throw new MidiError('invalid');
  }
  if (pos !== bytes.length) throw new MidiError('invalid');
  events.sort((a, b) => a.tick - b.tick);
  let lastTick = 0, time = 0, tempo = 500000;
  const active = new Map<string, Omit<Note, 'end'>>(), notes: Note[] = [];
  for (const event of events) {
    time += (event.tick - lastTick) / division * tempo / 1000000; lastTick = event.tick;
    if (time > 120 || notes.length > 10000) throw new MidiError('limit');
    if (event.tempo !== undefined) { if (!event.tempo) throw new MidiError('invalid'); tempo = event.tempo; continue; }
    if (event.end) continue;
    if (!event.key || event.pitch === undefined || event.velocity === undefined) throw new MidiError('invalid');
    if (event.on) active.set(event.key, { pitch: event.pitch, start: time, velocity: event.velocity });
    else {
      const note = active.get(event.key);
      if (note) { notes.push({ ...note, end: time }); active.delete(event.key); }
    }
  }
  if (active.size) throw new MidiError('invalid');
  if (!notes.length) throw new MidiError('empty');
  if (notes.length > 10000) throw new MidiError('limit');
  return { notes, duration: time };
}

export function auditionMidi(bytes: Uint8Array): { blob: Blob; durationSeconds: number } {
  const { notes, duration } = readMidi(bytes), rate = 16000, length = Math.ceil((duration + .2) * rate), samples = new Float32Array(length);
  for (const note of notes) {
    const start = Math.floor(note.start * rate), end = Math.min(length, Math.ceil(note.end * rate)), frequency = 440 * 2 ** ((note.pitch - 69) / 12);
    for (let index = start; index < end; index++) {
      const age = (index - start) / rate, tail = (end - index) / rate, envelope = Math.min(1, age / .012, tail / .04);
      samples[index] = (samples[index] ?? 0) + .16 * (note.velocity / 100) * envelope * Math.sin(2 * Math.PI * frequency * age);
    }
  }
  const buffer = new ArrayBuffer(44 + length * 2), view = new DataView(buffer);
  const write = (offset: number, text: string) => [...text].forEach((char, index) => view.setUint8(offset + index, char.charCodeAt(0)));
  write(0, 'RIFF'); view.setUint32(4, 36 + length * 2, true); write(8, 'WAVE'); write(12, 'fmt '); view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); view.setUint16(22, 1, true); view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
  view.setUint16(32, 2, true); view.setUint16(34, 16, true); write(36, 'data'); view.setUint32(40, length * 2, true);
  for (let index = 0; index < length; index++) view.setInt16(44 + index * 2, Math.max(-1, Math.min(1, samples[index] ?? 0)) * 32767, true);
  return { blob: new Blob([buffer], { type: 'audio/wav' }), durationSeconds: length / rate };
}

export function downloadMidi(bytes: Uint8Array, revision: number) {
  const url = URL.createObjectURL(new Blob([new Uint8Array(bytes)], { type: 'audio/midi' })), link = document.createElement('a');
  try {
    link.href = url; link.download = `score-draft-r${revision}.mid`; document.body.append(link); link.click();
  } finally { link.remove(); setTimeout(() => URL.revokeObjectURL(url), 60000); }
}
