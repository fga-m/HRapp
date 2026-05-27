export const CRITERIA = [
  { key: "job_knowledge",  label: "Job Knowledge & Skills" },
  { key: "quality",        label: "Quality of Work" },
  { key: "productivity",   label: "Productivity & Efficiency" },
  { key: "communication",  label: "Communication" },
  { key: "teamwork",       label: "Teamwork & Collaboration" },
  { key: "initiative",     label: "Initiative & Problem Solving" },
  { key: "reliability",    label: "Attendance & Reliability" },
] as const;

export type CriterionKey = (typeof CRITERIA)[number]["key"];

export const SCORE_LABELS: Record<number, string> = {
  1: "Needs Improvement",
  2: "Developing",
  3: "Meeting Expectations",
  4: "Exceeding Expectations",
  5: "Outstanding",
};

export function getPeriodLabel(year: number, periodType: "mid_year" | "end_of_year"): string {
  return periodType === "mid_year" ? `Mid-Year ${year}` : `End-of-Year ${year}`;
}

export type EvaluationData = {
  scores: Record<string, number>;
  comments: Record<string, string>;
  overall: string;
  goals: string;
};
