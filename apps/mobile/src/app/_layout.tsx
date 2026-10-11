import { Stack } from 'expo-router/stack';
import { StatusBar } from 'expo-status-bar';

import { colors } from '@/constants/theme';
import { MobileSessionProvider } from '@/data/provider';
import { MobileMediaProvider } from '@/media';
import { WorkbenchMediaBridge } from '@/screens/workbench/media-bridge';

export default function RootLayout() {
  return (
    <MobileSessionProvider>
      <MobileMediaProvider>
        <WorkbenchMediaBridge>
          <StatusBar style="light" />
          <Stack screenOptions={{
            headerStyle: { backgroundColor: colors.background },
            headerTintColor: colors.text,
            contentStyle: { backgroundColor: colors.background },
          }}>
            <Stack.Screen name="index" options={{ headerShown: false }} />
            <Stack.Screen name="connect" options={{ title: '声间 · 连接电脑' }} />
            <Stack.Screen name="workbench" options={{ headerShown: false }} />
            <Stack.Screen name="preview" options={{ headerShown: false }} />
          </Stack>
        </WorkbenchMediaBridge>
      </MobileMediaProvider>
    </MobileSessionProvider>
  );
}
