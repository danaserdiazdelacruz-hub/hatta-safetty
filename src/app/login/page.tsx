"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { HardHat, LoaderCircle } from "lucide-react";

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
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError("Correo o contraseña incorrectos. Verifica e intenta de nuevo.");
      setLoading(false);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className="min-h-dvh bg-ink flex flex-col">
      <div className="hazard-stripe" />

      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-sm">
          <div className="flex items-center gap-3 mb-10">
            <div className="bg-hatta text-ink rounded-lg p-2.5">
              <HardHat size={28} strokeWidth={2.25} />
            </div>
            <div>
              <h1 className="text-paper text-2xl font-bold tracking-tight">
                HATTA <span className="text-hatta">Safety</span>
              </h1>
              <p className="text-paper/50 text-sm">
                Seguridad industrial en tiempo real
              </p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label
                htmlFor="email"
                className="block text-paper/70 text-sm mb-1.5"
              >
                Correo
              </label>
              <input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg bg-ink-soft text-paper px-4 py-3 border border-paper/10 placeholder:text-paper/30"
                placeholder="tu@empresa.com"
              />
            </div>
            <div>
              <label
                htmlFor="password"
                className="block text-paper/70 text-sm mb-1.5"
              >
                Contraseña
              </label>
              <input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg bg-ink-soft text-paper px-4 py-3 border border-paper/10"
              />
            </div>

            {error && (
              <p className="text-risk-high text-sm bg-risk-high/10 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-hatta hover:bg-hatta-dark text-ink font-bold rounded-lg py-3.5 flex items-center justify-center gap-2 disabled:opacity-60"
            >
              {loading && <LoaderCircle className="animate-spin" size={18} />}
              Entrar
            </button>
          </form>
        </div>
      </div>

      <div className="hazard-stripe" />
    </main>
  );
}
