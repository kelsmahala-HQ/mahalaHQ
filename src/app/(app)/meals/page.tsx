import Link from "next/link";
import { Fragment } from "react";
import { addDays, addWeeks, format, startOfWeek, subWeeks } from "date-fns";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { PageHeader } from "@/components/ui";
import { deleteMealPlanEntry } from "./actions";
import AddMealEntry from "./add-meal-entry";
import AddWeekToGroceriesButton from "./add-week-to-groceries-button";

const MEAL_TYPES = [
  { value: "breakfast", label: "Breakfast" },
  { value: "lunch", label: "Lunch" },
  { value: "dinner", label: "Dinner" },
  { value: "snack", label: "Snack" },
] as const;

export default async function MealsPage({ searchParams }: { searchParams: Promise<{ week?: string }> }) {
  const household = await requireHousehold();
  const { week } = await searchParams;
  const anchor = week ? new Date(`${week}T00:00:00`) : new Date();
  const weekStart = startOfWeek(anchor);
  const days = Array.from({ length: 7 }).map((_, i) => addDays(weekStart, i));
  const weekEndStr = format(addDays(weekStart, 6), "yyyy-MM-dd");
  const weekStartStr = format(weekStart, "yyyy-MM-dd");

  const supabase = await createClient();
  const [{ data: entries }, { data: recipes }] = await Promise.all([
    supabase
      .from("meal_plan_entries")
      .select("*")
      .eq("household_id", household.householdId)
      .gte("date", weekStartStr)
      .lte("date", weekEndStr),
    supabase.from("recipes").select("id, name").eq("household_id", household.householdId).order("name"),
  ]);

  const entriesByDayMeal = new Map<string, NonNullable<typeof entries>>();
  for (const e of entries ?? []) {
    const key = `${e.date}-${e.meal_type}`;
    if (!entriesByDayMeal.has(key)) entriesByDayMeal.set(key, []);
    entriesByDayMeal.get(key)!.push(e);
  }

  const prevWeek = format(subWeeks(weekStart, 1), "yyyy-MM-dd");
  const nextWeek = format(addWeeks(weekStart, 1), "yyyy-MM-dd");

  return (
    <div>
      <PageHeader title="Meal Planner" subtitle="Plan the week, then pull the whole week's ingredients into Groceries when you're ready to shop." />

      <div className="mb-6 flex items-center justify-between">
        <Link href={`/meals?week=${prevWeek}`} className="text-sm font-medium text-slate-500 hover:text-teal-600">
          ← Prev week
        </Link>
        <Link href="/meals/recipes" className="text-sm font-medium text-teal-600 hover:underline">
          📖 Recipe Box
        </Link>
        <Link href={`/meals?week=${nextWeek}`} className="text-sm font-medium text-slate-500 hover:text-teal-600">
          Next week →
        </Link>
      </div>

      <div className="overflow-x-auto">
        <div className="grid min-w-[820px] grid-cols-[90px_repeat(7,1fr)] gap-px overflow-hidden rounded-xl border border-slate-200 bg-slate-200 text-xs">
          <div className="bg-slate-50 p-2" />
          {days.map((day) => (
            <div key={day.toISOString()} className="bg-slate-50 p-2 text-center font-medium text-slate-600">
              {format(day, "EEE d")}
            </div>
          ))}
          {MEAL_TYPES.map((meal) => (
            <Fragment key={meal.value}>
              <div className="bg-slate-50 p-2 text-right font-medium text-slate-500">{meal.label}</div>
              {days.map((day) => {
                const dateStr = format(day, "yyyy-MM-dd");
                const key = `${dateStr}-${meal.value}`;
                const dayEntries = entriesByDayMeal.get(key) ?? [];
                return (
                  <div key={key} className="min-h-16 space-y-1 bg-white p-1.5">
                    {dayEntries.map((e) => (
                      <div key={e.id} className="flex items-center justify-between gap-1 rounded bg-teal-50 px-1.5 py-0.5">
                        <span className="truncate text-teal-800">{e.title}</span>
                        <form action={deleteMealPlanEntry}>
                          <input type="hidden" name="id" value={e.id} />
                          <button className="text-teal-400 hover:text-red-500">✕</button>
                        </form>
                      </div>
                    ))}
                    <AddMealEntry date={dateStr} mealType={meal.value} recipes={recipes ?? []} />
                  </div>
                );
              })}
            </Fragment>
          ))}
        </div>
      </div>

      <div className="mt-6">
        <AddWeekToGroceriesButton weekStart={weekStartStr} weekEnd={weekEndStr} />
      </div>
    </div>
  );
}
