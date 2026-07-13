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

const MESES = [
  "enero", "febrero", "marzo", "abril", "mayo", "junio",
  "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre",
];

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: kpis } = await supabase
    .from("v_dashboard_kpis")
    .select("*")
    .single();

  const hoy = new Date();
  const cumplimiento = Number(kpis?.cumplimiento_inspecciones ?? 0);

  const cards = [
    { label: "Incidentes", value: kpis?.incidentes_mes ?? 0, icon: TriangleAlert, tone: "text-risk-high", ring: "bg-risk-high/10" },
    { label: "Observaciones", value: kpis?.observaciones_mes ?? 0, icon: Eye, tone: "text-hatta", ring: "bg-hatta/10" },
    { label: "Actos inseguros", value: kpis?.actos_inseguros_mes ?? 0, icon: UserX, tone: "text-risk-med", ring: "bg-risk-med/10" },
    { label: "Condiciones inseguras", value: kpis?.condiciones_inseguras_mes ?? 0, icon: ShieldAlert, tone: "text-risk-med", ring: "bg-risk-med/10" },
    { label: "Acciones abiertas", value: kpis?.acciones_abiertas ?? 0, icon: ListChecks, tone: "text-paper", ring: "bg-paper/5" },
    { label: "Acciones vencidas", value: kpis?.acciones_vencidas ?? 0, icon: Clock, tone: "text-risk-critical", ring: "bg-risk-critical/10" },
  ];

  return (
    <div className="max-w-md mx-auto p-4">
      <div className="flex items-end justify-between mb-4 mt-1">
        <div>
          <p className="section-label">Panel de seguridad</p>
          <h1 className="text-xl font-extrabold tracking-tight capitalize">
            {MESES[hoy.getMonth()]} {hoy.getFullYear()}
          </h1>
        </div>
      </div>

      {/* Cumplimiento destacado */}
      <div className="card p-5 mb-3">
        <div className="flex items-center justify-between mb-2.5">
          <p className="section-label">Cumplimiento de inspecciones</p>
          <p className="text-lg font-extrabold tabular-nums">
            {cumplimiento}
            <span className="text-muted text-sm font-semibold">%</span>
          </p>
        </div>
        <div className="h-2 rounded-full bg-ink-raise overflow-hidden">
          <div
            className={`h-full rounded-full ${
              cumplimiento >= 80
                ? "bg-risk-low"
                : cumplimiento >= 50
                ? "bg-risk-med"
                : "bg-risk-high"
            }`}
            style={{ width: `${Math.min(cumplimiento, 100)}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {cards.map(({ label, value, icon: Icon, tone, ring }) => (
          <div key={label} className="card p-4">
            <span className={`inline-flex rounded-lg p-2 ${ring}`}>
              <Icon size={18} className={tone} />
            </span>
            <p className="kpi-number mt-3">{value}</p>
            <p className="text-xs text-muted mt-1.5 leading-tight">{label}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
