"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  UserX,
  ShieldAlert,
  Camera,
  MapPin,
  LoaderCircle,
  CircleCheck,
  X,
} from "lucide-react";

type Tipo = "acto_inseguro" | "condicion_insegura";
type Riesgo = "bajo" | "medio" | "alto" | "critico";

const RIESGOS: { valor: Riesgo; etiqueta: string; dot: string }[] = [
  { valor: "bajo", etiqueta: "Bajo", dot: "bg-risk-low" },
  { valor: "medio", etiqueta: "Medio", dot: "bg-risk-med" },
  { valor: "alto", etiqueta: "Alto", dot: "bg-risk-high" },
  { valor: "critico", etiqueta: "Crítico", dot: "bg-risk-critical" },
];

export default function ReportarPage() {
  const router = useRouter();
  const fileRef = useRef<HTMLInputElement>(null);

  const [tipo, setTipo] = useState<Tipo | null>(null);
  const [riesgo, setRiesgo] = useState<Riesgo>("medio");
  const [descripcion, setDescripcion] = useState("");
  const [foto, setFoto] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [gps, setGps] = useState<{ lat: number; lng: number } | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!("geolocation" in navigator)) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setGps({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => setGps(null),
      { enableHighAccuracy: true, timeout: 8000 }
    );
  }, []);

  function onFotoSeleccionada(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFoto(f);
    setPreview(URL.createObjectURL(f));
  }

  async function enviar() {
    if (!tipo || !descripcion.trim()) {
      setError("Selecciona el tipo y escribe una descripción breve.");
      return;
    }
    setEnviando(true);
    setError(null);

    const supabase = createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { router.push("/login"); return; }

    const { data: perfil } = await supabase
      .from("perfiles").select("empresa_id").eq("id", user.id).single();

    if (!perfil) {
      setError("Tu usuario no tiene perfil asignado. Contacta a tu administrador.");
      setEnviando(false);
      return;
    }

    const { data: obs, error: obsError } = await supabase
      .from("observaciones")
      .insert({
        empresa_id: perfil.empresa_id,
        tipo,
        riesgo,
        descripcion: descripcion.trim(),
        reportado_por: user.id,
        latitud: gps?.lat ?? null,
        longitud: gps?.lng ?? null,
      })
      .select("id")
      .single();

    if (obsError || !obs) {
      setError("No se pudo guardar. Revisa tu conexión e intenta de nuevo.");
      setEnviando(false);
      return;
    }

    if (foto) {
      const ext = foto.name.split(".").pop() ?? "jpg";
      const path = `${perfil.empresa_id}/observaciones/${obs.id}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("evidencias").upload(path, foto, { upsert: true });
      if (!upError) {
        await supabase.from("evidencias").insert({
          empresa_id: perfil.empresa_id,
          entidad_tipo: "observacion",
          entidad_id: obs.id,
          storage_path: path,
          tipo_archivo: foto.type,
          subido_por: user.id,
        });
      }
    }
    setEnviado(true);
  }

  if (enviado) {
    return (
      <div className="max-w-md mx-auto p-6 text-center pt-20">
        <span className="inline-flex rounded-full bg-risk-low/10 p-5 mb-5">
          <CircleCheck size={48} className="text-risk-low" />
        </span>
        <h1 className="text-2xl font-extrabold mb-2">Reporte enviado</h1>
        <p className="text-muted mb-10">
          Gracias por reportar. Cada reporte previene un accidente.
        </p>
        <button
          onClick={() => {
            setTipo(null); setDescripcion(""); setFoto(null);
            setPreview(null); setEnviado(false);
          }}
          className="w-full bg-hatta hover:bg-hatta-dark text-ink font-bold rounded-xl py-4 mb-3 transition-colors"
        >
          Reportar otro
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-full card py-4 font-medium text-muted hover:text-paper transition-colors"
        >
          Ir al panel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <p className="section-label mt-1">Reporte rápido</p>
      <h1 className="text-xl font-extrabold tracking-tight mb-5">
        ¿Qué observaste?
      </h1>

      {/* Tipo */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        {[
          { v: "acto_inseguro" as Tipo, icon: UserX, t: "Acto inseguro", d: "Una conducta: sin EPP, exceso de velocidad…" },
          { v: "condicion_insegura" as Tipo, icon: ShieldAlert, t: "Condición insegura", d: "El entorno: piso mojado, cable expuesto…" },
        ].map(({ v, icon: Icon, t, d }) => (
          <button
            key={v}
            onClick={() => setTipo(v)}
            className={`rounded-2xl border p-4 text-left transition-all ${
              tipo === v
                ? "border-hatta bg-hatta/10 shadow-[0_0_24px_rgba(255,196,0,0.08)]"
                : "border-edge bg-ink-soft hover:border-muted/40"
            }`}
          >
            <Icon size={24} className={tipo === v ? "text-hatta" : "text-muted"} />
            <p className="font-bold text-sm mt-2.5">{t}</p>
            <p className="text-xs text-muted mt-1 leading-snug">{d}</p>
          </button>
        ))}
      </div>

      {/* Riesgo */}
      <p className="section-label mb-2">Nivel de riesgo</p>
      <div className="card p-1.5 grid grid-cols-4 gap-1.5 mb-6">
        {RIESGOS.map(({ valor, etiqueta, dot }) => (
          <button
            key={valor}
            onClick={() => setRiesgo(valor)}
            className={`rounded-lg py-2.5 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors ${
              riesgo === valor
                ? "bg-ink-raise text-paper border border-edge"
                : "text-muted hover:text-paper"
            }`}
          >
            <span className={`size-2 rounded-full ${dot}`} />
            {etiqueta}
          </button>
        ))}
      </div>

      {/* Descripción */}
      <p className="section-label mb-2">¿Qué pasó y dónde?</p>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        placeholder="Ej: Piso mojado sin señalizar en pasillo B, cerca de rampa 4"
        className="w-full rounded-2xl border border-edge bg-ink-soft p-4 text-sm mb-6 placeholder:text-muted/50 focus:border-hatta transition-colors"
      />

      {/* Foto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFotoSeleccionada}
        className="hidden"
      />
      {preview ? (
        <div className="relative mb-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={preview}
            alt="Evidencia del reporte"
            className="w-full rounded-2xl max-h-60 object-cover border border-edge"
          />
          <button
            onClick={() => { setFoto(null); setPreview(null); }}
            aria-label="Quitar foto"
            className="absolute top-2.5 right-2.5 bg-ink/80 backdrop-blur rounded-full p-2"
          >
            <X size={16} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => fileRef.current?.click()}
          className="w-full rounded-2xl border border-dashed border-edge bg-ink-soft hover:border-hatta/50 p-5 mb-4 flex items-center justify-center gap-2.5 text-sm text-muted transition-colors"
        >
          <Camera size={20} className="text-hatta" />
          Tomar foto <span className="text-muted/60">(opcional)</span>
        </button>
      )}

      {/* GPS */}
      <p className="flex items-center gap-1.5 text-xs text-muted mb-6">
        <MapPin size={14} className={gps ? "text-risk-low" : ""} />
        {gps
          ? `Ubicación capturada · ${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)}`
          : "Sin GPS — el reporte se envía igual"}
      </p>

      {error && (
        <p className="text-risk-high text-sm bg-risk-high/10 border border-risk-high/20 rounded-xl px-3.5 py-2.5 mb-4">
          {error}
        </p>
      )}

      <button
        onClick={enviar}
        disabled={enviando}
        className="w-full bg-hatta hover:bg-hatta-dark active:scale-[0.99] text-ink font-bold rounded-xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
      >
        {enviando && <LoaderCircle className="animate-spin" size={18} />}
        Enviar reporte
      </button>
    </div>
  );
}
