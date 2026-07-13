"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HardHat, LoaderCircle, ShieldCheck } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError("Correo o contraseña incorrectos.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh flex flex-col">
      <div className="hazard-stripe" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          {/* Marca */}
          <div className="flex flex-col items-center text-center mb-10">
            <div className="bg-hatta text-ink rounded-2xl p-4 mb-4 shadow-[0_0_40px_rgba(255,196,0,0.15)]">
              <HardHat size={34} strokeWidth={2.25} />
            </div>
            <h1 className="text-3xl font-extrabold tracking-tight">
              HATTA <span className="text-hatta">Safety</span>
            </h1>
            <p className="text-muted text-sm mt-1.5">
              Reporta. Corrige. Previene.
            </p>
          </div>

          <form onSubmit={handleLogin} className="card p-6 space-y-4">
            <div>
              <label htmlFor="email" className="section-label block mb-2">
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-xl bg-ink-raise px-4 py-3.5 border border-edge placeholder:text-muted/50 focus:border-hatta transition-colors"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label htmlFor="password" className="section-label block mb-2">
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-xl bg-ink-raise px-4 py-3.5 border border-edge focus:border-hatta transition-colors"
              />
            </div>

            {error && (
              <p className="text-risk-high text-sm bg-risk-high/10 border border-risk-high/20 rounded-xl px-3.5 py-2.5">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hatta hover:bg-hatta-dark active:scale-[0.99] text-ink font-bold rounded-xl py-4 flex items-center justify-center gap-2 disabled:opacity-60 transition-all"
            >
              {loading && <LoaderCircle className="animate-spin" size={18} />}
              Entrar
            </button>
          </form>

          <p className="flex items-center justify-center gap-1.5 text-muted text-xs mt-6">
            <ShieldCheck size={14} />
            Plataforma EHS multiempresa · Datos aislados por compañía
          </p>
        </div>
      </div>

      <div className="hazard-stripe" />
    </main>
  );
}
