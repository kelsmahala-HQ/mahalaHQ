export const EVENT_TYPES = [
  { value: "general", label: "General", icon: "" },
  { value: "work", label: "Work", icon: "💼" },
  { value: "pto", label: "PTO", icon: "📣" },
  { value: "mba", label: "MBA", icon: "📊" },
  { value: "school", label: "School", icon: "🏫" },
  { value: "college", label: "College", icon: "🎓" },
  { value: "appointment", label: "Appointment", icon: "🏥" },
  { value: "birthday", label: "Birthday", icon: "🎂" },
  { value: "holiday", label: "Holiday", icon: "🎉" },
  { value: "babysitter", label: "Babysitter", icon: "🧑‍🍼" },
] as const;

export const EVENT_TYPE_ICONS: Record<string, string> = Object.fromEntries(EVENT_TYPES.map((t) => [t.value, t.icon]));
