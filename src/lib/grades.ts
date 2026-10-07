// Weekly grade pay. Each Wednesday's upload pays for where each class stands *that day* compared
// to where it started the quarter -- a spike that's gone by the next upload simply stops paying,
// and nothing needs clawing back. Everything here is pure (no I/O) so the Grades page, the kid
// dashboard, and the server actions all compute from the same rules.

export const GRADE_RULES = {
  perStep: 1, // dollars per step above where the class started the quarter, per week
  maxStepsPerClass: 4, // a class stops earning more after this many steps up
  weeklyCap: 10, // most one kid can earn from a single week's upload
  cleanSheet: 15, // quarter-end: every class at C or better
} as const;

// PowerSchool shows Bailee's high-school classes as percentages and Mayla's elementary ones as
// letters, so a "level" is either (percent / 5) or an index into this ladder.
const LETTERS = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];

type Scale = "percent" | "letter";
const THRESHOLDS: Record<Scale, { pass: number; clean: number; max: number }> = {
  percent: { pass: 12, clean: 14, max: 20 }, // 60% (passing), C = 70%, 100%
  letter: { pass: 1, clean: 5, max: 12 }, // D- (passing), C, A+
};

export type Level = { level: number; scale: Scale };

/** Parses "94", "94.5%", or "C-" into a comparable level. Anything else (blank, "[i]", "I") is null. */
export function parseGrade(grade: string): Level | null {
  const g = grade.trim().toUpperCase();
  const pct = g.match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/);
  if (pct) return { level: Math.min(20, Math.floor(Number(pct[1]) / 5)), scale: "percent" };
  const idx = LETTERS.indexOf(g);
  return idx >= 0 ? { level: idx, scale: "letter" } : null;
}

export function levelLabel(scale: Scale, level: number): string {
  return scale === "percent" ? `${level * 5}%` : LETTERS[level];
}

/** The bar for the quarter-end "no grade below a C" bonus. */
export function cleanSheetLabel(scale: Scale): string {
  return levelLabel(scale, THRESHOLDS[scale].clean);
}

export function classKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type ClassGrade = { name: string; grade: string };

/** Steps a class is above where it started the quarter (0 if level or below), capped for pay. */
function stepsUp(then: Level, now: Level): number {
  return Math.max(0, now.level - then.level);
}

export type ClassProgress = {
  name: string;
  baseGrade: string;
  latestGrade: string;
  trend: "up" | "down" | "same";
  failing: boolean;
  /** Below a C right now -- what the quarter-end bonus is waiting on. */
  underC: boolean;
  /** Dollars this class earns per week at its current grade. */
  weeklyDollars: number;
  /** The next step that would raise this class's weekly pay, if there is one. */
  next: { label: string; dollars: number } | null;
};

/** One row per class for the Grades page and the kid's dashboard card. */
export function buildProgress(baseline: Map<string, ClassGrade>, latest: Map<string, ClassGrade>): ClassProgress[] {
  const rows: ClassProgress[] = [];
  for (const [key, now] of latest) {
    const then = baseline.get(key) ?? now;
    const nowLevel = parseGrade(now.grade);
    const thenLevel = parseGrade(then.grade);
    if (!nowLevel || !thenLevel || nowLevel.scale !== thenLevel.scale) {
      rows.push({ name: now.name, baseGrade: then.grade, latestGrade: now.grade, trend: "same", failing: false, underC: false, weeklyDollars: 0, next: null });
      continue;
    }

    const t = THRESHOLDS[nowLevel.scale];
    const steps = Math.min(stepsUp(thenLevel, nowLevel), GRADE_RULES.maxStepsPerClass);
    const target = Math.max(nowLevel.level, thenLevel.level) + 1;
    const canEarnMore = steps < GRADE_RULES.maxStepsPerClass && target <= t.max;

    rows.push({
      name: now.name,
      baseGrade: then.grade,
      latestGrade: now.grade,
      trend: nowLevel.level > thenLevel.level ? "up" : nowLevel.level < thenLevel.level ? "down" : "same",
      failing: nowLevel.level < t.pass,
      underC: nowLevel.level < t.clean,
      weeklyDollars: steps * GRADE_RULES.perStep,
      next: canEarnMore ? { label: `Reach ${levelLabel(nowLevel.scale, target)}`, dollars: GRADE_RULES.perStep } : null,
    });
  }
  return rows;
}

/** What this week's standing is worth before the weekly cap, with a one-line description. */
export function weeklyStanding(progress: ClassProgress[]): { dollars: number; description: string } {
  const earners = progress.filter((p) => p.weeklyDollars > 0);
  const raw = earners.reduce((sum, p) => sum + p.weeklyDollars, 0);
  const dollars = Math.min(raw, GRADE_RULES.weeklyCap);
  const description = earners.length
    ? `Weekly grades: ${earners.map((p) => `${p.name} +$${p.weeklyDollars}`).join(", ")}`
    : "Weekly grades";
  return { dollars, description };
}

/** Quarter-end: every graded class at a C or better. */
export function cleanSheetEarned(latest: Map<string, ClassGrade>): boolean {
  if (!latest.size) return false;
  for (const g of latest.values()) {
    const lv = parseGrade(g.grade);
    if (!lv) continue;
    if (lv.level < THRESHOLDS[lv.scale].clean) return false;
  }
  return true;
}

/** Folds entries (oldest first) into each class's first and most recent grade. */
export function baselineAndLatest(entries: { class_name: string; grade: string }[]) {
  const baseline = new Map<string, ClassGrade>();
  const latest = new Map<string, ClassGrade>();
  for (const e of entries) {
    const key = classKey(e.class_name);
    if (!key) continue;
    const point = { name: e.class_name, grade: e.grade };
    if (!baseline.has(key)) baseline.set(key, point);
    latest.set(key, point);
  }
  return { baseline, latest };
}
