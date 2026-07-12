import { createClient } from "@/lib/supabase/server";
import {
  TriangleAlert,
  Eye,
  UserX,
  ShieldAlert,
  ListChecks,
  Clock,
} from "lucide-react";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: kpis } = await supabase
    .from("v_dashboard_kpis")
    .select("*")
    .single();

  const cards = [
    {
      label: "Incidentes del mes",
      value: kpis?.incidentes_mes ?? 0,
      icon: TriangleAlert,
      accent: "text-risk-high",
    },
    {
      label: "Observaciones del mes",
      value: kpis?.observaciones_mes ?? 0,
      icon: Eye,
      accent: "text-ink",
    },
    {
      label: "Actos inseguros",
      value: kpis?.actos_inseguros_mes ?? 0,
      icon: UserX,
      accent: "text-risk-med",
    },
    {
      label: "Condiciones inseguras",
      value: kpis?.condiciones_inseguras_mes ?? 0,
      icon: ShieldAlert,
      accent: "text-risk-med",
    },
    {
      label: "Acciones abiertas",
      value: kpis?.acciones_abiertas ?? 0,
      icon: ListChecks,
      accent: "text-ink",
    },
    {
      label: "Acciones vencidas",
      value: kpis?.acciones_vencidas ?? 0,
      icon: Clock,
      accent: "text-risk-critical",
    },
  ];

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-lg font-bold mb-1">Panel de seguridad</h1>
      <p className="text-sm text-ink/50 mb-5">
        Cumplimiento de inspecciones:{" "}
        <span className="font-semibold text-ink">
          {kpis?.cumplimiento_inspecciones ?? 0}%
        </span>
      </p>

      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, accent }) => (
          <div
            key={label}
            className="bg-white rounded-xl border border-line p-4"
          >
            <Icon size={20} className={accent} />
            <p className="text-3xl font-bold mt-2 tabular-nums">{value}</p>
            <p className="text-xs text-ink/60 mt-0.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
