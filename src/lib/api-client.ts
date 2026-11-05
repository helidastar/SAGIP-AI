/** Tiny browser fetch helper for the test UI. Never throws; check `ok`. */
export async function api<T = unknown>(path: string, init: RequestInit & { json?: unknown } = {}) {
  const { json, ...rest } = init;
  const headers = new Headers(rest.headers);
  if (json !== undefined) headers.set("content-type", "application/json");

  try {
    const res = await fetch(path, { ...rest, headers, body: json !== undefined ? JSON.stringify(json) : rest.body });
    const text = await res.text();
    let data: unknown = null;
    try { data = text ? JSON.parse(text) : null; } catch { data = text; }
    const error = !res.ok ? ((data as { error?: string })?.error ?? `Request failed (${res.status})`) : null;
    return { ok: res.ok, status: res.status, data: data as T, error };
  } catch (err) {
    return { ok: false, status: 0, data: null as T, error: err instanceof Error ? err.message : "Network error" };
  }
}
