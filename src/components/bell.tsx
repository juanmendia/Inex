"use client";

import { markAllNotificationsRead, markNotificationRead } from "@/modules/notifications/actions";

export function Bell({
  items,
}: {
  items: { id: string; title: string; body: string | null; read_at: string | null; created_at: string; href?: string | null }[];
}) {
  const unread = items.filter((n) => !n.read_at).length;
  return (
    <details className="relative">
      <summary
        className="relative flex h-10 w-10 cursor-pointer list-none items-center justify-center rounded-full hover:bg-black/5"
        aria-label={unread ? `${unread} avisos` : "Avisos"}
      >
        <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M15 17h5l-1.4-1.4A2 2 0 0 1 18 14.2V11a6 6 0 1 0-12 0v3.2a2 2 0 0 1-.6 1.4L4 17h5" />
          <path d="M9 17a3 3 0 0 0 6 0" />
        </svg>
        {unread ? (
          <span className="absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-600 px-1 text-[10px] font-medium text-white">
            {unread > 9 ? "9+" : unread}
          </span>
        ) : null}
      </summary>
      <div className="absolute right-0 z-30 mt-2 w-80 rounded-xl bg-white p-2 shadow-lg ring-1 ring-zinc-200">
        <form action={markAllNotificationsRead} className="mb-2 text-right">
          <button className="text-xs text-[#142236]">Marcar todas leídas</button>
        </form>
        <ul className="max-h-80 space-y-1 overflow-y-auto">
          {items.length === 0 ? (
            <li className="px-2 py-3 text-sm text-zinc-500">No hay avisos.</li>
          ) : (
            items.map((n) => (
              <li key={n.id} className={`rounded-lg px-2 py-2 text-sm ${n.read_at ? "text-zinc-500" : "bg-blue-50"}`}>
                {n.href ? (
                  <a href={n.href} className="block font-medium text-zinc-900">
                    {n.title}
                  </a>
                ) : (
                  <p className="font-medium text-zinc-900">{n.title}</p>
                )}
                {n.body ? <p className="text-zinc-600">{n.body}</p> : null}
                {!n.read_at ? (
                  <form action={markNotificationRead}>
                    <input type="hidden" name="id" value={n.id} />
                    <button className="text-xs text-[#142236]">Marcar leída</button>
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
