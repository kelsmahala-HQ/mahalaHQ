import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import { GRADE_RULES, buildProgress, cleanSheetLabel } from "@/lib/grades";
import { loadPlanState } from "@/lib/grades-data";
import CheckinUploader from "./checkin-uploader";
import { ClosePlanButton, NewPlanForm } from "./plan-forms";
import ProgressList from "./progress-list";

export default async function GradesPage() {
  const household = await requireAdult();
  const supabase = await createClient();

  const [{ data: members }, { data: plans }] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, display_name, role")
      .eq("household_id", household.householdId)
      .neq("role", "sitter")
      .order("display_name"),
    supabase.from("grade_plans").select("*").eq("household_id", household.householdId).order("created_at", { ascending: false }),
  ]);

  const nameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));
  const activePlans = (plans ?? []).filter((p) => p.status === "active");
  const closedPlans = (plans ?? []).filter((p) => p.status === "closed");
  const membersWithoutPlan = (members ?? []).filter((m) => !activePlans.some((p) => p.member_id === m.id));

  const activeStates = await Promise.all(activePlans.map((p) => loadPlanState(supabase, p.id)));
  const closedStates = await Promise.all(closedPlans.map((p) => loadPlanState(supabase, p.id)));

  return (
    <div>
      <PageHeader title="Grades" subtitle="Upload PowerSchool, pay for improvement — not just for the grade." />

      {activePlans.map((plan, i) => {
        const state = activeStates[i];
        const name = nameById.get(plan.member_id) ?? "Student";
        const progress = buildProgress(state.baseline, state.latest, state.awardedKeys);
        return (
          <Card key={plan.id} className="mb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {name} <span className="text-sm font-normal text-slate-400">· {plan.label}</span>
              </h2>
              <span className="text-sm font-medium text-slate-600">
                ${state.earnedDollars} of ${plan.cash_cap} earned · ⭐ {state.earnedPoints}
              </span>
            </div>

            {progress.length ? (
              <div className="mb-4">
                <ProgressList rows={progress} pointsPerDollar={plan.points_per_dollar} />
                <p className="mt-2 text-xs text-slate-400">
                  Last check-in {state.lastCheckinOn}. Quarter-end: ⭐ {GRADE_RULES.cleanSheet * plan.points_per_dollar} if every class is at{" "}
                  a C or better, plus ⭐ {GRADE_RULES.hold * plan.points_per_dollar} for each class that started at B- or better and held.
                </p>
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No grades yet — upload the first check-in to set the starting point.</p>
            )}

            <CheckinUploader planId={plan.id} studentName={name} isFirstCheckin={state.checkinCount === 0} />

            {state.checkinCount > 0 && (
              <div className="mt-4 border-t border-slate-100 pt-3">
                <ClosePlanButton planId={plan.id} />
              </div>
            )}
          </Card>
        );
      })}

      {!activePlans.length && <EmptyState message="No active grade plans yet — start one below." />}

      {!!membersWithoutPlan.length && (
        <CollapsibleCard title="Start a grade plan" className="mb-6">
          <NewPlanForm members={membersWithoutPlan.map((m) => ({ id: m.id, display_name: m.display_name }))} />
        </CollapsibleCard>
      )}

      <Card className="mb-6 !bg-slate-50">
        <h2 className="mb-2 text-sm font-semibold text-slate-700">How payouts work</h2>
        <ul className="space-y-1 text-sm text-slate-600">
          <li>
            <span className="font-medium">Rescue</span> — a failing class (under 60% or an F) gets to passing: ${GRADE_RULES.rescue}.
          </li>
          <li>
            <span className="font-medium">Climb</span> — each step up (one letter step, or 5 percentage points) from where the class
            started: ${GRADE_RULES.climb}.
          </li>
          <li>
            <span className="font-medium">Hold</span> — a class that started at B- (80%) or better and is still there when you close the
            quarter: ${GRADE_RULES.hold} each.
          </li>
          <li>
            <span className="font-medium">Every class at a C or better</span> ({cleanSheetLabel("letter")} / {cleanSheetLabel("percent")}) when you close
            the quarter: ${GRADE_RULES.cleanSheet}.
          </li>
        </ul>
        <p className="mt-2 text-xs text-slate-400">
          Each award pays once per quarter, even if a grade dips and comes back. Total payouts never go past the plan&rsquo;s cap. Points land in
          their normal rewards balance.
        </p>
      </Card>

      {!!closedPlans.length && (
        <CollapsibleCard title="Past quarters" className="mb-6">
          <div className="space-y-1">
            {closedPlans.map((plan, i) => (
              <div key={plan.id} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="text-slate-900">
                  {nameById.get(plan.member_id) ?? "Student"} <span className="text-slate-400">· {plan.label}</span>
                </span>
                <span className="text-slate-500">
                  ${closedStates[i].earnedDollars} · ⭐ {closedStates[i].earnedPoints}
                </span>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
