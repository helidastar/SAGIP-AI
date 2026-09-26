import type { ReportStatus } from "@/types";

/**
 * The incident workflow in plain words: who acts at each step and what they do next.
 * The AI only suggests (step 1); every decision after that is made by a person.
 */
export interface WorkflowStep {
  key: string;
  label: string;
  /** Who acts at this step */
  actor: string;
  statuses: ReportStatus[];
  /** Short label for list rows */
  next: string;
  /** Longer explanation for the incident page */
  explain: string;
}

export const WORKFLOW: WorkflowStep[] = [
  {
    key: "ai",
    label: "AI classifies",
    actor: "AI (automatic)",
    statuses: ["received"],
    next: "AI working",
    explain: "The AI is reading the photo and description. This usually takes a few seconds; no action needed.",
  },
  {
    key: "review",
    label: "Review",
    actor: "Any staff",
    statuses: ["pending_review"],
    next: "Needs review",
    explain:
      "The AI was unsure, or rated this high/critical, so a person must confirm or correct its answer before the incident is ranked. Reject it if it is not a real incident.",
  },
  {
    key: "assign",
    label: "Assign team",
    actor: "Admin",
    statuses: ["classified"],
    next: "Assign a team",
    explain: "The type and severity are confirmed and the incident is ranked. An admin now chooses which team responds.",
  },
  {
    key: "respond",
    label: "Team responds",
    actor: "Assigned team",
    statuses: ["assigned", "in_progress"],
    next: "Team responding",
    explain: "The assigned team starts the response, then marks it resolved when done. An admin can reassign it to another team.",
  },
  {
    key: "done",
    label: "Resolved",
    actor: "—",
    statuses: ["resolved"],
    next: "Resolved",
    explain: "The incident is closed. It can be reopened if the response continues.",
  },
];

export function stepFor(status: string) {
  return WORKFLOW.find((s) => (s.statuses as string[]).includes(status));
}

/** Plain-language button labels for status changes. */
export const TRANSITION_LABELS: Record<string, string> = {
  in_progress: "Start response",
  resolved: "Mark resolved",
  assigned: "Back to assigned",
  rejected: "Reject incident",
};

/** Statuses an admin can assign (or reassign) a team from; matches the assign API. */
export const ASSIGNABLE_STATUSES = ["classified", "assigned", "in_progress"];
