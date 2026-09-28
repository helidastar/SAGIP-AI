"use client";

import { useState } from "react";

/** Tracking code in a dashed box; tap to copy. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS); the code is still visible to write down.
    }
  }

  return (
    <button type="button" onClick={copy} className="flex flex-col items-center gap-1" title="Copy tracking code">
      <span className="border border-dashed border-line px-5 py-2.5 font-mono text-xl font-bold tracking-wider">{code}</span>
      <span className="font-mono text-[10px] text-muted">{copied ? "copied" : "tap to copy"}</span>
    </button>
  );
}
