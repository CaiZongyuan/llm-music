// The pinned self-contained browser bundle can be retried after a failed load.
// Native ESM import failures are cached for the lifetime of the page.
type ABCJS = typeof import('abcjs');
const bundleUrl = new URL('../../../node_modules/abcjs/dist/abcjs-basic-min.js', import.meta.url).href;
let loading: Promise<ABCJS> | null = null;
let attempt = 0;

function loaded(): ABCJS | undefined {
  return (window as Window & { ABCJS?: ABCJS }).ABCJS;
}

export function loadABCJS(): Promise<ABCJS> {
  const existing = loaded();
  if (existing) return Promise.resolve(existing);
  if (loading) return loading;
  loading = new Promise<ABCJS>((resolve, reject) => {
    const script = document.createElement('script'), url = new URL(bundleUrl, document.baseURI);
    if (attempt) url.searchParams.set('score_retry', String(attempt));
    attempt++;
    script.src = url.href; script.async = true;
    script.onload = () => {
      const library = loaded();
      if (library) resolve(library);
      else { script.remove(); loading = null; reject(new Error('Notation library unavailable')); }
    };
    script.onerror = () => { script.remove(); loading = null; reject(new Error('Notation library unavailable')); };
    document.head.append(script);
  });
  return loading;
}
