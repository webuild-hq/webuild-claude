/**
 * N'accepte qu'un chemin relatif à notre site, pour éviter les redirections ouvertes
 * (par exemple ?next=https://site-malveillant.com ou ?next=//site-malveillant.com).
 */
export function safeNextPath(next: string | null | undefined, fallback = "/"): string {
  if (!next || !next.startsWith("/") || next.startsWith("//") || next.startsWith("/\\")) {
    return fallback;
  }
  return next;
}
