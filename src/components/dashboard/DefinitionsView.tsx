"use client";

import { useState } from "react";
import {
  CONFIDENCE_THRESHOLD,
  INCIDENT_TYPES,
  PRIORITY_WEIGHTS,
  REPORT_STATUSES,
  SEVERITY,
  TYPE_WEIGHTS,
} from "@/lib/constants";
import { PRIORITY_BANDS } from "@/lib/scoring";
import styles from "@/components/dashboard/DefinitionsView.module.css";

/** Staff legend: every label, band and weight the dashboard uses, read from the same constants the app scores with. */

const TYPE_NOTES: Record<(typeof INCIDENT_TYPES)[number], string> = {
  fire: "Fire or smoke from a building, vehicle or grass.",
  flood: "Water over roads, homes or fields.",
  landslide: "Soil, rock or mud that has slid or is about to.",
  road_accident: "Vehicle crash or collision on a road.",
  structural_damage: "Collapsed or cracked building, wall, bridge or post.",
  medical_emergency: "A person who is hurt, unconscious or needs care now.",
  fallen_debris: "Fallen tree, branch, wire or object blocking a way.",
  other: "Anything that fits none of the types above.",
};

const SEVERITY_NOTES: Record<keyof typeof SEVERITY, string> = {
  low: "Minor, no immediate danger to life.",
  moderate: "Property damage or possible danger; response needed soon.",
  high: "Active danger to people or major property; urgent.",
  critical: "Life-threatening, possible mass casualties; immediate.",
};

const STATUS_NOTES: Record<(typeof REPORT_STATUSES)[number], string> = {
  received: "Saved; the AI has not drafted a result yet.",
  pending_review: "AI draft ready; waiting for a staff member to confirm it.",
  classified: "Type and severity confirmed by staff and ranked.",
  assigned: "A response team has been assigned.",
  in_progress: "The team is responding.",
  resolved: "The incident is closed.",
  rejected: "Staff found it is not a real incident (never done by the AI).",
};

const FACTOR_NOTES: Record<keyof typeof PRIORITY_WEIGHTS, { label: string; note: string }> = {
  severity: { label: "Severity", note: "Confirmed severity tier, low = 1/4 up to critical = 4/4." },
  population: { label: "Population", note: "People living in the report's area, 0 to 1." },
  locationRisk: { label: "Location risk", note: "Area risk index, 0 to 1." },
  type: { label: "Incident type", note: "Type weight from the table above." },
};

const pct = (n: number) => `${Math.round(n * 100)}%`;
const label = (s: string) => s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, " ");

const TABS = [
  { key: "types", label: "Types" },
  { key: "severity", label: "Severity" },
  { key: "score", label: "Score" },
  { key: "check", label: "Check first" },
  { key: "status", label: "Statuses" },
] as const;

type TabKey = (typeof TABS)[number]["key"];

export function DefinitionsView() {
  const [tab, setTab] = useState<TabKey>("types");
  const bands = [...PRIORITY_BANDS];
  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Definitions</h1>

      <div className={styles.tabs} role="tablist" aria-label="Definitions">
        {TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            role="tab"
            id={`def-tab-${t.key}`}
            aria-selected={tab === t.key}
            aria-controls="def-panel"
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <section className={styles.card} id="def-panel" role="tabpanel" aria-labelledby={`def-tab-${tab}`}>
        {tab === "types" && (
          <table>
            <thead><tr><th>Type</th><th>Meaning</th><th>Weight</th></tr></thead>
            <tbody>
              {INCIDENT_TYPES.map((t) => (
                <tr key={t}><td>{label(t)}</td><td>{TYPE_NOTES[t]}</td><td>{TYPE_WEIGHTS[t].toFixed(2)}</td></tr>
              ))}
            </tbody>
          </table>
        )}

        {tab === "severity" && (
          <>
            <table>
              <thead><tr><th>Level</th><th>Value</th><th>Meaning</th></tr></thead>
              <tbody>
                {(Object.keys(SEVERITY) as (keyof typeof SEVERITY)[]).map((s) => (
                  <tr key={s}><td><span className={`${styles.chip} ${styles[s]}`}>{label(s)}</span></td><td>{SEVERITY[s]}</td><td>{SEVERITY_NOTES[s]}</td></tr>
                ))}
              </tbody>
            </table>
            <p className={styles.note}>
              The % next to severity (for example &quot;High · 82%&quot;) is how sure the AI is. It does not change the score.
            </p>
          </>
        )}

        {tab === "score" && (
          <>
            <p>Score = 100 × each factor (0 to 1) × its weight, added up. A fixed formula, not an AI guess.</p>
            <div className={styles.split}>
              <table>
                <thead><tr><th>Factor</th><th>Weight</th><th>Input</th></tr></thead>
                <tbody>
                  {(Object.keys(PRIORITY_WEIGHTS) as (keyof typeof PRIORITY_WEIGHTS)[]).map((k) => (
                    <tr key={k}><td>{FACTOR_NOTES[k].label}</td><td>{PRIORITY_WEIGHTS[k].toFixed(2)}</td><td>{FACTOR_NOTES[k].note}</td></tr>
                  ))}
                </tbody>
              </table>
              <table>
                <thead><tr><th>Band</th><th>Name</th><th>Score</th></tr></thead>
                <tbody>
                  {bands.map((b, i) => (
                    <tr key={b.band}><td>{b.band}</td><td>{b.label}</td><td>{i === 0 ? `${b.min} to 100` : `${b.min} to below ${bands[i - 1].min}`}</td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === "check" && (
          <>
            <p>Every report is confirmed by a person. These only move a report to the top of the review queue.</p>
            <ol>
              <li>AI is less than {pct(CONFIDENCE_THRESHOLD)} sure of the type or severity.</li>
              <li>AI says high or critical.</li>
              <li>AI suspects a hoax (staff decide, never automatic).</li>
              <li>AI was offline and the keyword matcher answered.</li>
            </ol>
          </>
        )}

        {tab === "status" && (
          <table>
            <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
            <tbody>
              {REPORT_STATUSES.map((s) => (
                <tr key={s}><td>{label(s)}</td><td>{STATUS_NOTES[s]}</td></tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
