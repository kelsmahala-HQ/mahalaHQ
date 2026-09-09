"use client";

import { useState } from "react";
import { Card, iconButtonClass } from "@/components/ui";
import { completeChore, deleteChore, updateChore } from "./actions";
import AddChoreForm from "./add-chore-form";

type Chore = {
  id: string;
  title: string;
  status: string;
  points: number;
  frequency: string;
  days_of_week: number[] | null;
  due_date: string | null;
  assigned_to: string | null;
};

type Due = { text: string; tone: "overdue" | "today" | "later" } | null;

export default function ChoreRow({
  chore,
  due,
  isKid,
  canManage,
  members,
  assignedMemberIds,
  frequencyLabel,
}: {
  chore: Chore;
  due: Due;
  isKid: boolean;
  canManage: boolean;
  members: { id: string; display_name: string }[];
  assignedMemberIds: string[];
  frequencyLabel: string | null;
}) {
  const [editing, setEditing] = useState(false);

  if (editing) {
    return (
      <Card className="!p-4">
        <AddChoreForm
          members={members}
          choreId={chore.id}
          action={updateChore}
          initial={{
            title: chore.title,
            assignedMemberIds,
            frequency: chore.frequency,
            daysOfWeek: chore.days_of_week,
            points: chore.points,
            dueDate: chore.due_date,
          }}
          onSaved={() => setEditing(false)}
        />
        <button type="button" onClick={() => setEditing(false)} className="mt-2 text-sm text-slate-500 hover:text-slate-700">
          Cancel
        </button>
      </Card>
    );
  }

  return (
    <Card className="flex items-center justify-between !p-4">
      <div>
        <p className={`font-medium ${chore.status === "done" ? "text-slate-400 line-through" : "text-slate-900"}`}>
          {chore.title}
          {chore.points > 0 && (
            <span className="ml-2 rounded-full bg-yellow-100 px-2 py-0.5 text-xs font-semibold text-yellow-800">
              ⭐ {chore.points} pts
            </span>
          )}
        </p>
        <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
          {!isKid && chore.assigned_to && <span className="text-sm text-slate-500">{chore.assigned_to}</span>}
          {frequencyLabel && <span className="text-sm text-slate-400">{frequencyLabel}</span>}
          {due && (
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                due.tone === "overdue"
                  ? "bg-red-100 text-red-700"
                  : due.tone === "today"
                    ? "bg-teal-100 text-teal-700"
                    : "bg-slate-100 text-slate-600"
              }`}
            >
              {due.text}
            </span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-2">
        <form action={completeChore}>
          <input type="hidden" name="id" value={chore.id} />
          <input type="hidden" name="frequency" value={chore.frequency} />
          <button className="rounded-xl bg-teal-500 px-4 py-2 text-sm font-bold text-white hover:bg-teal-600">
            {chore.status === "done" ? "Done! ✅" : "Mark done ✅"}
          </button>
        </form>
        {canManage && (
          <>
            <button type="button" onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
              Edit
            </button>
            <form action={deleteChore}>
              <input type="hidden" name="id" value={chore.id} />
              <button className={iconButtonClass}>Remove</button>
            </form>
          </>
        )}
      </div>
    </Card>
  );
}
