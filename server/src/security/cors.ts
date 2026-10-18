/**
 * Fail closed for browser clients: production must explicitly declare origins.
 * Requests without Origin (native apps, CLI and server-to-server) are unaffected.
 */
export const corsAllowedOrigins = (raw: string | undefined, isProduction: boolean): string[] => {
  const defaults = isProduction ? '' : 'http://localhost:5173,http://localhost:8081,http://127.0.0.1:5173,http://127.0.0.1:8081';
  return [...new Set((raw ?? defaults).split(',').map(value => value.trim()).filter(Boolean))];
};

export const corsOriginAllowed = (origin: string | undefined, allowed: readonly string[]): boolean =>
  !origin || allowed.includes(origin);
