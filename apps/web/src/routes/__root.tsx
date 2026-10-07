import { createRootRouteWithContext, Link } from '@tanstack/react-router';
import type { QueryClient } from '@tanstack/react-query';
import { AppShell } from '../components/AppShell';
import { ErrorNotice } from '../components/States';
import { useMessages } from '../features/preferences/Preferences';
import { shellMessages } from '../components/messages';

function NotFound() {
  const t = useMessages(shellMessages);
  return <section className="surface empty"><h1>{t.missing}</h1><p>{t.missingBody}</p><Link className="button primary" to="/">{t.home}</Link></section>;
}
export const Route = createRootRouteWithContext<{ queryClient: QueryClient }>()({
  component: AppShell, notFoundComponent: NotFound,
  errorComponent: ({ error, reset }) => <ErrorNotice error={error} onRetry={reset} />,
});
