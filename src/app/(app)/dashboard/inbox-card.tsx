import { Card, buttonClass, inputClass } from "@/components/ui";
import { addInboxItem, convertInboxToFollowup, convertInboxToGrocery, convertInboxToTodo, removeInboxItem } from "./inbox-actions";

type InboxItem = { id: string; text: string };

export default function InboxCard({ items }: { items: InboxItem[] }) {
  return (
    <Card className="mb-8">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-slate-700">📥 Family Inbox</h2>
        <span className="text-xs text-slate-400">Dump it here, sort it later</span>
      </div>

      <form action={addInboxItem} className="mt-3 flex gap-2">
        <input
          name="text"
          required
          placeholder='e.g. "Call dentist" or "Need Archer diapers"'
          className={inputClass}
        />
        <button type="submit" className={`${buttonClass} shrink-0`}>
          Add
        </button>
      </form>

      {!!items.length && (
        <div className="mt-4 space-y-2">
          {items.map((item) => (
            <div key={item.id} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <span className="text-sm text-slate-900">{item.text}</span>
              <div className="flex flex-wrap items-center gap-1">
                <form action={convertInboxToTodo}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="text" value={item.text} />
                  <button title="Send to today's To-Do list" className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    📝 To-Do
                  </button>
                </form>
                <form action={convertInboxToFollowup}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="text" value={item.text} />
                  <button title="Send to today's Follow-up Calls/Emails" className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    📞 Follow-up
                  </button>
                </form>
                <form action={convertInboxToGrocery}>
                  <input type="hidden" name="id" value={item.id} />
                  <input type="hidden" name="text" value={item.text} />
                  <button title="Send to Groceries" className="rounded-full bg-teal-50 px-2 py-0.5 text-xs font-medium text-teal-700 hover:bg-teal-100">
                    🛒 Groceries
                  </button>
                </form>
                <form action={removeInboxItem}>
                  <input type="hidden" name="id" value={item.id} />
                  <button title="Remove" className="rounded-full px-1.5 py-0.5 text-xs font-medium text-slate-400 hover:bg-red-50 hover:text-red-600">
                    ✕
                  </button>
                </form>
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
