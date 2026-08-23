"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function addProfile(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();

  const { error } = await supabase.from("family_profiles").insert({
    household_id: household.householdId,
    member_id: (formData.get("member_id") as string) || null,
    member_name: formData.get("member_name") as string,
    date_of_birth: (formData.get("date_of_birth") as string) || null,
    school_name: formData.get("school_name") as string,
    grade: formData.get("grade") as string,
    teacher: formData.get("teacher") as string,
    doctor_name: formData.get("doctor_name") as string,
    doctor_phone: formData.get("doctor_phone") as string,
    dentist_name: formData.get("dentist_name") as string,
    dentist_phone: formData.get("dentist_phone") as string,
    allergies: formData.get("allergies") as string,
    clothing_sizes: formData.get("clothing_sizes") as string,
    schedule_notes: formData.get("schedule_notes") as string,
    notes: formData.get("notes") as string,
  });

  if (error) return { error: error.message };

  revalidatePath("/family");
  return { success: true };
}

export async function updateProfile(formData: FormData): Promise<{ error: string } | { success: true }> {
  const household = await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;

  const avatarFile = formData.get("avatar") as File | null;
  let avatarPath: string | undefined;

  if (avatarFile && avatarFile.size > 0) {
    const path = `${household.householdId}/${id}-${Date.now()}-${avatarFile.name}`;
    const { error: uploadError } = await supabase.storage.from("avatars").upload(path, avatarFile);
    if (!uploadError) avatarPath = path;
  }

  const { error } = await supabase
    .from("family_profiles")
    .update({
      member_name: formData.get("member_name") as string,
      date_of_birth: (formData.get("date_of_birth") as string) || null,
      school_name: formData.get("school_name") as string,
      grade: formData.get("grade") as string,
      teacher: formData.get("teacher") as string,
      doctor_name: formData.get("doctor_name") as string,
      doctor_phone: formData.get("doctor_phone") as string,
      dentist_name: formData.get("dentist_name") as string,
      dentist_phone: formData.get("dentist_phone") as string,
      allergies: formData.get("allergies") as string,
      clothing_sizes: formData.get("clothing_sizes") as string,
      schedule_notes: formData.get("schedule_notes") as string,
      notes: formData.get("notes") as string,
      ...(avatarPath ? { avatar_path: avatarPath } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) return { error: error.message };

  revalidatePath("/family");
  return { success: true };
}

export async function deleteProfile(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  await supabase.from("family_profiles").delete().eq("id", formData.get("id") as string);
  revalidatePath("/family");
}

export async function getAvatarUrl(avatarPath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("avatars").createSignedUrl(avatarPath, 60 * 60);
  return data?.signedUrl ?? null;
}
