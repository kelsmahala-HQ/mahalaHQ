import Link from "next/link";
import { redirect } from "next/navigation";
import { format } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, PageHeader } from "@/components/ui";
import { GRADE_PAY, GRADE_RULES, formatMoney } from "@/lib/grades";
import { CONTRACT_VERSION } from "@/lib/grade-contract";
import AgreeButton from "./agree-button";

/**
 * The grade agreement, written out in plain language. Every number comes from the same constants
 * the app pays with (GRADE_PAY / GRADE_RULES) and from each kid's own plan caps, so what's printed
 * here is always what actually happens. Everyone agrees to it individually.
 */
export default async function GradeContractPage() {
  const household = await requireHousehold();
  if (household.role === "sitter") redirect("/dashboard");
  const supabase = await createClient();
  const isKid = household.role === "kid";

  const [{ data: members }, { data: plans }, agreementsResult] = await Promise.all([
    supabase
      .from("household_members")
      .select("id, display_name, role")
      .eq("household_id", household.householdId)
      .neq("role", "sitter")
      .order("display_name"),
    supabase.from("grade_plans").select("member_id, cash_cap, weekly_cap").eq("household_id", household.householdId).eq("status", "active"),
    supabase
      .from("grade_contract_agreements")
      .select("member_id, agreed_at")
      .eq("household_id", household.householdId)
      .eq("version", CONTRACT_VERSION),
  ]);

  // If the agreements table isn't in the database yet, show the contract anyway with no sign-offs.
  const agreements = agreementsResult.error ? [] : (agreementsResult.data ?? []);
  const agreedAt = new Map(agreements.map((a) => [a.member_id, a.agreed_at as string]));
  const nameById = new Map((members ?? []).map((m) => [m.id, m.display_name]));

  const myPlan = (plans ?? []).find((p) => p.member_id === household.memberId);
  const youOrThey = isKid ? "you" : "they";
  const capLines = isKid
    ? myPlan
      ? [{ name: "You", weekly: myPlan.weekly_cap ?? GRADE_RULES.weeklyCap, quarterly: myPlan.cash_cap }]
      : []
    : (plans ?? []).map((p) => ({
        name: nameById.get(p.member_id) ?? "Student",
        weekly: p.weekly_cap ?? GRADE_RULES.weeklyCap,
        quarterly: p.cash_cap,
      }));

  const limit = GRADE_RULES.maxBelowCMinus;

  return (
    <div>
      <PageHeader title="Grade agreement" subtitle="How grades work in our house this marking period." />

      <p className="mb-4 text-sm">
        <Link href={isKid ? "/dashboard" : "/grades"} className="font-medium text-teal-600 hover:underline">
          ← Back to {isKid ? "your dashboard" : "Grades"}
        </Link>
      </p>

      <Card className="mb-6 space-y-5 text-sm leading-relaxed text-slate-700">
        <p>
          Read this, ask any questions, and agree at the bottom. The numbers here come straight from the app, so what you read is exactly
          what gets paid.
        </p>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">The idea</h2>
          <p>
            Good grades take real work, and we want that work to pay off. Once a week we look at {isKid ? "your" : "their"} grades in PowerSchool and{" "}
            {youOrThey} earn money based on where each class stands that day. Higher grades earn more. Falling behind costs a
            little, but {youOrThey} never owe us money.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">What each class pays</h2>
          <p className="mb-2">Per class, per week:</p>
          <div className="flex flex-wrap gap-x-4 gap-y-1">
            {GRADE_PAY.map((g) => (
              <span key={g.letter} className={g.dollars < 0 ? "text-red-700" : "text-slate-800"}>
                <span className="font-semibold">{g.letter}</span> {formatMoney(g.dollars)}
              </span>
            ))}
          </div>
          <p className="mt-2">
            If PowerSchool shows a percentage, it counts as: A+ 97+, A 93+, A- 90+, B+ 87+, B 83+, B- 80+, C+ 77+, C 73+, C- 70+, D+ 67+, D 63+, D- 60+,
            F+ 55+, F 50+, F- under 50.
          </p>
          <p className="mt-2">
            A grade below a C- takes money off. That comes out of what the stronger classes earned, so one tough class can cancel out a good one.
            The most it can ever do is bring the week down to $0. Nobody ever owes anything, and nothing carries over to the next week.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">Missing assignments</h2>
          <p>
            Each week we count how many assignments are missing across all classes. Every time that number goes down from the last count, {youOrThey}{" "}
            earn {formatMoney(GRADE_RULES.missingTurnedIn)} for each assignment turned in.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">End-of-marking-period bonus</h2>
          <p>
            If every class is a C or better when the marking period ends, that&rsquo;s another {formatMoney(GRADE_RULES.cleanSheet)}.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">The limits</h2>
          {capLines.length ? (
            <ul className="list-disc space-y-0.5 pl-5">
              {capLines.map((c) => (
                <li key={c.name}>
                  {c.name}: up to {formatMoney(c.weekly)} in a week and {formatMoney(c.quarterly)} for the whole marking period.
                </li>
              ))}
            </ul>
          ) : (
            <p>
              There&rsquo;s a most that can be earned in a week and in a whole marking period. Those limits are set when {isKid ? "your" : "each"} plan
              starts.
            </p>
          )}
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">The stay-in rule</h2>
          <p>
            If more than {limit} classes are below a C-, {youOrThey} don&rsquo;t go anywhere until it&rsquo;s back down to {limit} or fewer.
            While that&rsquo;s the case, the week&rsquo;s pay is <span className="font-medium">held</span>, not lost. As soon as a weekly report shows{" "}
            {isKid ? "you" : "them"} back at {limit} or fewer, everything that was held is released and added to what&rsquo;s owed. If the marking period
            ends while it&rsquo;s still being held, that money is forfeited.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">How you get paid</h2>
          <p>
            Payments are sent by Venmo. What&rsquo;s earned adds up in the app after each weekly report, and your parents mark it paid once it&rsquo;s sent.
          </p>
        </section>

        <section>
          <h2 className="mb-1 text-base font-semibold text-slate-900">The fine print</h2>
          <ul className="list-disc space-y-0.5 pl-5">
            <li>Grades count as they show in PowerSchool on the day we check. If a teacher changes a grade later, past weeks aren&rsquo;t redone.</li>
            <li>If something in PowerSchool looks wrong, say so before we check and we&rsquo;ll sort it out together.</li>
            <li>Your parents have the final say on any question about these rules.</li>
            <li>If anything here changes, it starts with the next marking period, and you&rsquo;ll be asked to read and agree again.</li>
          </ul>
        </section>
      </Card>

      <Card className="mb-6">
        <h2 className="mb-3 text-base font-semibold text-slate-900">Who&rsquo;s agreed</h2>
        <div className="space-y-2">
          {(members ?? []).map((m) => {
            const when = agreedAt.get(m.id);
            const isMe = m.id === household.memberId;
            return (
              <div key={m.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 text-sm">
                <span className="font-medium text-slate-900">
                  {m.display_name}
                  {isMe && <span className="ml-1 text-xs font-normal text-slate-400">(you)</span>}
                </span>
                {when ? (
                  <span className="text-emerald-700">Agreed {format(new Date(when), "MMM d")} ✓</span>
                ) : isMe ? (
                  <AgreeButton />
                ) : (
                  <span className="text-slate-400">Hasn&rsquo;t agreed yet</span>
                )}
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
