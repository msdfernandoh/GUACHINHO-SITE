"use client";

import { useState } from "react";
import { MODELOS_PARCERIA, MODELOS_VENDEDOR, type ModeloParceria, type ModeloVendedor } from "@/lib/spl/types";
import { Aviso, BotaoGrande, Campo, Cartao, inputGrande, LinkCopiavel } from "./spl-ui";

type Resultado = { token: string; convite: string; nome: string };

export function SplCadastroImobiliaria() {
  const [passo, setPasso] = useState(0);
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [logo, setLogo] = useState<File | null>(null);
  const [f, setF] = useState({
    nome: "",
    responsavel: "",
    telefone: "",
    email: "",
    cnpj: "",
    chave_pix: "",
    modelo_parceria: "" as ModeloParceria | "",
    quantidade_vendedores: "",
    modelo_vendedores: "PROPRIO" as ModeloVendedor,
  });
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));
  const soLibera = f.modelo_parceria === "SOMENTE_LIBERAR_CARTEIRA";

  function avancar() {
    setErro(null);
    if (passo === 0) {
      if (f.nome.trim().length < 2) return setErro("Informe o nome da imobiliária.");
      if (f.responsavel.trim().length < 3) return setErro("Informe o nome do responsável.");
      if (f.telefone.replace(/\D/g, "").length < 10) return setErro("Informe o telefone com DDD.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErro("Informe um e-mail válido.");
    }
    if (passo === 1 && !f.modelo_parceria) return setErro("Escolha o modelo de parceria.");
    setPasso((p) => p + 1);
  }

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const body = new FormData();
      Object.entries(f).forEach(([k, v]) => body.set(k, String(v)));
      if (logo) body.set("logo", logo);
      const res = await fetch("/api/public/spl/imobiliaria", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cadastrar.");
      setResultado(data as Resultado);
      try {
        localStorage.setItem("spl_painel_token", data.token);
      } catch {
        // navegador sem armazenamento: o link do painel aparece na tela
      }
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    const origem = typeof window !== "undefined" ? window.location.origin : "";
    return (
      <Cartao className="space-y-5">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Cadastro recebido</p>
        <h2 className="text-3xl font-black text-[#0A1931]">Bem-vinda, {resultado.nome}!</h2>
        <p className="text-lg text-slate-700">
          Guarde o link do seu painel: é por ele que você sobe clientes e acompanha tudo. A logo aparece na página
          depois da aprovação da nossa equipe.
        </p>
        <LinkCopiavel titulo="Seu painel (guarde este link)" url={`${origem}/spl/painel/${resultado.token}`} />
        <LinkCopiavel
          titulo="Link para os seus vendedores se cadastrarem"
          url={`${origem}/spl/e/${resultado.convite}`}
          mensagemWhatsapp={`Cadastre-se na rede ${resultado.nome} do portfólio SPL:`}
        />
        <a
          href={`/spl/painel/${resultado.token}`}
          className="block rounded-2xl bg-[#153E90] px-6 py-4 text-center text-lg font-extrabold text-white"
        >
          Abrir meu painel
        </a>
      </Cartao>
    );
  }

  return (
    <Cartao className="space-y-6">
      <div className="flex gap-2">
        {[0, 1, 2].map((i) => (
          <span key={i} className={`h-2 flex-1 rounded-full ${i <= passo ? "bg-[#F59E0B]" : "bg-slate-200"}`} />
        ))}
      </div>

      {passo === 0 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#0A1931]">1 · Sua imobiliária</h2>
          <Campo rotulo="Nome da imobiliária">
            <input className={inputGrande} value={f.nome} onChange={(e) => set("nome", e.target.value)} placeholder="Imobiliária Norte" />
          </Campo>
          <Campo rotulo="Logo" dica="PNG, JPG ou WEBP de até 5 MB. Aparece na página depois da aprovação.">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
              className="block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-base"
            />
          </Campo>
          <Campo rotulo="Responsável">
            <input className={inputGrande} value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} placeholder="Nome completo" />
          </Campo>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo="Telefone / WhatsApp">
              <input className={inputGrande} inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", e.target.value)} placeholder="(66) 99999-0000" />
            </Campo>
            <Campo rotulo="E-mail">
              <input className={inputGrande} inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} placeholder="contato@imobiliaria.com.br" />
            </Campo>
          </div>
        </div>
      ) : null}

      {passo === 1 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#0A1931]">2 · Modelo de parceria</h2>
          <div className="grid gap-3">
            {MODELOS_PARCERIA.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set("modelo_parceria", m.value)}
                className={`rounded-2xl border-2 p-4 text-left transition ${f.modelo_parceria === m.value ? "border-[#153E90] bg-[#153E90]/5 ring-4 ring-[#153E90]/10" : "border-slate-200 bg-white"}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-black text-[#0A1931]">{m.label}</span>
                  <span className="text-xl font-black text-[#153E90]">{m.percentual}</span>
                </span>
                <span className="mt-1 block text-base text-slate-600">{m.descricao}</span>
              </button>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Campo rotulo={soLibera ? "CNPJ (opcional)" : "CNPJ"}>
              <input className={inputGrande} inputMode="numeric" value={f.cnpj} onChange={(e) => set("cnpj", e.target.value)} placeholder="00.000.000/0000-00" />
            </Campo>
            <Campo rotulo={soLibera ? "Chave PIX (opcional)" : "Chave PIX para comissões"}>
              <input className={inputGrande} value={f.chave_pix} onChange={(e) => set("chave_pix", e.target.value)} placeholder="CNPJ, e-mail ou telefone" />
            </Campo>
          </div>
        </div>
      ) : null}

      {passo === 2 ? (
        <div className="space-y-4">
          <h2 className="text-2xl font-black text-[#0A1931]">3 · Sua equipe</h2>
          <Campo rotulo="Quantos vendedores trabalham com você?">
            <input
              className={inputGrande}
              inputMode="numeric"
              value={f.quantidade_vendedores}
              onChange={(e) => set("quantidade_vendedores", e.target.value.replace(/\D/g, ""))}
              placeholder="5"
            />
          </Campo>
          <p className="text-base font-bold text-slate-800">Como os vendedores vão trabalhar?</p>
          <div className="grid gap-3">
            {MODELOS_VENDEDOR.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set("modelo_vendedores", m.value)}
                className={`rounded-2xl border-2 p-4 text-left ${f.modelo_vendedores === m.value ? "border-[#153E90] bg-[#153E90]/5 ring-4 ring-[#153E90]/10" : "border-slate-200 bg-white"}`}
              >
                <span className="block text-lg font-black text-[#0A1931]">{m.label}</span>
                <span className="block text-base text-slate-600">{m.descricao}</span>
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {erro ? <Aviso>{erro}</Aviso> : null}

      <div className="flex flex-col-reverse gap-3 sm:flex-row">
        {passo > 0 ? (
          <BotaoGrande tipo="secundario" onClick={() => setPasso((p) => p - 1)} className="sm:w-40">
            Voltar
          </BotaoGrande>
        ) : null}
        {passo < 2 ? (
          <BotaoGrande onClick={avancar} className="flex-1">
            Continuar
          </BotaoGrande>
        ) : (
          <BotaoGrande tipo="ouro" onClick={enviar} disabled={enviando} className="flex-1">
            {enviando ? "Enviando…" : "Concluir cadastro"}
          </BotaoGrande>
        )}
      </div>
    </Cartao>
  );
}
