"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { trocarSenhaPrimeiroAcesso } from "./actions";

export default function DefinirSenhaPage() {
  const router = useRouter();
  const [senha, setSenha] = useState("");
  const [confirmacao, setConfirmacao] = useState("");
  const [pronto, setPronto] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [mensagem, setMensagem] = useState("Validando seu acesso...");

  useEffect(() => {
    const supabase = createClient();
    void supabase.auth.getSession().then(({ data }) => {
      const valido = Boolean(data.session?.user);
      setPronto(valido);
      setMensagem(valido ? "Por segurança, troque a senha inicial antes de continuar." : "Acesso inválido ou expirado. Entre novamente com a senha inicial.");
    });
  }, []);

  async function salvar(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (senha.length < 8) {
      setMensagem("A senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (senha !== confirmacao) {
      setMensagem("A confirmação da senha não confere.");
      return;
    }

    setSalvando(true);
    const resultado = await trocarSenhaPrimeiroAcesso(senha);
    if (!resultado.ok) {
      setMensagem(resultado.message);
      setSalvando(false);
      return;
    }

    const next = new URLSearchParams(window.location.search).get("next");
    router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/admin");
    router.refresh();
  }

  return (
    <main className="flex min-h-[calc(100vh-8rem)] items-center justify-center px-4 py-10">
      <section className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-700">Primeiro acesso</p>
        <h1 className="mt-2 text-2xl font-extrabold text-zinc-900">Crie sua nova senha</h1>
        <p className={`mt-3 text-sm ${pronto ? "text-zinc-600" : "text-amber-700"}`}>{mensagem}</p>

        {pronto ? (
          <form onSubmit={salvar} className="mt-6 space-y-4">
            <label className="block text-sm font-bold text-zinc-700">
              Nova senha
              <input
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={senha}
                onChange={(event) => setSenha(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5"
              />
            </label>
            <label className="block text-sm font-bold text-zinc-700">
              Confirmar senha
              <input
                type="password"
                minLength={8}
                required
                autoComplete="new-password"
                value={confirmacao}
                onChange={(event) => setConfirmacao(event.target.value)}
                className="mt-1 w-full rounded-lg border border-zinc-300 px-3 py-2.5"
              />
            </label>
            <button
              type="submit"
              disabled={salvando}
              className="w-full rounded-lg bg-cyan-700 px-4 py-2.5 font-bold text-white disabled:opacity-60"
            >
              {salvando ? "Salvando nova senha..." : "Salvar senha e continuar"}
            </button>
          </form>
        ) : null}
      </section>
    </main>
  );
}
