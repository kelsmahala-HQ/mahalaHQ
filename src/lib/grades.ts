// Weekly grade pay. Every upload pays each class by the grade it has that day (A+ pays the most,
// anything under a C- costs money), so a grade that drops simply pays less -- nothing to claw back, nothing to track. Everything
// here is pure (no I/O) so the Grades page, the kid dashboard, and the server actions all compute
// from the same rules.

export const GRADE_RULES = {
  missingTurnedIn: 1, // per missing assignment the kid's total dropped since the last count
  weeklyCap: 25, // default most one kid can earn from a single week's upload (editable per plan)
  cleanSheet: 15, // quarter-end: every class at a C or better
  maxBelowCMinus: 3, // more classes than this under a C- and they stay in until it's back down
} as const;

/**
 * Dollars per class per week by grade, best first. Grades below a C- cost money, which offsets the
 * strong classes -- but a week's total never goes below $0 (see weeklyStanding). minPercent turns a
 * percentage into a letter.
 */
export const GRADE_PAY = [
  { letter: "A+", dollars: 3, minPercent: 97 },
  { letter: "A", dollars: 2.75, minPercent: 93 },
  { letter: "A-", dollars: 2.25, minPercent: 90 },
  { letter: "B+", dollars: 2, minPercent: 87 },
  { letter: "B", dollars: 1.75, minPercent: 83 },
  { letter: "B-", dollars: 1.25, minPercent: 80 },
  { letter: "C+", dollars: 1, minPercent: 77 },
  { letter: "C", dollars: 0.5, minPercent: 73 },
  { letter: "C-", dollars: 0.25, minPercent: 70 },
  { letter: "D+", dollars: -1, minPercent: 67 },
  { letter: "D", dollars: -1.25, minPercent: 63 },
  { letter: "D-", dollars: -1.75, minPercent: 60 },
  { letter: "F+", dollars: -2, minPercent: 55 },
  { letter: "F", dollars: -2.25, minPercent: 50 },
  { letter: "F-", dollars: -3, minPercent: 0 },
] as const;

const C_INDEX = GRADE_PAY.findIndex((g) => g.letter === "C");
const F_INDEX = GRADE_PAY.findIndex((g) => g.letter === "F+");
const C_MINUS_INDEX = GRADE_PAY.findIndex((g) => g.letter === "C-");

export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** $3, $2.75, $0.50 -- whole dollars without cents, anything else with two decimals (Venmo-friendly). */
export function formatMoney(n: number): string {
  const v = round2(Math.abs(n));
  const body = Number.isInteger(v) ? `$${v}` : `$${v.toFixed(2)}`;
  return n < 0 ? `-${body}` : body;
}

/** "94" or "94.5%" becomes a letter via the percent cutoffs; "C-" is used as-is. Anything else is null. */
export function gradeLetter(grade: string): string | null {
  const g = grade.trim().toUpperCase();
  const pct = g.match(/^(\d{1,3}(?:\.\d+)?)\s*%?$/);
  if (pct) {
    const value = Number(pct[1]);
    return GRADE_PAY.find((p) => value >= p.minPercent)?.letter ?? "F";
  }
  return GRADE_PAY.some((p) => p.letter === g) ? g : null;
}

function letterIndex(letter: string): number {
  return GRADE_PAY.findIndex((p) => p.letter === letter);
}

export function classKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type ClassGrade = { name: string; grade: string };

export type ClassProgress = {
  name: string;
  baseGrade: string;
  latestGrade: string;
  /** The letter the latest grade works out to (a percentage is converted). */
  letter: string | null;
  trend: "up" | "down" | "same";
  failing: boolean;
  /** Below a C right now -- what the quarter-end bonus is waiting on. */
  underC: boolean;
  /** Below a C- (D+ or worse) -- what counts toward the stay-in-until-it's-fixed limit. */
  belowCMinus: boolean;
  /** Dollars this class pays (or costs, if negative) per week at its current grade. */
  weeklyDollars: number;
  /** The next grade up that would raise this class's pay, and by how much. */
  next: { label: string; dollars: number } | null;
};

