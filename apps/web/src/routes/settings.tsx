import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '../features/runtime/Settings';
import { PairingPanel } from '../features/mobile-pairing/PairingPanel';
function SettingsPage() { return <><Settings /><PairingPanel /></>; }
export const Route = createFileRoute('/settings')({ component: SettingsPage });
