import { CryptoDigestAlgorithm, digest, randomUUID } from 'expo-crypto';
import { Directory, File, FileMode, Paths } from 'expo-file-system';

import type { AudioWriter } from './types';

export function createNativeAudioCache() {
  const directory = new Directory(Paths.cache, 'shengjian-media-v1');
  return {
    clear: async () => {
      directory.create({ intermediates: true, idempotent: true });
      for (const entry of directory.list()) { if (entry instanceof File && entry.name.endsWith('.flac')) entry.delete(); }
    },
    create: async (): Promise<AudioWriter> => {
      directory.create({ intermediates: true, idempotent: true });
      const file = new File(directory, `${randomUUID()}.flac`);
      file.create();
      const handle = file.open(FileMode.WriteOnly);
      let closed = false;
      const close = () => { if (!closed) { handle.close(); closed = true; } };
      const remove = async () => { close(); if (file.exists) file.delete(); };
      return {
        write: async bytes => { if (closed) throw new Error('Media cache handle is closed'); handle.writeBytes(bytes); },
        finish: async () => {
          close();
          const bytes = await file.bytes();
          const hash = await digest(CryptoDigestAlgorithm.SHA256, bytes);
          return { uri: file.uri, sizeBytes: file.size, sha256: Array.from(new Uint8Array(hash), value => value.toString(16).padStart(2, '0')).join(''), remove };
        },
        discard: remove,
      };
    },
  };
}
