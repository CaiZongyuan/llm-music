import { Redirect } from 'expo-router';
import { useMobileSession } from '@/data/provider';

export default function MobileHome() {
  const { state } = useMobileSession();
  return <Redirect href={state.server ? '/workbench' : '/connect'} />;
}
