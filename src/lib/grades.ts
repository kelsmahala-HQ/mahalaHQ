// Grade-improvement rewards. Pays for movement, not for the grade itself: a kid acing Spanish
// shouldn't out-earn a kid who rescued a failing class. Everything here is pure (no I/O) so the
// Grades page, the kid dashboard, and the server actions all compute from the same rules.

/** Dollar value of each award. Points = dollars * the plan's points_per_dollar. */
export const GRADE_RULES = {
  rescue: 10, // failing -> passing, once per class
  climb: 3, // each step up from where the class started (or from passing), per step
  hold: 2, // a class that started at B- / 80% or better and is still there at quarter's end
  cleanSheet: 15, // every class at C or better at quarter's end
} as const;

// PowerSchool shows Bailee's high-school classes as percentages and Mayla's elementary ones as
// letters, so a "level" is either (percent / 5) or an index into this ladder.
const LETTERS = ["F", "D-", "D", "D+", "C-", "C", "C+", "B-", "B", "B+", "A-", "A", "A+"];

type Scale = "percent" | "letter";
const THRESHOLDS: Record<Scale, { pass: number; clean: number; hold: number; max: number }> = {
  percent: { pass: 12, clean: 14, hold: 16, max: 20 }, // 60%, 70%, 80%, 100%
  letter: { pass: 1, clean: 5, hold: 7, max: 12 }, // D-, C, B-, A+
};

/** The bar for the quarter-end "no grade below a C" bonus. */
export function cleanSheetLabel(scale: Scale): string {
  return levelLabel(scale, THRESHOLDS[scale].clean);
}

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

export function passingLabel(scale: Scale): string {
  return levelLabel(scale, THRESHOLDS[scale].pass);
}

export function classKey(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, "");
}

export type ClassGrade = { name: string; grade: string };

export type AwardDraft = {
  kind: "rescue" | "climb" | "hold" | "clean_sheet";
  class_name: string | null;
  award_key: string;
  dollars: number;
  description: string;
};

/**
 * What a plan should pay right now that it hasn't paid before. `baseline` is each class's first
 * recorded grade, `latest` its most recent. Awards are permanent once paid (alreadyAwarded keys),
 * so a grade that dips and recovers can't be paid twice. `final` adds the quarter-end awards.
 * Everything is clipped to remainingDollars -- the plan's cash cap.
 */
export function computeAwards(opts: {
  baseline: Map<string, ClassGrade>;
  latest: Map<string, ClassGrade>;
  alreadyAwarded: Set<string>;
  remainingDollars: number;
  final: boolean;
}): AwardDraft[] {
  const drafts: AwardDraft[] = [];
  let allAtC = opts.latest.size > 0;

  for (const [key, now] of opts.latest) {
    const then = opts.baseline.get(key) ?? now;
    const nowLevel = parseGrade(now.grade);
    const thenLevel = parseGrade(then.grade);
    if (!nowLevel || !thenLevel || nowLevel.scale !== thenLevel.scale) continue;

    const t = THRESHOLDS[nowLevel.scale];
    if (nowLevel.level < t.clean) allAtC = false;

    if (thenLevel.level < t.pass && nowLevel.level >= t.pass && !opts.alreadyAwarded.has(`rescue:${key}`)) {
      drafts.push({
        kind: "rescue",
        class_name: now.name,
        award_key: `rescue:${key}`,
        dollars: GRADE_RULES.rescue,
        description: `${now.name}: up to passing`,
      });
    }

    const from = Math.max(thenLevel.level, t.pass);
    for (let n = 1; from + n <= nowLevel.level; n++) {
      if (opts.alreadyAwarded.has(`climb:${key}:${n}`)) continue;
      drafts.push({
        kind: "climb",
        class_name: now.name,
        award_key: `climb:${key}:${n}`,
        dollars: GRADE_RULES.climb,
        description: `${now.name}: up to ${levelLabel(nowLevel.scale, from + n)}`,
      });
    }

    if (opts.final && thenLevel.level >= t.hold && nowLevel.level >= t.hold && !opts.alreadyAwarded.has(`hold:${key}`)) {
      drafts.push({
        kind: "hold",
        class_name: now.name,
        award_key: `hold:${key}`,
        dollars: GRADE_RULES.hold,
        description: `${now.name}: held at ${levelLabel(nowLevel.scale, t.hold)} or better`,
      });
    }
  }

  if (opts.final && allAtC && !opts.alreadyAwarded.has("clean_sheet")) {
    drafts.push({
      kind: "clean_sheet",
      class_name: null,
      award_key: "clean_sheet",
      dollars: GRADE_RULES.cleanSheet,
      description: "Every class at a C or better",
    });
  }

  const order = { rescue: 0, climb: 1, hold: 2, clean_sheet: 3 } as const;
  drafts.sort((a, z) => order[a.kind] - order[z.kind]);

  let remaining = opts.remainingDollars;
  const clipped: AwardDraft[] = [];
  for (const d of drafts) {
    if (remaining <= 0) break;
    const dollars = Math.min(d.dollars, remaining);
    remaining -= dollars;
    clipped.push({ ...d, dollars });
  }
  return clipped;
}

export type ClassProgress = {
  name: string;
  baseGrade: string;
  latestGrade: string;
  trend: "up" | "down" | "same";
  failing: boolean;
  next: { dollars: number; label: string } | null;
};

/** One row per class for the Grades page and the kid's dashboard card, incl. the next milestone. */
export function buildProgress(
  baseline: Map<string, ClassGrade>,
  latest: Map<string, ClassGrade>,
  alreadyAwarded: Set<string>
): ClassProgress[] {
  const rows: ClassProgress[] = [];
  for (const [key, now] of latest) {
    const then = baseline.get(key) ?? now;
    const nowLevel = parseGrade(now.grade);
    const thenLevel = parseGrade(then.grade);
    if (!nowLevel || !thenLevel || nowLevel.scale !== thenLevel.scale) {
      rows.push({ name: now.name, baseGrade: then.grade, latestGrade: now.grade, trend: "same", failing: false, next: null });
      continue;
    }

    const t = THRESHOLDS[nowLevel.scale];
    const failing = nowLevel.level < t.pass;
    let next: ClassProgress["next"] = null;

    if (failing && !alreadyAwarded.has(`rescue:${key}`)) {
      next = { dollars: GRADE_RULES.rescue, label: `Get to passing (${passingLabel(nowLevel.scale)})` };
    } else {
      const from = Math.max(thenLevel.level, t.pass);
      let n = 1;
      while (alreadyAwarded.has(`climb:${key}:${n}`)) n++;
      const target = from + n;
      if (target <= t.max && target > nowLevel.level) {
        next = { dollars: GRADE_RULES.climb, label: `Reach ${levelLabel(nowLevel.scale, target)}` };
      }
    }

    rows.push({
      name: now.name,
      baseGrade: then.grade,
      latestGrade: now.grade,
      trend: nowLevel.level > thenLevel.level ? "up" : nowLevel.level < thenLevel.level ? "down" : "same",
      failing,
      next,
    });
  }
  return rows;
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
