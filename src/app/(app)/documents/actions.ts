"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";

export async function uploadDocument(formData: FormData) {
  const household = await requireHousehold();
  const supabase = await createClient();
  const file = formData.get("file") as File;

  if (!file || file.size === 0) return;

  const path = `${household.householdId}/${crypto.randomUUID()}-${file.name}`;
  const { error: uploadError } = await supabase.storage.from("documents").upload(path, file);
  if (uploadError) throw new Error(uploadError.message);

  await supabase.from("documents").insert({
    household_id: household.householdId,
    title: (formData.get("title") as string) || file.name,
    category: (formData.get("category") as string) || "other",
    file_path: path,
    file_name: file.name,
    expires_at: (formData.get("expires_at") as string) || null,
    notes: formData.get("notes") as string,
    uploaded_by: household.userId,
  });

  revalidatePath("/documents");
}

export async function deleteDocument(formData: FormData) {
  await requireHousehold();
  const supabase = await createClient();
  const id = formData.get("id") as string;
  const filePath = formData.get("file_path") as string;

  await supabase.storage.from("documents").remove([filePath]);
  await supabase.from("documents").delete().eq("id", id);

  revalidatePath("/documents");
}

export async function getDownloadUrl(filePath: string) {
  const supabase = await createClient();
  const { data } = await supabase.storage.from("documents").createSignedUrl(filePath, 60);
  return data?.signedUrl ?? null;
}
