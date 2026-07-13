import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import BottomNav from "@/components/BottomNav";

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
    .select("nombre, rol, empresas(nombre)")
    .eq("id", user.id)
    .single();

  const rel = perfil?.empresas as unknown;
  const empresa = Array.isArray(rel)
    ? (rel[0] as { nombre: string } | undefined)?.nombre
    : (rel as { nombre: string } | null)?.nombre;

  return (
    <div className="min-h-dvh flex flex-col">
      <div className="hazard-stripe" />

      <header className="bg-ink-soft border-b border-edge px-4 py-3">
        <div className="max-w-md mx-auto flex items-center justify-between">
          <span className="font-extrabold tracking-tight">
            HATTA <span className="text-hatta">Safety</span>
          </span>
          <div className="text-right leading-tight">
            <p className="text-sm font-medium">{perfil?.nombre ?? user.email}</p>
            {empresa && <p className="text-[11px] text-muted">{empresa}</p>}
          </div>
        </div>
      </header>

      <main className="flex-1 pb-28">{children}</main>
      <BottomNav />
    </div>
  );
}
