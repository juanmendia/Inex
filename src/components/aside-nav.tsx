"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { NAV, pathIsActive, sectionIsActive, type NavArea, type NavSection } from "@/components/nav";

export function AsideNav({ area, onNavigate }: { area: NavArea; onNavigate?: () => void }) {
  const pathname = usePathname();
  const sections = NAV[area] as NavSection[];
  const [open, setOpen] = useState<Record<string, boolean>>({});

  useEffect(() => {
    setOpen((prev) => {
      const next = { ...prev };
      for (const section of sections) {
        if (section.title && sectionIsActive(section, pathname)) next[section.title] = true;
      }
      return next;
    });
  }, [pathname, area]);

  return (
    <nav className="flex-1 space-y-3 px-3 pb-4">
      {sections.map((section) => {
        if (!section.title) {
          return (
            <div key={section.items[0].href}>
              {section.items.map((item) => (
                <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} onNavigate={onNavigate} />
              ))}
            </div>
          );
        }
        const shown = open[section.title] ?? sectionIsActive(section, pathname);
        return (
          <div key={section.title}>
            <button
              type="button"
              className="flex w-full items-center justify-between rounded-lg px-3 py-1.5 text-[11px] font-medium tracking-wide text-white/45 uppercase"
              onClick={() => setOpen((o) => ({ ...o, [section.title!]: !shown }))}
            >
              {section.title}
              <span className={`text-[10px] transition ${shown ? "rotate-90" : ""}`}>›</span>
            </button>
            {shown
              ? section.items.map((item) => (
                  <NavLink key={item.href} href={item.href} label={item.label} pathname={pathname} onNavigate={onNavigate} />
                ))
              : null}
          </div>
        );
      })}
    </nav>
  );
}

function NavLink({
  href,
  label,
  pathname,
  onNavigate,
}: {
  href: string;
  label: string;
  pathname: string;
  onNavigate?: () => void;
}) {
  const active = pathIsActive(href, pathname);
  return (
    <Link
      href={href}
      onClick={onNavigate}
      className={`aside-link block rounded-lg px-3 py-2 text-[13px] tracking-wide ${active ? "bg-white/10 text-white" : "text-white/80"}`}
    >
      {label}
    </Link>
  );
}
