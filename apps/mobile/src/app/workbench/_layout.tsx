import { Stack } from 'expo-router/stack';
import { colors } from '@/constants/theme';

export default function WorkbenchLayout() {
  return <Stack screenOptions={{ headerStyle: { backgroundColor: colors.background },
    headerTintColor: colors.text, contentStyle: { backgroundColor: colors.background } }} />;
}
