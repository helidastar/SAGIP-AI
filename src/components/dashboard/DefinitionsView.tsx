"use client";

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

export function DefinitionsView() {
  const bands = [...PRIORITY_BANDS];
  return (
    <div className={styles.page}>
      <header className={styles.header}>
        <p className={styles.overline}>Reference</p>
        <h1>Definitions</h1>
        <p>What each label, band and weight on the dashboard means. Values come from the app&apos;s own settings.</p>
      </header>

      <section className={styles.card} aria-labelledby="def-types">
        <h2 id="def-types">Incident types ({INCIDENT_TYPES.length})</h2>
        <table>
          <thead><tr><th>Type</th><th>Meaning</th><th>Type weight</th></tr></thead>
          <tbody>
            {INCIDENT_TYPES.map((t) => (
              <tr key={t}><td>{label(t)}</td><td>{TYPE_NOTES[t]}</td><td>{TYPE_WEIGHTS[t].toFixed(2)}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card} aria-labelledby="def-severity">
        <h2 id="def-severity">Severity levels ({Object.keys(SEVERITY).length})</h2>
        <table>
          <thead><tr><th>Level</th><th>Value</th><th>Meaning</th></tr></thead>
          <tbody>
            {(Object.keys(SEVERITY) as (keyof typeof SEVERITY)[]).map((s) => (
              <tr key={s}><td><span className={`${styles.chip} ${styles[s]}`}>{label(s)}</span></td><td>{SEVERITY[s]}</td><td>{SEVERITY_NOTES[s]}</td></tr>
            ))}
          </tbody>
        </table>
        <p className={styles.note}>
          <strong>Severity %</strong> (for example &quot;High · 82%&quot;) is the AI&apos;s confidence that its severity level is right.
          It is not a second scale and does not change the priority score. &quot;–&quot; means the classifier gave none (keyword matcher).
        </p>
      </section>

      <section className={styles.card} aria-labelledby="def-score">
        <h2 id="def-score">Priority score (0 to 100)</h2>
        <p>Score = 100 × the sum of each factor (0 to 1) times its weight. It is a fixed formula, not an AI guess, so every score can be explained.</p>
        <table>
          <thead><tr><th>Factor</th><th>Weight</th><th>Input</th></tr></thead>
          <tbody>
            {(Object.keys(PRIORITY_WEIGHTS) as (keyof typeof PRIORITY_WEIGHTS)[]).map((k) => (
              <tr key={k}><td>{FACTOR_NOTES[k].label}</td><td>{PRIORITY_WEIGHTS[k].toFixed(2)}</td><td>{FACTOR_NOTES[k].note}</td></tr>
            ))}
          </tbody>
        </table>
        <h3>Bands</h3>
        <table>
          <thead><tr><th>Band</th><th>Name</th><th>Score</th></tr></thead>
          <tbody>
            {bands.map((b, i) => (
              <tr key={b.band}><td>{b.band}</td><td>{b.label}</td><td>{i === 0 ? `${b.min} to 100` : `${b.min} to below ${bands[i - 1].min}`}</td></tr>
            ))}
          </tbody>
        </table>
      </section>

      <section className={styles.card} aria-labelledby="def-review">
        <h2 id="def-review">Check first (4 triggers)</h2>
        <p>Every report is confirmed by a person. These triggers only move a report to the top of the review queue.</p>
        <ol>
          <li>AI confidence in the type, or in the severity, is below {pct(CONFIDENCE_THRESHOLD)}.</li>
          <li>AI severity is high or critical.</li>
          <li>The AI suspects a hoax. A hoax is never rejected automatically; staff decide.</li>
          <li>The AI services were unavailable and the keyword matcher answered.</li>
        </ol>
      </section>

      <section className={styles.card} aria-labelledby="def-status">
        <h2 id="def-status">Report statuses ({REPORT_STATUSES.length})</h2>
        <table>
          <thead><tr><th>Status</th><th>Meaning</th></tr></thead>
          <tbody>
            {REPORT_STATUSES.map((s) => (
              <tr key={s}><td>{label(s)}</td><td>{STATUS_NOTES[s]}</td></tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
