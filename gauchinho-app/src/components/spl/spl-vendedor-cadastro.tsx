"use client";

import { useState } from "react";
import { labelDe, MODELOS_VENDEDOR, type ModeloVendedor } from "@/lib/spl/types";
import { Aviso, BotaoGrande, Campo, Cartao, inputGrande, LinkCopiavel } from "./spl-ui";

export function SplVendedorCadastro({ convite, imobiliaria, modelo }: { convite: string; imobiliaria: string; modelo: ModeloVendedor }) {
  const [f, setF] = useState({ nome: "", telefone: "", email: "", cpf: "", chave_pix: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const recebe = modelo !== "PROPRIO";

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/public/spl/vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convite, ...f }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cadastrar.");
      setCodigo(data.codigo);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (codigo) {
    const url = `${window.location.origin}/spl/v/${codigo}`;
    return (
      <Cartao className="space-y-5">
        <h2 className="text-3xl font-black text-[#0A1931]">Pronto, você está na rede {imobiliaria}!</h2>
        <p className="text-lg text-slate-700">Este é o seu portfólio. Salve na tela inicial do celular e use na frente do cliente.</p>
        <LinkCopiavel titulo="Seu portfólio" url={url} />
        <a href={url} className="block rounded-2xl bg-[#16A34A] px-6 py-4 text-center text-lg font-extrabold text-white">
          Abrir meu portfólio
        </a>
      </Cartao>
    );
  }

  return (
    <Cartao className="space-y-4">
      <p className="text-sm font-bold uppercase tracking-wide text-[#153E90]">Rede {imobiliaria}</p>
      <h2 className="text-2xl font-black text-[#0A1931]">Cadastro de vendedor</h2>
      <p className="text-slate-600">Modelo de trabalho: {labelDe(MODELOS_VENDEDOR, modelo)}</p>
      <Campo rotulo="Seu nome completo">
        <input className={inputGrande} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="WhatsApp">
          <input className={inputGrande} inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(66) 99999-0000" />
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          <input className={inputGrande} inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
      </div>
      {recebe ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo rotulo="CPF">
            <input className={inputGrande} inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", e.target.value)} />
          </Campo>
          <Campo rotulo="Chave PIX para comissões">
            <input className={inputGrande} value={f.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} />
          </Campo>
        </div>
      ) : null}
      {erro ? <Aviso>{erro}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={enviar} disabled={enviando} className="w-full">
        {enviando ? "Enviando…" : "Entrar na rede"}
      </BotaoGrande>
    </Cartao>
  );
}
