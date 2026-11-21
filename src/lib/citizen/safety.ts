import type { IncidentType } from "@/types";

/**
 * Short safety steps shown to the citizen after a report (Citizen Portal 4).
 * General first-aid style guidance only; it never replaces calling 911 or following responders.
 */
export const SAFETY_TIPS: Record<IncidentType, string[]> = {
  fire: [
    "Get everyone out and stay out. Do not go back for belongings.",
    "Stay low under smoke and cover your nose and mouth with a cloth.",
    "Call 911 or the Bureau of Fire Protection if no one has yet.",
  ],
  flood: [
    "Move to higher ground. Do not walk or drive through moving water.",
    "Turn off electricity at the main switch if you can do it safely.",
    "Stay away from canals, rivers and open drains.",
  ],
  landslide: [
    "Move away from the slope and the path of the slide.",
    "Watch for more falling soil, rocks or cracked ground.",
    "Do not return until officials say the area is safe.",
  ],
  road_accident: [
    "Keep a safe distance from traffic and warn other drivers.",
    "Do not move injured people unless there is fire or other danger.",
    "Call 911 and tell them how many people are hurt.",
  ],
  structural_damage: [
    "Leave the building and stay clear of walls, glass and posts that may fall.",
    "Do not use elevators or enter a damaged building.",
    "If you smell gas, leave right away and do not use flames or switches.",
  ],
  medical_emergency: [
    "Call 911 now if the person is not breathing, unconscious or bleeding heavily.",
    "Press firmly on bleeding with a clean cloth.",
    "Stay with the person and keep them still and warm until help comes.",
  ],
  fallen_debris: [
    "Stay away from fallen trees, poles and wires. Treat every wire as live.",
    "Warn others and keep vehicles away from the blocked area.",
    "Do not try to cut or move large debris yourself.",
  ],
  other: [
    "Move to a safe place away from the danger.",
    "Keep others, especially children, away from the area.",
    "Call 911 if anyone is in danger right now.",
  ],
};

/** Used while the report type is not known yet. */
export const GENERAL_TIPS = [
  "If anyone is in danger right now, call 911. This report does not replace a call.",
  "Move to a safe place and keep others away from the danger.",
  "Keep your phone on so you can check your report's status.",
];

export function safetyTipsFor(type: IncidentType | null | undefined): string[] {
  return type && type in SAFETY_TIPS ? SAFETY_TIPS[type] : GENERAL_TIPS;
}
