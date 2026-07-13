import { ClipboardList } from "lucide-react";

export default function InspeccionesPage() {
  return (
    <div className="max-w-md mx-auto p-6 text-center pt-20">
      <span className="inline-flex rounded-full bg-ink-soft border border-edge p-5 mb-5">
        <ClipboardList size={40} className="text-muted" />
      </span>
      <h1 className="text-xl font-extrabold mb-2">Inspecciones</h1>
      <p className="text-sm text-muted max-w-xs mx-auto">
        Aquí vivirán los checklists configurables por empresa. Próximo módulo
        del plan.
      </p>
    </div>
  );
}
