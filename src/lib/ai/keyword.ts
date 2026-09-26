import type { IncidentType, Severity } from "@/types";
import type { Classifier } from "./types";

/**
 * Last-resort classifier when every AI provider is unavailable or over budget.
 * Matches English / Filipino / Cebuano keywords. Confidence is always 0, so the
 * report always goes to human review — this only helps sort the review queue.
 */

const TYPE_KEYWORDS: Record<Exclude<IncidentType, "other">, string[]> = {
  fire: ["fire", "burning", "smoke", "flames", "sunog", "nasunog", "kalayo", "usok", "aso", "apoy", "nagliyab"],
  flood: ["flood", "flooding", "water level", "submerged", "baha", "binaha", "nagbaha", "lunop", "nalunop", "tubig", "apaw", "ulan"],
  landslide: ["landslide", "mudslide", "erosion", "rockfall", "guho", "gumuho", "pagguho", "pagdahili", "yuta", "lupa"],
  road_accident: ["accident", "crash", "collision", "vehicle", "motorcycle", "car", "bus", "truck", "banggaan", "nabangga", "bangga", "naligsan", "disgrasya", "aksidente", "sakyanan", "motor"],
  structural_damage: ["collapse", "collapsed", "building", "crack", "cracked", "wall", "roof", "bridge", "natumba", "nahugno", "guba", "nagun-ob", "nabungkag", "gibaon", "bilding", "pader", "atop", "tulay", "taytayan"],
  medical_emergency: ["injured", "injury", "bleeding", "blood", "unconscious", "heart attack", "not breathing", "seizure", "nasamad", "samad", "dugo", "nagdugo", "sugat", "nakuyapan", "himatay", "nahimatay", "sakit", "masakiton", "nasugatan"],
  fallen_debris: ["fallen tree", "tree", "debris", "branch", "power line", "electric post", "kahoy", "natumba", "punoan", "puno", "sanga", "poste", "kable", "linya sa kuryente"],
};

const SEVERITY_KEYWORDS: Array<[Severity, string[]]> = [
  ["critical", ["dead", "death", "died", "killed", "trapped", "not breathing", "many people", "explosion", "patay", "namatay", "nangamatay", "natabunan", "nalubong", "daghang tawo", "napiit", "buhi", "tabang", "saklolo"]],
  ["high", ["injured", "bleeding", "blood", "unconscious", "spreading", "rising", "stranded", "chest deep", "nasamad", "dugo", "nagdugo", "nasugatan", "nakuyapan", "nahimatay", "misaka", "abot hawak", "abot dughan", "kusog", "grabe", "dako"]],
  ["moderate", ["damaged", "blocked", "knee deep", "nasira", "guba", "naguba", "babag", "nababagan", "abot tuhod"]],
];

/** Default severity per type when no severity keyword matches. */
const DEFAULT_SEVERITY: Record<IncidentType, Severity> = {
  fire: "high",
  medical_emergency: "high",
  structural_damage: "moderate",
  landslide: "moderate",
  flood: "moderate",
  road_accident: "moderate",
  fallen_debris: "low",
  other: "low",
};

const normalize = (text: string) => ` ${text.toLowerCase().normalize("NFKD").replace(/[^\p{L}\p{N}\s-]/gu, " ").replace(/\s+/g, " ")} `;
const matches = (text: string, words: string[]) => words.filter((w) => text.includes(` ${w} `));

/** Severity from description keywords, else the default for the incident type. */
export function severityFromText(description: string, incidentType: IncidentType) {
  const text = normalize(description);
  const match = SEVERITY_KEYWORDS.find(([, words]) => matches(text, words).length > 0);
  return { severity: match?.[0] ?? DEFAULT_SEVERITY[incidentType], from: match ? ("keyword" as const) : ("type_default" as const) };
}

/** Hazard words mentioned in the description, across all incident types. */
export function hazardsFromText(description: string) {
  const text = normalize(description);
  return [...new Set(Object.values(TYPE_KEYWORDS).flatMap((words) => matches(text, words)))].slice(0, 10);
}

export const keywordClassifier: Classifier = {
  model: "keyword-fallback",
  async classify({ description }) {
    const text = normalize(description);

    let incidentType: IncidentType = "other";
    let best = 0;
    const hazards: string[] = [];
    for (const [type, words] of Object.entries(TYPE_KEYWORDS) as [IncidentType, string[]][]) {
      const found = matches(text, words);
      hazards.push(...found);
      if (found.length > best) {
        best = found.length;
        incidentType = type;
      }
    }

    const { severity, from } = severityFromText(description, incidentType);

    return {
      incidentType,
      severity,
      confidence: 0,
      hazards: [...new Set(hazards)].slice(0, 10),
      // Keyword matching can't judge intent; every report already goes to review regardless.
      hoaxSuspected: false,
      raw: { matchedWords: [...new Set(hazards)], severityFrom: from },
      latencyMs: 0,
      costUsd: 0,
    };
  },
};
