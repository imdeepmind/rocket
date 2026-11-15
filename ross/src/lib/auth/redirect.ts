/**
 * Append parameters to a developer-configured redirect target.
 *
 * The target is always config-owned, never client-supplied, which is what makes
 * an allow-list unnecessary: there is no attacker-controlled input to smuggle
 * into the location header.
 */
export function buildRedirectUrl(
  target: string,
  params: Record<string, string | undefined>,
): string {
  const url = new URL(target);

  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) {
      url.searchParams.set(key, value);
    }
  }

  return url.toString();
}
