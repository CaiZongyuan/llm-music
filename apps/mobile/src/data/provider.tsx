import { createContext, use, useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { ActivityIndicator, AppState, Text, View } from 'react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import { colors, spacing } from '@/constants/theme';
import { createNativeSession } from './native-session';

type MobileSession = ReturnType<typeof createNativeSession>;
const SessionContext = createContext<MobileSession | null>(null);

export function MobileSessionProvider({ children }: { children: ReactNode }) {
  const [session] = useState(createNativeSession);
  const [queries] = useState(() => new QueryClient({ defaultOptions: {
    queries: { retry: false, staleTime: 5000 }, mutations: { retry: false, networkMode: 'always' },
  } }));
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  useEffect(() => {
    void session.hydrate().then(() => { if (AppState.currentState !== 'active') void session.setForeground(false); });
    const lifecycle = AppState.addEventListener('change', next => { void session.setForeground(next === 'active').catch(() => {}); });
    return () => { lifecycle.remove(); session.suspend(); };
  }, [session]);
  return <QueryClientProvider client={queries}><SessionContext value={session}>
    {state.hydrated ? children : <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center', gap: spacing.medium, backgroundColor: colors.background }}>
      <ActivityIndicator color={colors.accent} /><Text style={{ color: colors.text }}>正在读取手机上的连接与草稿…</Text>
    </View>}
  </SessionContext></QueryClientProvider>;
}

export function useMobileSession() {
  const session = use(SessionContext);
  if (!session) throw new Error('MobileSessionProvider is missing');
  return { session, state: useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot) };
}
