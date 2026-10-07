import { createFileRoute } from '@tanstack/react-router';
import { Library } from '../features/projects/Library';
export const Route = createFileRoute('/')({ component: Library });
