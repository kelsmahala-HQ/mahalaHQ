"use client";

import { useState } from "react";
import Image from "next/image";
import { Card, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { colorForName } from "@/lib/color";
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
  avatarUrl: string | null;
};

function calculateAge(dob: string | null): number | null {
  if (!dob) return null;
  const birth = new Date(dob);
  const today = new Date();
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) age--;
  return age;
}

function Avatar({ name, url, size = 48 }: { name: string; url: string | null; size?: number }) {
  if (url) {
    return (
      <Image
        src={url}
        alt={name}
        width={size}
        height={size}
        className="rounded-full object-cover"
        style={{ width: size, height: size }}
        unoptimized
      />
    );
  }
  return (
    <div
      className="flex shrink-0 items-center justify-center rounded-full text-lg font-semibold text-white"
      style={{ width: size, height: size, backgroundColor: colorForName(name) }}
    >
      {name.charAt(0).toUpperCase()}
    </div>
  );
}

export default function ProfileCard({ profile, isYou }: { profile: Profile; isYou: boolean }) {
  const [editing, setEditing] = useState(false);
  const [dob, setDob] = useState(profile.date_of_birth ?? "");

  const age = calculateAge(profile.date_of_birth);
  const isMinor = age === null || age < 18;

  if (!editing) {
    const rows: [string, string | null][] = [
      ["Age", age !== null ? `${age}` : null],
      ...(isMinor
        ? ([
            ["School", [profile.school_name, profile.grade && `Grade ${profile.grade}`].filter(Boolean).join(" · ")],
            ["Teacher", profile.teacher],
            ["Clothing sizes", profile.clothing_sizes],
          ] as [string, string | null][])
        : []),
      ["Doctor", [profile.doctor_name, profile.doctor_phone].filter(Boolean).join(" · ")],
      ["Dentist", [profile.dentist_name, profile.dentist_phone].filter(Boolean).join(" · ")],
      ["Allergies", profile.allergies],
      ["Schedule", profile.schedule_notes],
      ["Notes", profile.notes],
    ];

    return (
      <Card>
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Avatar name={profile.member_name} url={profile.avatarUrl} />
            <div>
              <h3 className="text-lg font-semibold text-slate-900">
                {profile.member_name}
                {isYou && <span className="ml-2 text-sm font-normal text-slate-400">(you)</span>}
              </h3>
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  isMinor ? "bg-yellow-100 text-yellow-800" : "bg-teal-100 text-teal-800"
                }`}
              >
                {age !== null ? (isMinor ? "Child" : "Adult") : "Age unknown"}
              </span>
            </div>
          </div>
          <div className="flex shrink-0 gap-2">
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

  const editAge = calculateAge(dob || null);
  const editIsMinor = editAge === null || editAge < 18;

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

        <div className="flex items-center gap-3 sm:col-span-2">
          <Avatar name={profile.member_name} url={profile.avatarUrl} size={56} />
          <div className="flex-1">
            <label className="mb-1 block text-xs font-medium text-slate-500">Photo</label>
            <input name="avatar" type="file" accept="image/*" className={`${inputClass} text-xs`} />
          </div>
        </div>

        <input name="member_name" defaultValue={profile.member_name} required placeholder="Name" className={inputClass} />
        <input
          name="date_of_birth"
          type="date"
          value={dob}
          onChange={(e) => setDob(e.target.value)}
          className={inputClass}
        />
        {editIsMinor && (
          <>
            <input name="school_name" defaultValue={profile.school_name ?? ""} placeholder="School" className={inputClass} />
            <input name="grade" defaultValue={profile.grade ?? ""} placeholder="Grade" className={inputClass} />
            <input name="teacher" defaultValue={profile.teacher ?? ""} placeholder="Teacher" className={inputClass} />
            <input
              name="clothing_sizes"
              defaultValue={profile.clothing_sizes ?? ""}
              placeholder="Clothing sizes (e.g. Shirt 6, Shoe 12)"
              className={inputClass}
            />
          </>
        )}
        <input name="doctor_name" defaultValue={profile.doctor_name ?? ""} placeholder="Doctor name" className={inputClass} />
        <input name="doctor_phone" defaultValue={profile.doctor_phone ?? ""} placeholder="Doctor phone" className={inputClass} />
        <input name="dentist_name" defaultValue={profile.dentist_name ?? ""} placeholder="Dentist name" className={inputClass} />
        <input name="dentist_phone" defaultValue={profile.dentist_phone ?? ""} placeholder="Dentist phone" className={inputClass} />
        <input
          name="allergies"
          defaultValue={profile.allergies ?? ""}
          placeholder="Allergies"
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
        {/* Hidden fields preserve values not shown for adults so they aren't wiped out if a birthdate is later corrected. */}
        {!editIsMinor && (
          <>
            <input type="hidden" name="school_name" value={profile.school_name ?? ""} />
            <input type="hidden" name="grade" value={profile.grade ?? ""} />
            <input type="hidden" name="teacher" value={profile.teacher ?? ""} />
            <input type="hidden" name="clothing_sizes" value={profile.clothing_sizes ?? ""} />
          </>
        )}
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
