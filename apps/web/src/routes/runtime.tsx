import { createFileRoute } from '@tanstack/react-router';
import { Runtime } from '../features/runtime/Runtime';
export const Route = createFileRoute('/runtime')({ component: Runtime });
