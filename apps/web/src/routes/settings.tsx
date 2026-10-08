import { createFileRoute } from '@tanstack/react-router';
import { Settings } from '../features/runtime/Settings';
export const Route = createFileRoute('/settings')({ component: Settings });
