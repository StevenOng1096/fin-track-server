/**
 * Comma-separated list in CLIENT_URL, e.g.
 * http://localhost:3001,https://finance-tracker-prod-65qx.vercel.app
 */
export function getAllowedOrigins(): string[] {
  const raw = process.env.CLIENT_URL ?? 'http://localhost:3001';
  return raw
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);
}
