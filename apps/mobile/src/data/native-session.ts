import * as Crypto from 'expo-crypto';
import * as SQLite from 'expo-sqlite';
import { fetch as expoFetch } from 'expo/fetch';

import { createMobileSession, type LocalStore } from './session';

let database: Promise<SQLite.SQLiteDatabase> | undefined;
function openDatabase() {
  if (!database) database = SQLite.openDatabaseAsync('shengjian-mobile-v1.db').then(async db => {
    try { await db.execAsync('CREATE TABLE IF NOT EXISTS local_state (id INTEGER PRIMARY KEY CHECK (id = 1), document TEXT NOT NULL)'); return db; }
    catch (error) { await db.closeAsync(); throw error; }
  }).catch(error => { database = undefined; throw error; });
  return database;
}
const store: LocalStore = {
  load: async () => {
    const db = await openDatabase();
    const row = await db.getFirstAsync<{ document: string }>('SELECT document FROM local_state WHERE id = 1');
    return row ? JSON.parse(row.document) : null;
  },
  save: async value => {
    const saved = JSON.stringify(value);
    const db = await openDatabase();
    await db.withExclusiveTransactionAsync(async txn => {
      await txn.runAsync('INSERT INTO local_state (id, document) VALUES (1, ?) ON CONFLICT(id) DO UPDATE SET document = excluded.document', saved);
    });
  },
};

export function createNativeSession() {
  return createMobileSession({
    store,
    random: {
      uuid: () => Crypto.randomUUID(),
    },
    fetch: request => expoFetch(request, { redirect: 'error' }),
    socket: (url, headers, observer) => {
      // Expo's shared DOM typings omit RN's supported third header argument.
      const NativeSocket = WebSocket as typeof WebSocket & {
        new(url: string, protocols: null, options: { headers: Record<string, string> }): WebSocket;
      };
      const socket = new NativeSocket(url, null, { headers: { ...headers } });
      socket.onmessage = event => observer.message(event.data);
      socket.onclose = event => observer.close(event.code);
      return { close: () => { socket.onmessage = null; socket.onclose = null; socket.close(); } };
    },
  });
}
