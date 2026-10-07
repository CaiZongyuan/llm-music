import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from '@tanstack/react-router';
import { QueryClientProvider } from '@tanstack/react-query';
import { PreferencesProvider } from './features/preferences/Preferences';
import { createQueryClient } from './lib/query-client';
import { createAppRouter } from './router';
import './styles.css';

const queryClient = createQueryClient();
const router = createAppRouter(queryClient);
const root = document.getElementById('root');
if (!root) throw new Error('Missing application root');
createRoot(root).render(<StrictMode><PreferencesProvider><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></PreferencesProvider></StrictMode>);
