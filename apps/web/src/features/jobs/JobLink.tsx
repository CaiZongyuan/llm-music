import type { ReactNode } from 'react';
import { useRouter } from '@tanstack/react-router';

// Result routes are owned by sibling features. A built href keeps this boundary
// independent of their route compilation while preserving the persistent Player.
export function JobLink({ href, children, onSelect }: { href: string; children: ReactNode; onSelect?: () => void }) {
  const router = useRouter({ warn: false });
  return <a className="inline-link" href={href} onClick={event => {
    if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey || event.altKey || (!router && !onSelect)) return;
    event.preventDefault();
    if (onSelect) onSelect(); else void router.navigate({ href });
  }}>{children}</a>;
}
