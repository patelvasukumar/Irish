/**
 * Picks the platform folder at build time.
 * Metro loads platform.web.ts / platform.android.ts / platform.ios.ts first;
 * this file is the fallback (and what TypeScript reads for types).
 */
export { platform } from '@platforms/web/dependent';
