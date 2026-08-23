"use client";

import { useState } from "react";
import { Card, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { deleteProfile, updateProfile } from "./actions";

type Profile = {
  id: string;
  member_name: string;
  date_of_birth: string | null;
  school_name: string | null;
  grade: string | null;
  teacher: string | null;
  doctor_name: string | null;
  doctor_phone: string | null;
  dentist_name: string | null;
  dentist_phone: string | null;
  allergies: string | null;
  clothing_sizes: string | null;
  schedule_notes: string | null;
  notes: string | null;
};

export default function ProfileCard({ profile }: { profile: Profile }) {
  const [editing, setEditing] = useState(false);

  if (!editing) {
    const rows: [string, string | null][] = [
      ["Born", profile.date_of_birth],
      ["School", [profile.school_name, profile.grade && `Grade ${profile.grade}`].filter(Boolean).join(" · ")],
      ["Teacher", profile.teacher],
      ["Doctor", [profile.doctor_name, profile.doctor_phone].filter(Boolean).join(" · ")],
      ["Dentist", [profile.dentist_name, profile.dentist_phone].filter(Boolean).join(" · ")],
      ["Allergies", profile.allergies],
      ["Clothing sizes", profile.clothing_sizes],
      ["Schedule", profile.schedule_notes],
      ["Notes", profile.notes],
    ];

    return (
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-lg font-semibold text-slate-900">{profile.member_name}</h3>
          <div className="flex gap-2">
            <button onClick={() => setEditing(true)} className="text-xs font-medium text-teal-600 hover:text-teal-500">
              Edit
            </button>
            <form action={deleteProfile}>
              <input type="hidden" name="id" value={profile.id} />
              <button className={iconButtonClass}>Remove</button>
            </form>
          </div>
        </div>
        <dl className="space-y-1 text-sm">
          {rows
            .filter(([, v]) => v)
            .map(([label, value]) => (
              <div key={label} className="flex gap-2">
                <dt className="w-28 shrink-0 text-slate-400">{label}</dt>
                <dd className="text-slate-700">{value}</dd>
              </div>
            ))}
          {rows.every(([, v]) => !v) && <p className="text-sm text-slate-400">No details yet — click Edit to add some.</p>}
        </dl>
      </Card>
    );
  }

  return (
    <Card>
      <form
        action={async (formData) => {
          await updateProfile(formData);
          setEditing(false);
        }}
        className="grid grid-cols-1 gap-3 sm:grid-cols-2"
      >
        <input type="hidden" name="id" value={profile.id} />
        <input name="member_name" defaultValue={profile.member_name} required placeholder="Name" className={inputClass} />
        <input name="date_of_birth" type="date" defaultValue={profile.date_of_birth ?? ""} className={inputClass} />
        <input name="school_name" defaultValue={profile.school_name ?? ""} placeholder="School" className={inputClass} />
        <input name="grade" defaultValue={profile.grade ?? ""} placeholder="Grade" className={inputClass} />
        <input name="teacher" defaultValue={profile.teacher ?? ""} placeholder="Teacher" className={inputClass} />
        <input name="doctor_name" defaultValue={profile.doctor_name ?? ""} placeholder="Doctor name" className={inputClass} />
        <input name="doctor_phone" defaultValue={profile.doctor_phone ?? ""} placeholder="Doctor phone" className={inputClass} />
        <input name="dentist_name" defaultValue={profile.dentist_name ?? ""} placeholder="Dentist name" className={inputClass} />
        <input name="dentist_phone" defaultValue={profile.dentist_phone ?? ""} placeholder="Dentist phone" className={inputClass} />
        <input name="allergies" defaultValue={profile.allergies ?? ""} placeholder="Allergies" className={inputClass} />
        <input
          name="clothing_sizes"
          defaultValue={profile.clothing_sizes ?? ""}
          placeholder="Clothing sizes (e.g. Shirt 6, Shoe 12)"
          className={`${inputClass} sm:col-span-2`}
        />
        <textarea
          name="schedule_notes"
          defaultValue={profile.schedule_notes ?? ""}
          placeholder="Weekly schedule / activities"
          className={`${inputClass} sm:col-span-2`}
          rows={2}
        />
        <textarea
          name="notes"
          defaultValue={profile.notes ?? ""}
          placeholder="Other notes"
          className={`${inputClass} sm:col-span-2`}
          rows={2}
        />
        <div className="flex gap-2 sm:col-span-2">
          <button type="submit" className={buttonClass}>
            Save
          </button>
          <button type="button" onClick={() => setEditing(false)} className="text-sm text-slate-500 hover:text-slate-700">
            Cancel
          </button>
        </div>
      </form>
    </Card>
  );
}
