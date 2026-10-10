import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { MobileSessionProvider } from '@/data/provider';

export default function RootLayout() {
  return (
    <MobileSessionProvider>
      <StatusBar style="light" />
      <Stack screenOptions={{
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        contentStyle: { backgroundColor: colors.background },
      }}>
        <Stack.Screen name="index" options={{ title: '声间 · 初始化' }} />
        <Stack.Screen name="connect" options={{ title: '声间 · 连接电脑' }} />
        <Stack.Screen name="preview" options={{ headerShown: false }} />
      </Stack>
    </MobileSessionProvider>
  );
}
