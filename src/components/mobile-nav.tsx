"use client";

import { useState } from "react";
import { logout } from "@/modules/auth/actions";
import { AsideNav } from "@/components/aside-nav";
import type { NavArea } from "@/components/nav";

export function MobileNav({
  area,
  company,
}: {
  area: NavArea;
  company: string;
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
          <button type="button" className="absolute inset-0 bg-[#122033]/45 backdrop-blur-md" aria-label="Cerrar" onClick={() => setOpen(false)} />
          <div
            className="absolute inset-y-0 left-0 flex w-[min(84vw,20rem)] flex-col text-[#f4efe4] shadow-xl"
            style={{ background: "var(--aside)" }}
          >
            <div className="flex items-start justify-between px-5 py-6">
              <div>
                <div className="mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo1.png" alt="" className="h-9 w-auto max-w-[10rem] object-contain" />
                </div>
                {company ? <p className="text-[15px] font-medium leading-snug">{company}</p> : null}
              </div>
              <button type="button" className="text-sm text-white/70" onClick={() => setOpen(false)}>
                Cerrar
              </button>
            </div>
            <AsideNav area={area} onNavigate={() => setOpen(false)} />
            <form action={logout} className="border-t border-white/10 p-4">
              <button className="text-sm text-white/80">Salir</button>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}
