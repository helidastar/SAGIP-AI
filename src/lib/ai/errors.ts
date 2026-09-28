import Anthropic from "@anthropic-ai/sdk";

/** Transient = worth retrying: rate limits, server errors, timeouts, network failures. Not 4xx or bad JSON. */
export function isTransientError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Our timeout aborts the request. The Anthropic SDK reports that as APIUserAbortError (no status).
  if (err instanceof Anthropic.APIUserAbortError || err.constructor.name === "APIUserAbortError" || err.name === "AbortError" || err.name === "TimeoutError") return true;
  if (err instanceof Anthropic.APIConnectionError) return true; // includes connection timeouts
  // fetch() network failures surface as TypeError("fetch failed")
  if (err instanceof TypeError && /fetch failed|network/i.test(err.message)) return true;

  // Anthropic APIError and Gemini ApiError both expose a numeric `status`.
  const status = (err as { status?: unknown }).status;
  return typeof status === "number" && (status === 408 || status === 429 || status >= 500);
}

export function describeError(err: unknown) {
  if (err instanceof Error) {
    const status = (err as { status?: unknown }).status;
    return { name: err.name, message: err.message.slice(0, 500), ...(typeof status === "number" ? { status } : {}) };
  }
  return { name: "Unknown", message: String(err).slice(0, 500) };
}
