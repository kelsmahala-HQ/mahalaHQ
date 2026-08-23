import { createClient } from "@/lib/supabase/server";
import { requireHousehold } from "@/lib/household";
import { Card, EmptyState, PageHeader, buttonClass, iconButtonClass, inputClass } from "@/components/ui";
import { deleteDocument, getDownloadUrl, uploadDocument } from "./actions";

export default async function DocumentsPage() {
  const household = await requireHousehold();
  const supabase = await createClient();
  const { data: documents } = await supabase
    .from("documents")
    .select("*")
    .eq("household_id", household.householdId)
    .order("created_at", { ascending: false });

  const withUrls = await Promise.all(
    (documents ?? []).map(async (d) => ({ ...d, url: await getDownloadUrl(d.file_path) }))
  );

  return (
    <div>
      <PageHeader title="Documents" subtitle="Insurance cards, warranties, IDs, and other household files." />

      <Card className="mb-8">
        <h2 className="mb-3 text-sm font-semibold text-slate-700">Upload a document</h2>
        <form action={uploadDocument} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <input name="title" placeholder="Title (defaults to filename)" className={inputClass} />
          <input name="category" placeholder="Category (e.g. Insurance)" className={inputClass} />
          <input name="expires_at" type="date" placeholder="Expires" className={inputClass} />
          <input name="file" type="file" required className={`${inputClass} file:mr-3 file:rounded-md file:border-0 file:bg-teal-50 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-teal-700`} />
          <textarea name="notes" placeholder="Notes" className={`${inputClass} sm:col-span-2`} rows={2} />
          <button type="submit" className={`${buttonClass} sm:col-span-2`}>
            Upload
          </button>
        </form>
      </Card>

      {!withUrls.length ? (
        <EmptyState message="No documents uploaded yet." />
      ) : (
        <div className="space-y-2">
          {withUrls.map((d) => (
            <Card key={d.id} className="flex items-center justify-between !p-4">
              <div>
                <a
                  href={d.url ?? "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="font-medium text-teal-600 hover:underline"
                >
                  {d.title}
                </a>
                <p className="text-sm text-slate-500">
                  {[d.category, d.expires_at ? `expires ${d.expires_at}` : null].filter(Boolean).join(" · ")}
                </p>
                {d.notes && <p className="text-xs text-slate-400">{d.notes}</p>}
              </div>
              <form action={deleteDocument}>
                <input type="hidden" name="id" value={d.id} />
                <input type="hidden" name="file_path" value={d.file_path} />
                <button className={iconButtonClass}>Remove</button>
              </form>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
