"use client";

import { useState } from "react";
import { CopyIcon } from "./icons";

/** Tracking code; tap to copy. */
export function CopyCode({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard blocked (e.g. non-HTTPS); the code stays visible to write down.
    }
  }

  return (
    <button type="button" onClick={copy} title="Copy tracking code" className="inline-flex items-center gap-2 rounded border border-dashed border-cz-border-strong bg-cz-surface-2 px-3 py-1.5">
      <span className="font-code text-base font-semibold tracking-wider">{code}</span>
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-cz-link">
        <CopyIcon className="h-3.5 w-3.5" />
        {copied ? "Copied" : "Copy"}
      </span>
    </button>
  );
}
