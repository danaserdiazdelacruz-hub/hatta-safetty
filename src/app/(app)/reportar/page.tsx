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
} from "lucide-react";

type Tipo = "acto_inseguro" | "condicion_insegura";
type Riesgo = "bajo" | "medio" | "alto" | "critico";

const RIESGOS: { valor: Riesgo; etiqueta: string; clase: string }[] = [
  { valor: "bajo", etiqueta: "Bajo", clase: "bg-risk-low" },
  { valor: "medio", etiqueta: "Medio", clase: "bg-risk-med" },
  { valor: "alto", etiqueta: "Alto", clase: "bg-risk-high" },
  { valor: "critico", etiqueta: "Crítico", clase: "bg-risk-critical" },
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

  // GPS en segundo plano: no bloquea el reporte si el usuario lo niega
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
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      router.push("/login");
      return;
    }

    const { data: perfil } = await supabase
      .from("perfiles")
      .select("empresa_id")
      .eq("id", user.id)
      .single();

    if (!perfil) {
      setError("Tu usuario no tiene perfil asignado. Contacta a tu administrador.");
      setEnviando(false);
      return;
    }

    // 1. Crear la observación
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
      setError("No se pudo guardar el reporte. Revisa tu conexión e intenta de nuevo.");
      setEnviando(false);
      return;
    }

    // 2. Subir la foto como evidencia (si hay)
    if (foto) {
      const ext = foto.name.split(".").pop() ?? "jpg";
      const path = `${perfil.empresa_id}/observaciones/${obs.id}.${ext}`;
      const { error: upError } = await supabase.storage
        .from("evidencias")
        .upload(path, foto, { upsert: true });

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
      <div className="max-w-md mx-auto p-6 text-center pt-16">
        <CircleCheck size={56} className="text-risk-low mx-auto mb-4" />
        <h1 className="text-xl font-bold mb-2">Reporte enviado</h1>
        <p className="text-ink/60 mb-8">
          Gracias por reportar. El responsable del área recibirá una
          notificación.
        </p>
        <button
          onClick={() => {
            setTipo(null);
            setDescripcion("");
            setFoto(null);
            setPreview(null);
            setEnviado(false);
          }}
          className="w-full bg-hatta text-ink font-bold rounded-lg py-3.5 mb-3"
        >
          Reportar otro
        </button>
        <button
          onClick={() => router.push("/")}
          className="w-full border border-line rounded-lg py-3.5"
        >
          Ir al panel
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-4">
      <h1 className="text-lg font-bold mb-4">Reporte rápido</h1>

      {/* Paso 1: ¿Qué viste? */}
      <p className="text-sm font-semibold mb-2">¿Qué observaste?</p>
      <div className="grid grid-cols-2 gap-3 mb-5">
        <button
          onClick={() => setTipo("acto_inseguro")}
          className={`rounded-xl border-2 p-4 text-left ${
            tipo === "acto_inseguro"
              ? "border-hatta bg-hatta/10"
              : "border-line bg-white"
          }`}
        >
          <UserX size={24} className="text-risk-med mb-2" />
          <p className="font-semibold text-sm">Acto inseguro</p>
          <p className="text-xs text-ink/50 mt-1">
            Una conducta: sin EPP, exceso de velocidad...
          </p>
        </button>
        <button
          onClick={() => setTipo("condicion_insegura")}
          className={`rounded-xl border-2 p-4 text-left ${
            tipo === "condicion_insegura"
              ? "border-hatta bg-hatta/10"
              : "border-line bg-white"
          }`}
        >
          <ShieldAlert size={24} className="text-risk-med mb-2" />
          <p className="font-semibold text-sm">Condición insegura</p>
          <p className="text-xs text-ink/50 mt-1">
            El entorno: piso mojado, cable expuesto...
          </p>
        </button>
      </div>

      {/* Paso 2: Nivel de riesgo */}
      <p className="text-sm font-semibold mb-2">Nivel de riesgo</p>
      <div className="grid grid-cols-4 gap-2 mb-5">
        {RIESGOS.map(({ valor, etiqueta, clase }) => (
          <button
            key={valor}
            onClick={() => setRiesgo(valor)}
            className={`rounded-lg py-2.5 text-xs font-semibold text-white ${clase} ${
              riesgo === valor
                ? "ring-2 ring-offset-2 ring-ink"
                : "opacity-40"
            }`}
          >
            {etiqueta}
          </button>
        ))}
      </div>

      {/* Paso 3: Descripción */}
      <p className="text-sm font-semibold mb-2">¿Qué pasó y dónde?</p>
      <textarea
        value={descripcion}
        onChange={(e) => setDescripcion(e.target.value)}
        rows={3}
        placeholder="Ej: Piso mojado sin señalizar en pasillo B, cerca de rampa 4"
        className="w-full rounded-xl border border-line bg-white p-3 text-sm mb-5"
      />

      {/* Paso 4: Foto */}
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        capture="environment"
        onChange={onFotoSeleccionada}
        className="hidden"
      />
      <button
        onClick={() => fileRef.current?.click()}
        className="w-full rounded-xl border-2 border-dashed border-line bg-white p-4 mb-3 flex items-center justify-center gap-2 text-sm text-ink/60"
      >
        <Camera size={20} />
        {foto ? "Cambiar foto" : "Tomar foto (opcional)"}
      </button>
      {preview && (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={preview}
          alt="Evidencia del reporte"
          className="w-full rounded-xl mb-3 max-h-56 object-cover"
        />
      )}

      {/* GPS */}
      <p className="flex items-center gap-1.5 text-xs text-ink/50 mb-5">
        <MapPin size={14} />
        {gps
          ? `Ubicación capturada (${gps.lat.toFixed(4)}, ${gps.lng.toFixed(4)})`
          : "Sin ubicación GPS — el reporte se envía igual"}
      </p>

      {error && (
        <p className="text-risk-high text-sm bg-risk-high/10 rounded-lg px-3 py-2 mb-3">
          {error}
        </p>
      )}

      <button
        onClick={enviar}
        disabled={enviando}
        className="w-full bg-hatta hover:bg-hatta-dark text-ink font-bold rounded-lg py-4 flex items-center justify-center gap-2 disabled:opacity-60"
      >
        {enviando && <LoaderCircle className="animate-spin" size={18} />}
        Enviar reporte
      </button>
    </div>
  );
}