/** One row per class for the Grades page and the kid's dashboard card. */
export function buildProgress(baseline: Map<string, ClassGrade>, latest: Map<string, ClassGrade>): ClassProgress[] {
  const rows: ClassProgress[] = [];
  for (const [key, now] of latest) {
    const then = baseline.get(key) ?? now;
    const nowLetter = gradeLetter(now.grade);
    const thenLetter = gradeLetter(then.grade);
    if (!nowLetter || !thenLetter) {
      rows.push({
        name: now.name,
        baseGrade: then.grade,
        latestGrade: now.grade,
        letter: nowLetter,
        trend: "same",
        failing: false,
        underC: false,
        belowCMinus: false,
        weeklyDollars: 0,
        next: null,
      });
      continue;
    }

    const nowIdx = letterIndex(nowLetter);
    const thenIdx = letterIndex(thenLetter);
    const pay = GRADE_PAY[nowIdx].dollars;
    const showPercent = /^\d/.test(now.grade.trim());

    // A class that's costing money points at the first grade that stops costing (C-); otherwise
    // the nearest better grade that actually pays more than this one does now.
    let next: ClassProgress["next"] = null;
    if (pay < 0) {
      const target = GRADE_PAY[C_MINUS_INDEX];
      next = {
        label: `Reach ${target.letter}${showPercent ? ` (${target.minPercent}%)` : ""}`,
        dollars: round2(target.dollars - pay),
      };
    } else {
      for (let i = nowIdx - 1; i >= 0; i--) {
        if (GRADE_PAY[i].dollars > pay) {
          const target = GRADE_PAY[i];
          next = {
            label: `Reach ${target.letter}${showPercent ? ` (${target.minPercent}%)` : ""}`,
            dollars: round2(target.dollars - pay),
          };
          break;
        }
      }
    }

    rows.push({
      name: now.name,
      baseGrade: then.grade,
      latestGrade: now.grade,
      letter: nowLetter,
      trend: nowIdx < thenIdx ? "up" : nowIdx > thenIdx ? "down" : "same",
      failing: nowIdx >= F_INDEX,
      underC: nowIdx > C_INDEX,
      belowCMinus: nowIdx > C_MINUS_INDEX,
      weeklyDollars: pay,
      next,
    });
  }
  return rows;
}

/** What this week's grades are worth, capped, with a one-line description of where it came from. */
export function weeklyStanding(
  progress: ClassProgress[],
  missingTurnedIn = 0,
  weeklyCap: number = GRADE_RULES.weeklyCap
): { dollars: number; description: string } {
  const counted = progress.filter((p) => p.weeklyDollars !== 0);
  const missingDollars = missingTurnedIn * GRADE_RULES.missingTurnedIn;
  const raw = counted.reduce((sum, p) => sum + p.weeklyDollars, 0) + missingDollars;
  // Low grades subtract from the strong ones, but the week never goes below $0 -- they never owe.
  const dollars = round2(Math.max(0, Math.min(raw, weeklyCap)));
  const parts = counted.map((p) => `${p.name} ${formatMoney(p.weeklyDollars)}`);
  if (missingDollars > 0) {
    parts.push(`${missingTurnedIn} missing assignment${missingTurnedIn === 1 ? "" : "s"} turned in ${formatMoney(missingDollars)}`);
  }
  const description = parts.length ? `Weekly grades: ${parts.join(", ")}` : "Weekly grades";
  return { dollars, description };
}

/** Quarter-end: every graded class at a C or better. */
export function cleanSheetEarned(latest: Map<string, ClassGrade>): boolean {
  if (!latest.size) return false;
  for (const g of latest.values()) {
    const letter = gradeLetter(g.grade);
    if (!letter) continue;
    if (letterIndex(letter) > C_INDEX) return false;
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

/**
 * The house rule: more than maxBelowCMinus classes under a C- and they don't go anywhere until
 * it's back down. This is about privileges, not money -- it never changes what a week pays.
 */
export function groundedStatus(progress: ClassProgress[]): {
  grounded: boolean;
  count: number;
  limit: number;
  names: string[];
} {
  const names = progress.filter((p) => p.belowCMinus).map((p) => p.name);
  const limit = GRADE_RULES.maxBelowCMinus;
  return { grounded: names.length > limit, count: names.length, limit, names };
}
