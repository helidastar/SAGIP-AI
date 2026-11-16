"use client";

import { useSyncExternalStore } from "react";

/** A report submitted from this device. There are no accounts, so the browser remembers the codes. */
export interface SavedReport {
  code: string;
  title: string;
  location: string | null;
  createdAt: string;
}

const KEY = "sagip.reports.v1";
const EMPTY: SavedReport[] = [];
const listeners = new Set<() => void>();

let cachedRaw: string | null | undefined;
let cachedValue: SavedReport[] = EMPTY;

function read(): SavedReport[] {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedValue;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as SavedReport[]) : EMPTY;
    cachedValue = Array.isArray(parsed) ? parsed : EMPTY;
  } catch {
    cachedValue = EMPTY;
  }
  return cachedValue;
}

export function saveReport(report: SavedReport) {
  const next = [report, ...read().filter((r) => r.code !== report.code)].slice(0, 50);
  try {
    window.localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage blocked (private mode). The report still exists; the code is on the confirmation screen.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    window.removeEventListener("storage", cb);
  };
}

export function useSavedReports(): SavedReport[] {
  return useSyncExternalStore(subscribe, read, () => EMPTY);
}
