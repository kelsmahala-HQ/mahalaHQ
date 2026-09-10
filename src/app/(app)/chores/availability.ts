// Shared claimability rules for the Chores page and the kid dashboard. A chore is claimable
// only when the viewer is eligible for it (see eligibleFor), it's due/available now, and nobody
// has already completed this occurrence -- the last part is handled implicitly by the recurring
// schedule advancing on complete/skip, and by a one-time chore flipping to 'done'.

export type ChoreLike = {
  id: string;
  status: string;
  frequency: string;
  due_date: string | null;
};

/** Open and due today or earlier (or no due date at all). */
export function availableNow(chore: ChoreLike, todayStr: string): boolean {
  return chore.status === "open" && (!chore.due_date || chore.due_date <= todayStr);
}

/** Open but not due yet -- the viewer will be able to claim it on chore.due_date. */
export function upcoming(chore: ChoreLike, todayStr: string): boolean {
  return chore.status === "open" && !!chore.due_date && chore.due_date > todayStr;
}

/**
 * Eligibility is separate from assignment. `eligibleMemberIds` is the set for this chore from
 * chore_eligibility; an empty/absent set means "everyone". Managers (admin/adult) always see
 * everything regardless.
 */
export function eligibleFor(
  eligibleMemberIds: string[] | undefined,
  memberId: string,
  isManager: boolean
): boolean {
  if (isManager) return true;
  if (!eligibleMemberIds || eligibleMemberIds.length === 0) return true;
  return eligibleMemberIds.includes(memberId);
}
