"use client";

import { useState } from "react";
import {
  MODELOS_PARCERIA,
  opcoesRemuneracaoVendedor,
  POR_VENDEDOR_OPCAO,
  PERCENTUAL_PARCERIA,
  pct,
  type ModeloParceria,
  type ModeloVendedoresImob,
} from "@/lib/spl/types";
import { mascaraCnpj, mascaraTelefone, type PixTipo } from "@/lib/spl/mascaras";
import { caminhoConvite, caminhoPainel } from "@/lib/spl/links";
import { Aviso, BotaoGrande, Campo, CampoPix, Cartao, inputGrande, LinkCopiavel } from "./spl-ui";

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
    chave_pix_tipo: "" as PixTipo | "",
    modelo_parceria: "" as ModeloParceria | "",
    quantidade_vendedores: "",
    modelo_vendedores: "PROPRIO" as ModeloVendedoresImob,
  });
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const soLibera = f.modelo_parceria === "SOMENTE_LIBERAR_CARTEIRA";
  const semCnpj = f.cnpj.replace(/\D/g, "").length === 0;
  const opcoes = opcoesRemuneracaoVendedor(f.modelo_parceria);
  const daImob = f.modelo_parceria ? PERCENTUAL_PARCERIA[f.modelo_parceria] : 0;
  const escolhida = opcoes.find((o) => o.value === f.modelo_vendedores);

  function escolherModelo(m: ModeloParceria) {
    setF((p) => {
      const permitido =
        p.modelo_vendedores === "POR_VENDEDOR" ||
        opcoesRemuneracaoVendedor(m).find((o) => o.value === p.modelo_vendedores)?.permitido;
      return { ...p, modelo_parceria: m, modelo_vendedores: permitido ? p.modelo_vendedores : "PROPRIO" };
    });
  }

  function avancar() {
    setErro(null);
    if (passo === 0) {
      if (f.nome.trim().length < 2) return setErro("Informe o nome da imobiliária.");
      if (f.responsavel.trim().length < 3) return setErro("Informe o nome do responsável.");
      if (f.telefone.replace(/\D/g, "").length < 10) return setErro("Informe o telefone com DDD.");
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(f.email.trim())) return setErro("Informe um e-mail válido.");
    }
    if (passo === 1) {
      if (!f.modelo_parceria) return setErro("Escolha o modelo de parceria.");
      if (!soLibera && !f.chave_pix_tipo) return setErro("Escolha o tipo da chave PIX.");
      if (!soLibera && f.chave_pix.trim().length < 3) return setErro("Informe a chave PIX para receber as comissões.");
      const cnpj = f.cnpj.replace(/\D/g, "");
      if (cnpj && cnpj.length !== 14) return setErro("CNPJ incompleto. Confira os 14 números ou deixe em branco.");
    }
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
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível cadastrar.");
    } finally {
      setEnviando(false);
    }
  }

  if (resultado) {
    const origem = typeof window !== "undefined" ? window.location.origin : "";
    const painel = caminhoPainel(resultado.nome, resultado.token);
    return (
      <Cartao className="space-y-5">
        <p className="text-sm font-bold uppercase tracking-wide text-emerald-700">Cadastro recebido</p>
        <h2 className="text-3xl font-black text-[#0A1931]">Bem-vinda, {resultado.nome}!</h2>
        <p className="text-lg text-slate-700">
          Guarde o link do seu painel: é por ele que você sobe clientes e acompanha tudo. A logo aparece na página
          depois da aprovação da nossa equipe.
        </p>
        {semCnpj && !soLibera ? (
          <Aviso tom="info">Seu cadastro ficou incompleto porque falta o CNPJ. Envie para a nossa equipe para liberar as comissões.</Aviso>
        ) : null}
        <LinkCopiavel titulo="Seu painel (guarde este link)" url={`${origem}${painel}`} />
        <LinkCopiavel
          titulo="Link para os seus vendedores se cadastrarem"
          url={`${origem}${caminhoConvite(resultado.nome, resultado.convite)}`}
          mensagemWhatsapp={`Cadastre-se na rede ${resultado.nome} do portfólio SPL:`}
        />
        <a href={painel} className="block rounded-2xl bg-[#153E90] px-6 py-4 text-center text-lg font-extrabold text-white">
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
            <Campo rotulo="Celular / WhatsApp">
              <input
                className={inputGrande}
                inputMode="tel"
                value={f.telefone}
                onChange={(e) => set("telefone", mascaraTelefone(e.target.value))}
                placeholder="(66) 99999-9999"
              />
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
                onClick={() => escolherModelo(m.value)}
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
          <Campo rotulo="CNPJ" dica="Se não tiver agora, pode deixar em branco e enviar depois.">
            <input
              className={inputGrande}
              inputMode="numeric"
              value={f.cnpj}
              onChange={(e) => set("cnpj", mascaraCnpj(e.target.value))}
              placeholder="00.000.000/0000-00"
            />
          </Campo>
          {semCnpj && f.modelo_parceria && !soLibera ? (
            <Aviso tom="info">Sem o CNPJ o cadastro fica incompleto. Você pode concluir agora e enviar o CNPJ depois.</Aviso>
          ) : null}
          <CampoPix
            rotulo={soLibera ? "Chave PIX (opcional)" : "Chave PIX para receber as comissões"}
            tipo={f.chave_pix_tipo}
            valor={f.chave_pix}
            onTipo={(t) => set("chave_pix_tipo", t)}
            onValor={(v) => set("chave_pix", v)}
          />
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
              onChange={(e) => set("quantidade_vendedores", e.target.value.replace(/\D/g, "").slice(0, 4))}
              placeholder="5"
            />
          </Campo>
          <div>
            <p className="text-lg font-black text-[#0A1931]">Como pretende remunerar os vendedores?</p>
            <p className="text-base text-slate-600">
              {soLibera
                ? "No modelo sem participação não há comissão para repassar: os vendedores ficam no modelo próprio."
                : `A comissão do vendedor sai do seu percentual de ${pct(daImob)}.`}
            </p>
          </div>
          <div className="grid gap-3">
            {opcoes.map((o) => (
              <button
                key={o.value}
                type="button"
                disabled={!o.permitido}
                onClick={() => set("modelo_vendedores", o.value)}
                className={`rounded-2xl border-2 p-4 text-left transition disabled:cursor-not-allowed disabled:opacity-45 ${f.modelo_vendedores === o.value ? "border-[#153E90] bg-[#153E90]/5 ring-4 ring-[#153E90]/10" : "border-slate-200 bg-white"}`}
              >
                <span className="flex items-baseline justify-between gap-3">
                  <span className="text-lg font-black text-[#0A1931]">{o.label}</span>
                  <span className="text-xl font-black text-[#153E90]">{o.doVendedor ? pct(o.doVendedor) : "—"}</span>
                </span>
                <span className="block text-base text-slate-600">{o.descricao}</span>
                {o.permitido && o.doVendedor > 0 && !soLibera ? (
                  <span className="mt-1 block text-sm font-bold text-slate-700">
                    Vendedor {pct(o.doVendedor)} · fica com a imobiliária {pct(o.ficaImobiliaria)}
                  </span>
                ) : null}
                {!o.permitido ? (
                  <span className="mt-1 block text-sm font-bold text-slate-500">Maior que o seu percentual de {pct(daImob)}.</span>
                ) : null}
              </button>
            ))}
          </div>
          {!soLibera ? (
            <button
              type="button"
              onClick={() => set("modelo_vendedores", "POR_VENDEDOR")}
              className={`w-full rounded-2xl border-2 p-4 text-left transition ${f.modelo_vendedores === "POR_VENDEDOR" ? "border-[#153E90] bg-[#153E90]/5 ring-4 ring-[#153E90]/10" : "border-dashed border-slate-300 bg-white"}`}
            >
              <span className="block text-lg font-black text-[#0A1931]">{POR_VENDEDOR_OPCAO.label}</span>
              <span className="block text-base text-slate-600">{POR_VENDEDOR_OPCAO.descricao}</span>
            </button>
          ) : null}
          {escolhida?.repassaTudo ? (
            <Aviso tom="info">
              Atenção: no mesmo modelo da imobiliária, você repassa toda a sua comissão ({pct(escolhida.doVendedor)}) ao vendedor. A
              imobiliária não fica com percentual nessas vendas.
            </Aviso>
          ) : null}
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
