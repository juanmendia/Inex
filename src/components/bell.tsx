import { markAllNotificationsRead, markNotificationRead } from "@/modules/notifications/actions";

export function Bell({
  items,
}: {
  items: { id: string; title: string; body: string | null; read_at: string | null; created_at: string }[];
}) {
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <details className="relative">
      <summary className="cursor-pointer list-none rounded-md px-2 py-1 text-sm hover:bg-zinc-100">
        Avisos{unread ? ` (${unread})` : ""}
      </summary>
      <div className="absolute right-0 z-20 mt-2 w-80 rounded-xl bg-white p-2 shadow-lg ring-1 ring-zinc-200">
        <form action={markAllNotificationsRead} className="mb-2 text-right">
          <button className="text-xs text-indigo-600">Marcar todas leídas</button>
        </form>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-2 py-3 text-sm text-zinc-500">No hay avisos.</li>
          ) : (
            items.map((n) => (
              <li key={n.id} className={`rounded-lg px-2 py-2 text-sm ${n.read_at ? "text-zinc-500" : "bg-indigo-50"}`}>
                <p className="font-medium text-zinc-900">{n.title}</p>
                {n.body ? <p className="text-zinc-600">{n.body}</p> : null}
                {!n.read_at ? (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-xs text-indigo-600">Marcar leída</button>
                  </form>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </details>
  );
}
