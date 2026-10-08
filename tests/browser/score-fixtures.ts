import { randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { createMusicClient } from '@llm-music/api-client';
import { expect, type Page } from '@playwright/test';

export const ABC = 'X:1\nT:\nM:4/4\nL:1/8\nQ:1/4=96\nV: Vocal clef=treble name="Vocal Melody" snm="Vocal"\nV: Ins clef=treble name="Ins Melody" snm="Inst."\nK:C\n% verse\nV: Vocal\nz8 | z8 | z8 | z8 |\nV: Ins\nC D E F G2 E2 | F E D C D4 | E F G A G2 E2 | D E F D C4 |';
export const EDITED_ABC = ABC.replace('C D E F G2 E2', 'G A B c d2 B2');
export const NEXT_ABC = ABC.replace('C D E F G2 E2', 'A B c d e2 c2');

export function received<T>(result: { data?: T; response: Response }): T {
  expect(result.response.ok).toBe(true);
  if (result.data === undefined) throw new Error('Missing public API response');
  return result.data;
}

export async function projectOnly(baseURL: string | undefined) {
  if (!baseURL) throw new Error('Missing owned Web URL');
  const api = createMusicClient({ baseUrl: `${baseURL}/api` });
  const project = received(await api.POST('/projects', { body: { name: `Score edit · ${randomUUID().slice(0, 8)}` } }));
  return { api, project };
}

export async function seed(baseURL: string | undefined) {
  const { api, project } = await projectOnly(baseURL);
  const score = received(await api.POST('/projects/{project_id}/scores', { params: { path: { project_id: project.id } }, body: { abc: ABC } }));
  return { api, project, score };
}

export async function downloadMidi(page: Page, label = 'Export draft MIDI') {
  const event = page.waitForEvent('download');
  await page.getByRole('button', { name: label, exact: true }).click();
  const download = await event;
  expect(await download.failure()).toBeNull();
  const path = await download.path();
  if (!path) throw new Error('Missing native MIDI download');
  return readFile(path);
}

// Independent SMF inspection at the downloaded-file boundary. Expected music
// below is a worked ABC example; no production decoder is imported here.
export function inspectMidi(bytes: Buffer) {
  expect(bytes.toString('ascii', 0, 4)).toBe('MThd');
  const headerLength = bytes.readUInt32BE(4), division = bytes.readUInt16BE(12);
  expect(division & 0x8000).toBe(0);
  expect(division).toBeGreaterThan(0);
  const notes: { tick: number; pitch: number }[] = [];
  const tempos: { tick: number; microseconds: number }[] = [];
  const meters: { numerator: number; denominator: number }[] = [];
  let offset = 8 + headerLength;
  for (let track = 0; track < bytes.readUInt16BE(10); track++) {
    expect(bytes.toString('ascii', offset, offset + 4)).toBe('MTrk');
    const limit = offset + 8 + bytes.readUInt32BE(offset + 4);
    expect(limit).toBeLessThanOrEqual(bytes.length);
    offset += 8;
    let tick = 0, status = 0, ended = false;
    const byte = () => { if (offset >= limit) throw new Error('Truncated SMF event'); return bytes[offset++]!; };
    const vlq = () => {
      let value = 0;
      for (let i = 0; i < 4; i++) { const part = byte(); value = value * 128 + (part & 127); if (part < 128) return value; }
      throw new Error('Invalid SMF variable-length quantity');
    };
    while (offset < limit) {
      tick += vlq();
      let message = byte();
      if (message < 128) { offset--; message = status; } else if (message < 240) status = message;
      if (message === 255) {
        const type = byte(), length = vlq();
        expect(offset + length).toBeLessThanOrEqual(limit);
        if (type === 81) tempos.push({ tick, microseconds: bytes.readUIntBE(offset, length) });
        if (type === 88) meters.push({ numerator: bytes[offset]!, denominator: 2 ** bytes[offset + 1]! });
        if (type === 47) ended = true;
        offset += length;
      } else if (message === 240 || message === 247) { const length = vlq(); offset += length; }
      else {
        expect(message).toBeGreaterThanOrEqual(128);
        const first = byte(), kind = message & 240;
        const second = kind === 192 || kind === 208 ? 0 : byte();
        if (kind === 144 && second > 0) notes.push({ tick, pitch: first });
      }
    }
    expect(ended).toBe(true);
    expect(offset).toBe(limit);
  }
  expect(offset).toBe(bytes.length);
  notes.sort((a, b) => a.tick - b.tick);
  expect(tempos).toEqual([{ tick: 0, microseconds: 625000 }]);
  return { division, tempos, meters, notes: notes.map(note => ({ pitch: note.pitch, start: note.tick / division * .625 })) };
}

export function expectMusic(bytes: Buffer, edited = false) {
  const facts = inspectMidi(bytes);
  expect(facts.meters).toEqual([{ numerator: 4, denominator: 4 }]);
  const pitches = edited ? [67, 69, 71, 72, 74, 71] : [60, 62, 64, 65, 67, 64];
  expect(facts.notes.map(note => note.pitch)).toEqual([...pitches, 65, 64, 62, 60, 62, 64, 65, 67, 69, 67, 64, 62, 64, 65, 62, 60]);
  const starts = [0, .3125, .625, .9375, 1.25, 1.875, 2.5, 2.8125, 3.125, 3.4375, 3.75, 5, 5.3125, 5.625, 5.9375, 6.25, 6.875, 7.5, 7.8125, 8.125, 8.4375, 8.75];
  expect(facts.notes.map(note => note.start)).toEqual(starts);
  return facts;
}

export async function inspectAudition(page: Page) {
  await expect.poll(() => page.locator('#persistent-player audio').evaluate((audio: HTMLAudioElement) => audio.currentTime)).toBeGreaterThan(.05);
  const bytes = Buffer.from(await page.locator('#persistent-player audio').evaluate(async (audio: HTMLAudioElement) => {
    const response = await fetch(audio.currentSrc);
    return [...new Uint8Array(await response.arrayBuffer())];
  }));
  expect(bytes.toString('ascii', 0, 4)).toBe('RIFF');
  expect(bytes.toString('ascii', 8, 12)).toBe('WAVE');
  expect(bytes.readUInt16LE(20)).toBe(1); // Native PCM
  expect(bytes.readUInt16LE(22)).toBe(1);
  const sampleRate = bytes.readUInt32LE(24);
  expect(sampleRate).toBe(16000);
  expect(bytes.readUInt16LE(34)).toBe(16);
  const duration = bytes.readUInt32LE(40) / 2 / sampleRate;
  expect(duration).toBe(10.2);
  // Linear interpolation between positive zero crossings avoids a frequency
  // tolerance determined by the length of an integer-count sample window.
  const crossings: number[] = [];
  for (let index = Math.ceil(.05 * sampleRate); index < .25 * sampleRate; index++) {
    const before = bytes.readInt16LE(44 + (index - 1) * 2), after = bytes.readInt16LE(44 + index * 2);
    if (before <= 0 && after > 0) crossings.push(index - 1 - before / (after - before));
  }
  expect(crossings.length).toBeGreaterThan(40);
  const frequency = (crossings.length - 1) * sampleRate / (crossings.at(-1)! - crossings[0]!);
  const state = await page.locator('#persistent-player audio').evaluate((audio: HTMLAudioElement) => ({ duration: audio.duration, time: audio.currentTime, paused: audio.paused, error: audio.error?.code ?? null, source: audio.currentSrc }));
  expect(state.paused).toBe(false);
  expect(state.error).toBeNull();
  expect(state.duration).toBeCloseTo(duration, 4);
  return { frequency, sampleRate, duration, state, bytes };
}
