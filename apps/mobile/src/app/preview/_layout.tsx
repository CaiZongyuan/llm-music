import { Stack } from 'expo-router/stack';
import { colors } from '@/constants/theme';
import { PreviewProvider } from '../../../../../docs/previews/mobile-workbench-v1/model';

export default function PreviewLayout() {
  return <PreviewProvider>
    <Stack.Screen options={{ headerShown: false }} />
    <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background }, headerTintColor: colors.text,
      contentStyle: { backgroundColor: colors.background }, headerShadowVisible: false }}>
      <Stack.Screen name="index" options={{ title: '声间 · 我的项目' }} />
      <Stack.Screen name="connect" options={{ title: '连接电脑' }} />
      <Stack.Screen name="new" options={{ title: '新建项目' }} />
      <Stack.Screen name="project" options={{ title: '项目' }} />
      <Stack.Screen name="tools" options={{ title: '预览工具' }} />
    </Stack>
  </PreviewProvider>;
}
