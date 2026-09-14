"use client";

import { useState } from "react";
import Link from "next/link";
import { logout } from "@/modules/auth/actions";

export function MobileNav({
  items,
  company,
  program,
}: {
  items: readonly (readonly [string, string])[];
  company: string;
  program: string;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="md:hidden">
      <button
        type="button"
        className="flex h-10 w-10 items-center justify-center rounded-lg"
        aria-label="Abrir menú"
        onClick={() => setOpen(true)}
      >
        <span className="flex flex-col gap-1.5">
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
          <span className="block h-0.5 w-5 bg-current" />
        </span>
      </button>
      {open ? (
        <div className="fixed inset-0 z-50">
          <button type="button" className="absolute inset-0 bg-[#122033]/50" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <nav
            className="absolute inset-y-0 left-0 flex w-[min(84vw,20rem)] flex-col text-[#f4efe4] shadow-xl"
            style={{ background: "var(--aside)" }}
          >
            <div className="flex items-start justify-between px-5 py-6">
              <div>
                <p className="text-[15px] font-medium leading-snug">{company}</p>
                <p className="mt-1 text-[11px] text-white/50">{program}</p>
              </div>
              <button type="button" className="text-sm text-white/70" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
            <div className="flex-1 space-y-0.5 overflow-y-auto px-3">
              {items.map(([label, href]) => (
                <Link
                  key={href}
                  href={href}
                  className="block rounded-lg px-3 py-3 text-[15px] text-white/90"
                  onClick={() => setOpen(false)}
                >
                  {label}
                </Link>
              ))}
            </div>
            <form action={logout} className="border-t border-white/10 p-4">
              <button className="text-sm text-white/80">Salir</button>
            </form>
          </nav>
        </div>
      ) : null}
    </div>
  );
}
