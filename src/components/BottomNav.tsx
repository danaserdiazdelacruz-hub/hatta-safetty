"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, TriangleAlert, ClipboardList } from "lucide-react";

export default function BottomNav() {
  const path = usePathname();

  const item = (href: string, active: boolean) =>
    `flex flex-col items-center gap-1 py-3 text-[11px] font-medium transition-colors ${
      active ? "text-hatta" : "text-muted hover:text-paper"
    }`;

  return (
    <nav className="fixed bottom-0 inset-x-0 bg-ink-soft/95 backdrop-blur border-t border-edge pb-[env(safe-area-inset-bottom)]">
      <div className="grid grid-cols-3 max-w-md mx-auto">
        <Link href="/" className={item("/", path === "/")}>
          <LayoutDashboard size={21} />
          Panel
        </Link>
        <Link href="/reportar" className="flex flex-col items-center gap-1 py-2 text-[11px]">
          <span
            className={`rounded-full p-3 -mt-6 border-[5px] border-ink shadow-lg transition-transform active:scale-95 ${
              path === "/reportar" ? "bg-hatta-dark" : "bg-hatta"
            } text-ink`}
          >
            <TriangleAlert size={24} strokeWidth={2.25} />
          </span>
          <span className="font-bold text-hatta">Reportar</span>
        </Link>
        <Link href="/inspecciones" className={item("/inspecciones", path.startsWith("/inspecciones"))}>
          <ClipboardList size={21} />
          Inspecciones
        </Link>
      </div>
    </nav>
  );
}
