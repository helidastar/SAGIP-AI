/**
 * Finds the API key for a provider in the same env variables the app uses (src/lib/ai/chain.ts),
 * so scripts work with the normal .env.local:
 *   1. the explicit variable, e.g. GEMINI_API_KEY
 *   2. AI_API_KEY when AI_PROVIDER is this provider (primary slot)
 *   3. AI_FALLBACK_API_KEY when AI_FALLBACK_PROVIDER is this provider (fallback slot; Gemini since 2026-10-25)
 */
export function providerKey(
  provider: string,
  explicitVar: string,
  env: Record<string, string | undefined> = process.env,
): string | undefined {
  return (
    env[explicitVar] ||
    (env.AI_PROVIDER === provider ? env.AI_API_KEY : undefined) ||
    (env.AI_FALLBACK_PROVIDER === provider ? env.AI_FALLBACK_API_KEY : undefined) ||
    undefined
  );
}
