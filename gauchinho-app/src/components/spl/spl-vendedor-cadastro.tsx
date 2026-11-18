"use client";

import { useState } from "react";
import { labelDe, MODELOS_VENDEDOR, PERCENTUAL_VENDEDOR, pct, type ModeloVendedor } from "@/lib/spl/types";
import { mascaraCpf, mascaraTelefone, type PixTipo } from "@/lib/spl/mascaras";
import { caminhoPortfolio } from "@/lib/spl/links";
import { Aviso, BotaoGrande, Campo, CampoPix, Cartao, inputGrande, LinkCopiavel } from "./spl-ui";
import { SplTermoCaixa } from "./spl-termo";

export function SplVendedorCadastro({
  convite,
  imobiliaria,
  modelo,
  assinatura,
  termo,
}: {
  convite: string;
  imobiliaria: string;
  modelo: ModeloVendedor;
  assinatura: { m: string; s: string } | null;
  termo: { texto: string; versao: string } | null;
}) {
  const [f, setF] = useState({ nome: "", telefone: "", email: "", cpf: "", chave_pix: "", chave_pix_tipo: "" as PixTipo | "" });
  const [erro, setErro] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [codigo, setCodigo] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const recebe = modelo !== "PROPRIO";

  async function enviar() {
    setErro(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/public/spl/vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ convite, ...f, ...(assinatura ?? {}), aceito, versao: termo?.versao }),
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
    const url = `${window.location.origin}${caminhoPortfolio(imobiliaria, codigo)}`;
    return (
      <Cartao className="space-y-5">
        <h2 className="text-3xl font-black text-[#0A1931]">Pronto, você está na rede {imobiliaria}!</h2>
        <p className="text-lg text-slate-700">Este é o seu portfólio. Salve na tela inicial do celular e use na frente do cliente.</p>
        <LinkCopiavel
          titulo="Seu portfólio"
          url={url}
          mensagemWhatsapp={`Meu portfólio SPL (${imobiliaria}):`}
          whatsappPara={f.telefone}
          rotuloWhatsapp="Mandar para o meu WhatsApp"
        />
        <p className="text-base text-slate-600">Abra o portfólio no celular e toque em <b>Instalar</b> para ele virar um app.</p>
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
      <p className="text-slate-600">
        Modelo de trabalho: {labelDe(MODELOS_VENDEDOR, modelo)}
        {PERCENTUAL_VENDEDOR[modelo] ? ` · ${pct(PERCENTUAL_VENDEDOR[modelo])} da base líquida` : ""}
      </p>
      <Campo rotulo="Seu nome completo">
        <input className={inputGrande} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="WhatsApp">
          <input className={inputGrande} inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} placeholder="(66) 99999-9999" />
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          <input className={inputGrande} inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
      </div>
      {recebe ? (
        <>
          <Campo rotulo="CPF">
            <input className={inputGrande} inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", mascaraCpf(e.target.value))} placeholder="000.000.000-00" />
          </Campo>
          <CampoPix rotulo="Chave PIX para comissões" tipo={f.chave_pix_tipo} valor={f.chave_pix} onTipo={(t) => set("chave_pix_tipo", t)} onValor={(v) => set("chave_pix", v)} />
        </>
      ) : null}
      {recebe && (termo
        ? <SplTermoCaixa texto={termo.texto} versao={termo.versao} aceito={aceito} onAceito={setAceito} preenchido={false} />
        : <Aviso tom="info">O termo do vendedor ainda não foi publicado pela equipe.</Aviso>)}
      {erro ? <Aviso>{erro}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={enviar} disabled={enviando || (recebe && (!termo || !aceito))} className="w-full">
        {enviando ? "Enviando…" : "Entrar na rede"}
      </BotaoGrande>
    </Cartao>
  );
}
