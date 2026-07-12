import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { LayoutDashboard, TriangleAlert, ClipboardList } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: perfil } = await supabase
    .from("perfiles")
    .select("nombre, rol, empresa_id, empresas(nombre)")
    .eq("id", user.id)
    .single();

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="hazard-stripe" />

      <header className="bg-ink text-paper px-4 py-3 flex items-center justify-between">
        <span className="font-bold tracking-tight">
          HATTA <span className="text-hatta">Safety</span>
        </span>
        <span className="text-sm text-paper/60">
          {perfil?.nombre ?? user.email}
        </span>
      </header>

      <main className="flex-1 pb-24">{children}</main>

      {/* Navegación inferior, pulgar-friendly para uso en piso/almacén */}
      <nav className="fixed bottom-0 inset-x-0 bg-ink text-paper/60 border-t border-paper/10">
        <div className="grid grid-cols-3 max-w-md mx-auto">
          <Link
            href="/"
            className="flex flex-col items-center gap-1 py-3 text-xs hover:text-hatta"
          >
            <LayoutDashboard size={22} />
            Panel
          </Link>
          <Link
            href="/reportar"
            className="flex flex-col items-center gap-1 py-2 text-xs"
          >
            <span className="bg-hatta text-ink rounded-full p-2 -mt-5 border-4 border-ink">
              <TriangleAlert size={24} strokeWidth={2.25} />
            </span>
            <span className="font-semibold text-hatta">Reportar</span>
          </Link>
          <Link
            href="/inspecciones"
            className="flex flex-col items-center gap-1 py-3 text-xs hover:text-hatta"
          >
            <ClipboardList size={22} />
            Inspecciones
          </Link>
        </div>
      </nav>
    </div>
  );
}
