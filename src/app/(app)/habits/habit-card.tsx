"use client";

import { useState } from "react";
import { Card } from "@/components/ui";
import { daysOfWeekLabel } from "@/lib/weekdays";
import type { DayCell } from "@/lib/habits";
import HabitForm from "./habit-form";
import { setHabitArchived, toggleHabitDay, updateHabit } from "./actions";

type Props = {
  habit: { id: string; name: string; emoji: string | null; days_of_week: number[] | null };
  week: DayCell[];
  streak: number;
  best: number;
  rate30: number | null;
  dueToday: boolean;
};

export default function HabitCard({ habit, week, streak, best, rate30, dueToday }: Props) {
  const [editing, setEditing] = useState(false);
  // Tapping a day flips it right away; the server confirms and the page refreshes the streak.
  const [done, setDone] = useState(() => new Set(week.filter((c) => c.done).map((c) => c.date)));
  const [error, setError] = useState<string | null>(null);

  async function toggle(date: string) {
    setError(null);
    const wasDone = done.has(date);
    setDone((prev) => {
      const next = new Set(prev);
      if (wasDone) next.delete(date);
      else next.add(date);
      return next;
    });
    const result = await toggleHabitDay(habit.id, date);
    if ("error" in result) {
      setError(result.error);
      setDone((prev) => {
        const next = new Set(prev);
        if (wasDone) next.add(date);
        else next.delete(date);
        return next;
      });
    }
  }

  if (editing) {
    return (
      <Card className="!p-4">
        <HabitForm
          habitId={habit.id}
          action={updateHabit}
          initial={{ name: habit.name, emoji: habit.emoji, daysOfWeek: habit.days_of_week }}
          onSaved={() => setEditing(false)}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </Card>
    );
  }

  const schedule = daysOfWeekLabel(habit.days_of_week) ?? "Every day";

  return (
    <Card className="!p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-base font-semibold text-slate-900">
            {habit.emoji && <span className="mr-2">{habit.emoji}</span>}
            {habit.name}
          </p>
          <p className="mt-0.5 text-xs text-slate-400">
            {schedule}
            {rate30 !== null && <span> · {rate30}% over the last 30 days</span>}
            {best > 0 && <span> · best streak {best}</span>}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span
            className={`rounded-full px-3 py-1 text-sm font-semibold ${
              streak > 0 ? "bg-orange-100 text-orange-700" : "bg-slate-100 text-slate-400"
            }`}
            title="Days in a row it's been done"
          >
            🔥 {streak}
          </span>
        </div>
      </div>

      <div className="mt-3 grid grid-cols-7 gap-1.5">
        {week.map((c) => {
          const isDone = done.has(c.date);
          return (
            <button
              key={c.date}
              type="button"
              disabled={!c.scheduled}
              onClick={() => toggle(c.date)}
              aria-label={`${c.label} ${c.date}: ${isDone ? "done" : "not done"}`}
              className={`flex flex-col items-center gap-0.5 rounded-xl border px-1 py-1.5 text-xs transition ${
                !c.scheduled
                  ? "cursor-default border-transparent text-slate-300"
                  : isDone
                    ? "border-teal-500 bg-teal-500 text-white"
                    : c.isToday
                      ? "border-teal-400 bg-white text-slate-600 hover:bg-teal-50"
                      : "border-slate-200 bg-white text-slate-400 hover:bg-slate-50"
              }`}
            >
              <span className="font-medium">{c.isToday ? "Today" : c.label}</span>
              <span className="text-base leading-none">{!c.scheduled ? "·" : isDone ? "✓" : "○"}</span>
            </button>
          );
        })}
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
      {!dueToday && <p className="mt-2 text-xs text-slate-400">Not due today.</p>}

      <div className="mt-3 flex gap-3 text-xs">
        <button type="button" onClick={() => setEditing(true)} className="font-medium text-teal-600 hover:text-teal-500">
          Edit
        </button>
        <form action={setHabitArchived}>
          <input type="hidden" name="id" value={habit.id} />
          <input type="hidden" name="archived" value="true" />
          <button className="font-medium text-slate-400 hover:text-slate-600">Archive</button>
        </form>
      </div>
    </Card>
  );
}
