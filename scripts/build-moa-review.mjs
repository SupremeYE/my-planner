import { build } from 'vite';
import { cp, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

// Fail closed: this branch must never become a Production deployment.
if (process.env.VERCEL_ENV === 'production') {
  throw new Error('Review deployment to Production is forbidden');
}
if (process.env.VERCEL && (process.env.VERCEL_ENV !== 'preview' || process.env.VERCEL_GIT_COMMIT_REF !== 'codex/moamoa-review-preview')) {
  throw new Error('Only the review branch Preview may run this build');
}
await build({ configFile: 'vite.review.config.ts', mode: 'moamoa-review' });
await cp('dist-review/review.html', 'dist-review/index.html');
await writeFile('dist-review/review-disabled.json', JSON.stringify({ error: 'Review only. No server APIs.' }));
for (const name of ['sw.js', 'manifest.json']) await rm(path.join('dist-review', name), { force: true });
console.log('Static review built in dist-review. No API functions or service worker.');
