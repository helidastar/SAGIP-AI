import { Card } from "./ui";
import { safetyTipsFor } from "@/lib/citizen/safety";
import type { IncidentType } from "@/types";

/** Safety steps for the report's incident type, or general steps while the type is unknown. */
export function SafetyTips({ type }: { type: IncidentType | null }) {
  const tips = safetyTipsFor(type);
  return (
    <Card>
      <h3 className="mb-2 font-display text-base font-semibold">Stay safe while you wait</h3>
      <ul className="list-disc space-y-1 pl-5 text-sm text-cz-text">
        {tips.map((tip) => <li key={tip}>{tip}</li>)}
      </ul>
      <p className="mt-3 text-xs text-cz-text-2">Emergency hotline: <a href="tel:911" className="font-semibold text-cz-link hover:underline">911</a>. Always follow responders and local officials.</p>
    </Card>
  );
}
