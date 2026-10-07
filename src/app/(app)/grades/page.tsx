import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdult } from "@/lib/household";
import { Card, CollapsibleCard, EmptyState, PageHeader } from "@/components/ui";
import { format } from "date-fns";
import { GRADE_PAY, GRADE_RULES, buildProgress, formatMoney, round2, weeklyStanding } from "@/lib/grades";
import { loadPlanState } from "@/lib/grades-data";
import CheckinUploader from "./checkin-uploader";
import { markGradeAwardPaid } from "./actions";
import { CapEditor, ClosePlanButton, MissingCountEditor, NewPlanForm } from "./plan-forms";
import ProgressList from "./progress-list";
import CashOwed from "../chores/cash-owed";

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
      <PageHeader title="Grades" subtitle="Upload PowerSchool once a week. The app tells you what you owe." />

      {!!(members ?? []).filter((m) => m.role === "kid").length && (
        <p className="mb-4 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-slate-500">
          See what they see:
          {(members ?? [])
            .filter((m) => m.role === "kid")
            .map((m) => (
              <Link key={m.id} href={`/preview/${m.id}`} className="font-medium text-teal-600 hover:underline">
                {m.display_name}&rsquo;s dashboard
              </Link>
            ))}
        </p>
      )}

      <CashOwed householdId={household.householdId} />

      {activePlans.map((plan, i) => {
        const state = activeStates[i];
        const name = nameById.get(plan.member_id) ?? "Student";
        const progress = buildProgress(state.baseline, state.latest);
        const weeklyCap = plan.weekly_cap ?? GRADE_RULES.weeklyCap;
        // The latest report's payout, and anything still unpaid from before it.
        const weeklyAwards = state.awards.filter((a) => a.kind === "weekly");
        const latestReport = weeklyAwards.length ? weeklyAwards[weeklyAwards.length - 1] : null;
        const earlierOwed = round2(
          state.awards
            .filter((a) => !a.paid_at && a.dollars > 0 && a.id !== latestReport?.id)
            .reduce((sum, a) => sum + a.dollars, 0)
        );
        const standing = weeklyStanding(progress, 0, weeklyCap);
        return (
          <Card key={plan.id} className="mb-6">
            <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
              <h2 className="text-base font-semibold text-slate-900">
                {name} <span className="text-sm font-normal text-slate-400">· {plan.label}</span>
              </h2>
              <span className="text-sm font-medium text-slate-600">
                {formatMoney(state.earnedDollars)} of ${plan.cash_cap} earned this quarter
              </span>
            </div>

            {progress.length ? (
              <div className="mb-4">
                <ProgressList rows={progress} />
                <p className="mt-2 text-xs text-slate-400">
                  Last check-in {state.lastCheckinOn}. At these grades, your next weekly upload adds about {formatMoney(standing.dollars)} (up to $
                  {weeklyCap} a week). Quarter-end: ${GRADE_RULES.cleanSheet} if every class is at a C or better.
                </p>
              </div>
            ) : (
              <p className="mb-4 text-sm text-slate-500">No grades yet — upload the first check-in to set the starting point.</p>
            )}

            {state.checkinCount > 0 && (
              <div className="mb-3">
                <MissingCountEditor
                  planId={plan.id}
                  current={state.missingCounts.length ? state.missingCounts[state.missingCounts.length - 1].count : null}
                />
              </div>
            )}

            <CheckinUploader
              planId={plan.id}
              studentName={name}
              isFirstCheckin={state.checkinCount === 0}
              lastMissing={state.missingCounts.length ? state.missingCounts[state.missingCounts.length - 1].count : null}
            />

            <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-3">
              <CapEditor planId={plan.id} cap={plan.cash_cap} weeklyCap={weeklyCap} />
              {state.checkinCount > 0 && <ClosePlanButton planId={plan.id} />}
            </div>

            <div className="mt-4 rounded-lg bg-emerald-50 px-4 py-3">
              {latestReport ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-slate-800">
                      {latestReport.paid_at ? "Paid for this report" : "Owed for this report"}
                      {latestReport.taken_on && (
                        <span className="ml-2 text-xs font-normal text-slate-500">
                          {format(new Date(`${latestReport.taken_on}T00:00:00`), "MMM d")}
                        </span>
                      )}
                    </p>
                    <div className="flex items-center gap-3">
                      <span className="text-lg font-bold text-emerald-700">{formatMoney(latestReport.dollars)}</span>
                      {!latestReport.paid_at && (
                        <form action={markGradeAwardPaid}>
                          <input type="hidden" name="id" value={latestReport.id} />
                          <button className="rounded-lg bg-emerald-600 px-3 py-1 text-xs font-semibold text-white hover:bg-emerald-700">
                            Mark paid
                          </button>
                        </form>
                      )}
                    </div>
                  </div>
                  {latestReport.description && <p className="mt-1 text-xs text-slate-500">{latestReport.description}</p>}
                  {earlierOwed > 0 && (
                    <p className="mt-1 text-xs font-medium text-emerald-800">
                      Plus {formatMoney(earlierOwed)} still unpaid from earlier reports.
                    </p>
                  )}
                </>
              ) : (
                <p className="text-sm text-slate-600">Nothing owed yet. Upload a report and save it to see what you owe for it.</p>
              )}
            </div>
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
          <li>Upload her PowerSchool grades once a week. Every upload pays for each class by the grade it has that day.</li>
          <li>
            Grades below a C- cost money, which offsets the strong classes. A week never goes below $0: they never owe you, and nothing carries
            over. A grade that drops just pays less; nothing is taken back from weeks already paid.
          </li>
          <li>
            Missing work: each upload has a box for how many assignments are missing right now. ${GRADE_RULES.missingTurnedIn} for each one the
            total drops by since the last number you entered.
          </li>
          <li>When you close the quarter, ${GRADE_RULES.cleanSheet} more if every class is at a C or better.</li>
        </ul>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-700">
          {GRADE_PAY.map((g) => (
            <span key={g.letter} className={g.dollars < 0 ? "text-red-700" : ""}>
              <span className="font-medium">{g.letter}</span> {formatMoney(g.dollars)}
            </span>
          ))}
        </div>
        <p className="mt-2 text-xs text-slate-400">
          Per class, per week. Percentages count as A+ 97+, A 93+, A- 90+, B+ 87+, B 83+, B- 80+, C+ 77+, C 73+, C- 70+, D+ 67+, D 63+, D- 60+, F+ 55+, F 50+, F- under 50. It all shows up in Cash to
          pay out above. Total payouts never go past each plan&rsquo;s weekly and quarterly caps.
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
                <span className="text-slate-500">{formatMoney(closedStates[i].earnedDollars)}</span>
              </div>
            ))}
          </div>
        </CollapsibleCard>
      )}
    </div>
  );
}
