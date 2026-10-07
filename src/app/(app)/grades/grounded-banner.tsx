import type { groundedStatus } from "@/lib/grades";

type Status = ReturnType<typeof groundedStatus>;

/**
 * The stay-in rule, shown to whoever is looking. Parents see the verdict and which classes are
 * the problem; the kid sees what it'll take to get out. At the limit (not over) it's a heads-up.
 */
export default function GroundedBanner({ status, name, audience }: { status: Status; name: string; audience: "parent" | "kid" }) {
  if (!status.grounded && status.count < status.limit) return null;

  if (status.grounded) {
    const needed = status.count - status.limit;
    return (
      <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900">
        <p className="font-semibold">
          {audience === "kid" ? "You're staying in for now" : `${name} isn't going anywhere yet`}
        </p>
        <p className="mt-0.5 text-red-800">
          {status.count} classes are below a C- (the limit is {status.limit}): {status.names.join(", ")}.{" "}
          {audience === "kid"
            ? `Get ${needed} of them back to a C- or better to be free to go.`
            : `${needed} more need to get back to a C- or better.`}
        </p>
      </div>
    );
  }

  return (
    <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
      {audience === "kid"
        ? `Careful: ${status.count} classes are below a C-, which is the limit. One more and you're staying in.`
        : `${name} is at the limit: ${status.count} classes below a C-. One more and she's staying in.`}
    </div>
  );
}
