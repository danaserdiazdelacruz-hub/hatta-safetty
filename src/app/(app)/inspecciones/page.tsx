import { ClipboardList } from "lucide-react";

export default function InspeccionesPage() {
  return (
    <div className="max-w-md mx-auto p-6 text-center pt-16">
      <ClipboardList size={48} className="text-ink/20 mx-auto mb-4" />
      <h1 className="text-lg font-bold mb-2">Inspecciones</h1>
      <p className="text-sm text-ink/50">
        Aquí vivirán los checklists configurables. Próximo módulo del plan
        (semana 5).
      </p>
    </div>
  );
}
