import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import type { CurrentHousehold } from "@/lib/household";
import { EmptyState, PageHeader } from "@/components/ui";
import { GRADE_PAY, GRADE_RULES, buildProgress, formatMoney, groundedStatus, round2, weeklyStanding } from "@/lib/grades";
import { loadPlanState } from "@/lib/grades-data";
import GroundedBanner from "./grounded-banner";
import ProgressList from "./progress-list";

/** A kid's own grades page: where each class stands, what it's paying, and what's owed to them. */
export default async function KidGrades({ household }: { household: CurrentHousehold }) {
  const supabase = await createClient();

  const { data: plan } = await supabase
    .from("grade_plans")
    .select("*")
    .eq("household_id", household.householdId)
    .eq("member_id", household.memberId)
    .eq("status", "active")
    .limit(1)
    .maybeSingle();

  const state = plan ? await loadPlanState(supabase, plan.id) : null;
  const progress = state ? buildProgress(state.baseline, state.latest) : [];

  if (!plan || !state || !progress.length) {
    return (
      <div>
        <PageHeader title="Your Grades" subtitle="Where each class stands and what it's earning." />
        <EmptyState message="No grades yet. Once your parents add your first report, your classes will show up here." />
        <p className="mt-4 text-center text-xs">
          <Link href="/grade-contract" className="font-medium text-teal-600 hover:underline">
            📄 Read the grade agreement
          </Link>
        </p>
      </div>
    );
  }

  const weeklyCap = plan.weekly_cap ?? GRADE_RULES.weeklyCap;
  const pace = weeklyStanding(progress, 0, weeklyCap).dollars;
  // What's been earned and isn't paid yet (held pay isn't owed until she's back under the limit).
  const owedNow = round2(
    state.awards.filter((a) => !a.paid_at && !a.held && !a.forfeited && a.dollars > 0).reduce((sum, a) => sum + a.dollars, 0)
  );
  const underC = progress.filter((r) => r.underC).length;

  return (
    <div>
      <PageHeader title="Your Grades" subtitle={`${plan.label} · updated ${state.lastCheckinOn ?? "soon"}`} />

      <div className="mb-4 grid grid-cols-3 gap-3">
        <div className="rounded-2xl border-2 border-teal-100 bg-white p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">This week&rsquo;s pace</p>
          <p className="text-xl font-bold text-teal-700">{formatMoney(pace)}</p>
        </div>
        <div className="rounded-2xl border-2 border-teal-100 bg-white p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Owed to you</p>
          <p className="text-xl font-bold text-emerald-700">{formatMoney(owedNow)}</p>
        </div>
        <div className="rounded-2xl border-2 border-teal-100 bg-white p-3 text-center shadow-sm">
          <p className="text-xs uppercase tracking-wide text-slate-400">Paid so far</p>
          <p className="text-xl font-bold text-slate-700">{formatMoney(state.paidDollars)}</p>
        </div>
      </div>

      <GroundedBanner status={groundedStatus(progress)} name={household.displayName} audience="kid" />

      {state.heldDollars > 0 && (
        <p className="mb-4 rounded-lg bg-amber-50 px-4 py-2 text-sm text-amber-900">
          💰 {formatMoney(state.heldDollars)} is on hold. You get it as soon as you&rsquo;re back to {GRADE_RULES.maxBelowCMinus} or fewer classes below a
          C-.
        </p>
      )}

      <div className="rounded-2xl border-2 border-teal-100 bg-white p-3 shadow-sm">
        <ProgressList rows={progress} />
      </div>

      {state.missingCounts.length > 0 && (
        <p className="mt-3 px-1 text-sm text-slate-600">
          Missing assignments: <span className="font-semibold">{state.missingCounts[state.missingCounts.length - 1].count}</span>. You earn{" "}
          {formatMoney(GRADE_RULES.missingTurnedIn)} for each one you turn in.
        </p>
      )}

      <div className="mt-4 rounded-2xl bg-slate-50 p-4 text-sm text-slate-600">
        <p className="mb-1 font-semibold text-slate-800">How it pays</p>
        <p>
          Every class pays each week by its grade: {GRADE_PAY.filter((g) => g.dollars > 0).map((g) => `${g.letter} ${formatMoney(g.dollars)}`).join(" · ")}.
          Under a C- takes money off ({GRADE_PAY.filter((g) => g.dollars < 0).map((g) => `${g.letter} ${formatMoney(g.dollars)}`).join(", ")}), but
          your week never goes below $0.
        </p>
        <p className="mt-2">
          Quarter bonus: {formatMoney(GRADE_RULES.cleanSheet)} if every class is a C or better
          {underC > 0 ? ` — ${underC} to go.` : " — you're there!"}
        </p>
        <p className="mt-2">
          <Link href="/grade-contract" className="font-medium text-teal-600 hover:underline">
            📄 Read the grade agreement
          </Link>
        </p>
      </div>
    </div>
  );
}
