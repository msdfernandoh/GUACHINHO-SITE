"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  labelDe,
  MODELOS_PARCERIA,
  labelModeloVendedores,
  MODELOS_VENDEDOR,
  modeloPadraoVendedor,
  opcoesRemuneracaoVendedor,
  POR_VENDEDOR_OPCAO,
  pct,
  SOLUCOES,
  STATUS_CLIENTE,
  type ClienteSpl,
  type EmpreendimentoSpl,
  type ImobiliariaSpl,
  type ModeloParceria,
  type ModeloVendedor,
  type ModeloVendedoresImob,
  type VendedorSpl,
} from "@/lib/spl/types";
import { mascaraCnpj, mascaraCpf, mascaraPix, mascaraTelefone, type PixTipo } from "@/lib/spl/mascaras";
import { caminhoPainel, caminhoPortfolio } from "@/lib/spl/links";
import { baixarModeloCarteira, lerPlanilhaCarteira, type LinhaCarteira } from "@/lib/spl/planilha";
import { Aviso, BotaoGrande, Campo, CampoPix, Cartao, fone, inputGrande, LinkCopiavel, brl, linkWhatsapp } from "./spl-ui";
import { SplInstalarApp } from "./spl-instalar-app";

export type ConviteModelo = { modelo: string; titulo: string; caminho: string };

type Props = {
  imob: Omit<ImobiliariaSpl, "token_painel">;
  token: string;
  convites: ConviteModelo[];
  vendedores: VendedorSpl[];
  clientes: ClienteSpl[];
  empreendimentos: EmpreendimentoSpl[];
};

type Aba = "inicio" | "cliente" | "planilha" | "vendedor" | "editar";

export function SplPainel({ imob, token, convites, vendedores, clientes, empreendimentos }: Props) {
  const router = useRouter();
  const [aba, setAba] = useState<Aba>("inicio");
  const origem = typeof window !== "undefined" ? window.location.origin : "";
  const responsavel = vendedores.find((v) => v.telefone === imob.telefone) ?? vendedores[0];
  const modelo = MODELOS_PARCERIA.find((m) => m.value === imob.modelo_parceria);
  const trabalhados = clientes.filter((c) => c.status !== "NOVO" && c.status !== "PERDIDO").length;
  const nomeEmp = (slug: string | null) => empreendimentos.find((e) => e.slug === slug)?.nome ?? "—";

  const voltar = () => {
    setAba("inicio");
    router.refresh();
  };

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-4 py-8">
      <Cartao className="flex flex-wrap items-center gap-4">
        {imob.logo_url ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imob.logo_url} alt={imob.nome} className="h-16 w-16 rounded-2xl object-contain ring-1 ring-slate-200" />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[#153E90] text-2xl font-black text-white">
            {imob.nome.slice(0, 1)}
          </div>
        )}
        <div className="flex-1">
          <h1 className="text-2xl font-black text-[#0A1931]">{imob.nome}</h1>
          <p className="text-slate-600">
            {modelo?.label}
            {modelo && modelo.percentual !== "—" ? ` · ${modelo.percentual}` : ""} · Vendedores: {labelModeloVendedores(imob.modelo_vendedores)}
          </p>
        </div>
        <span
          className={`rounded-full px-4 py-2 text-sm font-bold ${imob.status === "APROVADA" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}
        >
          {imob.status === "APROVADA" ? "Parceria aprovada" : imob.status === "RECUSADA" ? "Cadastro recusado" : "Aguardando aprovação"}
        </span>
      </Cartao>

      {!imob.cnpj && imob.modelo_parceria !== "SOMENTE_LIBERAR_CARTEIRA" ? (
        <Aviso tom="info">Cadastro incompleto: falta o CNPJ da imobiliária. Envie para a nossa equipe para liberar as comissões.</Aviso>
      ) : null}

      <div className="grid grid-cols-3 gap-3">
        {[
          [clientes.length, "clientes na carteira"],
          [trabalhados, "em atendimento"],
          [vendedores.length, "vendedores"],
        ].map(([v, l]) => (
          <div key={String(l)} className="rounded-3xl bg-[#0A1931] p-4 text-white">
            <p className="text-3xl font-black text-[#F59E0B]">{v}</p>
            <p className="text-sm text-white/70">{l}</p>
          </div>
        ))}
      </div>

      {aba === "inicio" ? (
        <>
          <SplInstalarApp texto="Coloque este painel na tela inicial do celular" />
          <div className="grid gap-3 sm:grid-cols-2">
            <BotaoGrande tipo="ouro" onClick={() => setAba("cliente")}>
              + Cadastrar cliente
            </BotaoGrande>
            <BotaoGrande onClick={() => setAba("planilha")}>Subir planilha de clientes</BotaoGrande>
            {responsavel ? (
              <a
                href={caminhoPortfolio(imob.nome, responsavel.codigo)}
                className="flex min-h-[60px] items-center justify-center rounded-2xl bg-[#16A34A] px-6 py-4 text-center text-lg font-extrabold text-white"
              >
                Abrir portfólio para apresentar
              </a>
            ) : null}
            <BotaoGrande tipo="secundario" onClick={() => setAba("vendedor")}>
              + Cadastrar vendedor
            </BotaoGrande>
          </div>

          {convites.length > 1 ? (
            <p className="text-lg font-black text-[#0A1931]">Links de convite: envie o link do modelo de cada vendedor</p>
          ) : null}
          {convites.map((c) => (
            <LinkCopiavel
              key={c.modelo}
              titulo={c.titulo}
              url={`${origem}${c.caminho}`}
              mensagemWhatsapp={`Cadastre-se na rede ${imob.nome} do portfólio SPL:`}
            />
          ))}

          <LinkCopiavel
            titulo="Link deste painel (sistema da imobiliária)"
            url={`${origem}${caminhoPainel(imob.nome, token)}`}
            mensagemWhatsapp={`Painel da ${imob.nome} no portfólio SPL:`}
            whatsappPara={imob.telefone}
            rotuloWhatsapp="Mandar para o meu WhatsApp"
          />

          <BotaoGrande tipo="secundario" onClick={() => setAba("editar")} className="w-full">
            Editar dados da imobiliária
          </BotaoGrande>

          <Cartao>
            <h2 className="text-xl font-black text-[#0A1931]">Vendedores</h2>
            <ul className="mt-3 divide-y">
              {vendedores.map((v) => (
                <li key={v.id} className="flex flex-wrap items-center justify-between gap-2 py-3">
                  <div>
                    <p className="font-bold">{v.nome}</p>
                    <p className="text-sm text-slate-500">
                      {fone(v.telefone)} · {labelDe(MODELOS_VENDEDOR, v.modelo)}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <a
                      href={linkWhatsapp(`Seu portfólio SPL da ${imob.nome}. Salve na tela inicial do celular:\n${origem}${caminhoPortfolio(imob.nome, v.codigo)}`, v.telefone)}
                      target="_blank"
                      rel="noreferrer"
                      className="rounded-xl bg-[#16A34A] px-3 py-2 text-sm font-bold text-white"
                    >
                      Enviar no WhatsApp
                    </a>
                    <a href={caminhoPortfolio(imob.nome, v.codigo)} className="rounded-xl border-2 border-[#153E90] px-3 py-2 text-sm font-bold text-[#153E90]">
                      Portfólio
                    </a>
                  </div>
                </li>
              ))}
              {!vendedores.length ? <li className="py-3 text-slate-500">Nenhum vendedor ainda. Envie o link acima.</li> : null}
            </ul>
          </Cartao>

          <Cartao>
            <h2 className="text-xl font-black text-[#0A1931]">Clientes</h2>
            <div className="mt-3 overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead className="text-sm text-slate-500">
                  <tr>
                    {["Cliente", "Empreendimento", "Chaves", "Solução", "Vendedor", "Situação"].map((h) => (
                      <th key={h} className="py-2 pr-3">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {clientes.map((c) => (
                    <tr key={c.id} className="border-t">
                      <td className="py-3 pr-3">
                        <p className="font-bold">{c.nome}</p>
                        <p className="text-sm text-slate-500">{fone(c.telefone)}</p>
                      </td>
                      <td className="pr-3">
                        {nomeEmp(c.empreendimento_slug)}
                        {c.unidade ? <span className="block text-sm text-slate-500">{c.unidade}</span> : null}
                      </td>
                      <td className="pr-3">{brl(c.valor_chaves)}</td>
                      <td className="pr-3">{labelDe(SOLUCOES, c.solucao)}</td>
                      <td className="pr-3">{vendedores.find((v) => v.id === c.vendedor_id)?.nome ?? "—"}</td>
                      <td>
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-sm font-bold">{labelDe(STATUS_CLIENTE, c.status)}</span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {!clientes.length ? <p className="py-3 text-slate-500">Nenhum cliente ainda. Cadastre um ou suba a planilha.</p> : null}
            </div>
          </Cartao>
        </>
      ) : null}

      {aba === "cliente" ? <FormCliente token={token} empreendimentos={empreendimentos} onFim={voltar} /> : null}
      {aba === "planilha" ? <FormPlanilha token={token} empreendimentos={empreendimentos} onFim={voltar} /> : null}
      {aba === "vendedor" ? (
        <FormVendedor token={token} padrao={modeloPadraoVendedor(imob.modelo_vendedores)} modeloImob={imob.modelo_parceria} nomeImob={imob.nome} onFim={voltar} />
      ) : null}
      {aba === "editar" ? (
        <FormEditar
          imob={imob}
          token={token}
          onFim={(novoNome) => {
            if (novoNome && novoNome !== imob.nome) {
              window.location.href = caminhoPainel(novoNome, token);
              return;
            }
            voltar();
          }}
        />
      ) : null}
    </div>
  );
}

function FormEditar({
  imob,
  token,
  onFim,
}: {
  imob: Omit<ImobiliariaSpl, "token_painel">;
  token: string;
  onFim: (novoNome?: string) => void;
}) {
  const pixTipo = (imob.chave_pix_tipo ?? "") as PixTipo | "";
  const [f, setF] = useState({
    nome: imob.nome,
    responsavel: imob.responsavel,
    telefone: mascaraTelefone(imob.telefone),
    email: imob.email,
    cnpj: imob.cnpj ? mascaraCnpj(imob.cnpj) : "",
    chave_pix_tipo: pixTipo,
    chave_pix: imob.chave_pix ? (pixTipo ? mascaraPix(pixTipo, imob.chave_pix) : imob.chave_pix) : "",
    modelo_parceria: imob.modelo_parceria as ModeloParceria,
    quantidade_vendedores: String(imob.quantidade_vendedores ?? 0),
    modelo_vendedores: imob.modelo_vendedores as ModeloVendedoresImob,
  });
  const [logo, setLogo] = useState<File | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const podeMudarModelo = imob.status === "PENDENTE";
  const soLibera = f.modelo_parceria === "SOMENTE_LIBERAR_CARTEIRA";
  const opcoes = opcoesRemuneracaoVendedor(f.modelo_parceria);

  async function salvar() {
    setErro(null);
    setSalvando(true);
    try {
      const body = new FormData();
      body.set("token", token);
      Object.entries(f).forEach(([k, v]) => body.set(k, String(v)));
      if (logo) body.set("logo", logo);
      const res = await fetch("/api/public/spl/imobiliaria/editar", { method: "POST", body });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      onFim(data.nome);
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Não foi possível salvar.");
    } finally {
      setSalvando(false);
    }
  }

  return (
    <Cartao className="space-y-4">
      <Voltar onClick={() => onFim()} />
      <h2 className="text-2xl font-black text-[#0A1931]">Editar dados da imobiliária</h2>
      <Campo rotulo="Nome da imobiliária">
        <input className={inputGrande} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </Campo>
      <Campo rotulo="Trocar logo (opcional)" dica="PNG, JPG ou WEBP de até 5 MB.">
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setLogo(e.target.files?.[0] ?? null)}
          className="block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-4 text-base"
        />
      </Campo>
      <Campo rotulo="Responsável">
        <input className={inputGrande} value={f.responsavel} onChange={(e) => set("responsavel", e.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Celular / WhatsApp">
          <input className={inputGrande} inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} />
        </Campo>
        <Campo rotulo="E-mail">
          <input className={inputGrande} inputMode="email" value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
      </div>
      <Campo rotulo="CNPJ">
        <input className={inputGrande} inputMode="numeric" value={f.cnpj} onChange={(e) => set("cnpj", mascaraCnpj(e.target.value))} placeholder="00.000.000/0000-00" />
      </Campo>
      <CampoPix
        rotulo={soLibera ? "Chave PIX (opcional)" : "Chave PIX para receber as comissões"}
        tipo={f.chave_pix_tipo}
        valor={f.chave_pix}
        onTipo={(t) => set("chave_pix_tipo", t)}
        onValor={(v) => set("chave_pix", v)}
      />
      <div>
        <p className="text-base font-bold text-slate-800">Modelo de parceria</p>
        {podeMudarModelo ? (
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            {MODELOS_PARCERIA.map((m) => (
              <button
                key={m.value}
                type="button"
                onClick={() => set("modelo_parceria", m.value)}
                className={`rounded-2xl border-2 px-3 py-3 text-left text-base font-bold ${f.modelo_parceria === m.value ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
              >
                {m.label} {m.percentual !== "—" ? `· ${m.percentual}` : ""}
              </button>
            ))}
          </div>
        ) : (
          <p className="mt-1 text-base text-slate-600">
            {labelDe(MODELOS_PARCERIA, imob.modelo_parceria)}. Depois da aprovação, a mudança de modelo é feita pela nossa equipe.
          </p>
        )}
      </div>
      <Campo rotulo="Quantos vendedores trabalham com você?">
        <input className={inputGrande} inputMode="numeric" value={f.quantidade_vendedores} onChange={(e) => set("quantidade_vendedores", e.target.value.replace(/\D/g, "").slice(0, 4))} />
      </Campo>
      <p className="text-base font-bold text-slate-800">Como pretende remunerar os vendedores?</p>
      <div className="grid gap-2">
        {opcoes.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={!o.permitido}
            onClick={() => set("modelo_vendedores", o.value)}
            className={`rounded-2xl border-2 px-4 py-3 text-left text-base font-bold disabled:opacity-45 ${f.modelo_vendedores === o.value ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {o.label} {o.doVendedor ? `· vendedor ${pct(o.doVendedor)} · fica ${pct(o.ficaImobiliaria)} com você` : ""}
          </button>
        ))}
        {!soLibera ? (
          <button
            type="button"
            onClick={() => set("modelo_vendedores", "POR_VENDEDOR")}
            className={`rounded-2xl border-2 px-4 py-3 text-left text-base font-bold ${f.modelo_vendedores === "POR_VENDEDOR" ? "border-[#153E90] bg-[#153E90] text-white" : "border-dashed border-slate-300 bg-white"}`}
          >
            {POR_VENDEDOR_OPCAO.label}
          </button>
        ) : null}
      </div>
      {erro ? <Aviso>{erro}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={salvar} disabled={salvando} className="w-full">
        {salvando ? "Salvando…" : "Salvar alterações"}
      </BotaoGrande>
    </Cartao>
  );
}

function Voltar({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" onClick={onClick} className="text-lg font-bold text-[#153E90]">
      ← Voltar ao painel
    </button>
  );
}

function FormCliente({ token, empreendimentos, onFim }: { token: string; empreendimentos: EmpreendimentoSpl[]; onFim: () => void }) {
  const [f, setF] = useState({ nome: "", telefone: "", email: "", empreendimento_slug: "", unidade: "", situacao: "", valor_chaves: "" });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = (k: keyof typeof f, v: string) => setF((p) => ({ ...p, [k]: v }));

  async function salvar() {
    setErro(null);
    setOk(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/public/spl/cliente", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...f }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível salvar.");
      setOk(`${f.nome} cadastrado. Pode cadastrar o próximo.`);
      setF({ nome: "", telefone: "", email: "", empreendimento_slug: f.empreendimento_slug, unidade: "", situacao: f.situacao, valor_chaves: "" });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao salvar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onFim} />
      <h2 className="text-2xl font-black text-[#0A1931]">Cadastrar cliente</h2>
      <Campo rotulo="Nome do cliente">
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
      <p className="text-base font-bold">Empreendimento</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {empreendimentos.map((e) => (
          <button
            key={e.slug}
            type="button"
            onClick={() => set("empreendimento_slug", e.slug)}
            className={`rounded-2xl border-2 px-3 py-4 text-lg font-bold ${f.empreendimento_slug === e.slug ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {e.nome}
          </button>
        ))}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Unidade (opcional)">
          <input className={inputGrande} value={f.unidade} onChange={(e) => set("unidade", e.target.value)} placeholder="Torre 1 · 302" />
        </Campo>
        <Campo rotulo="Valor na entrega das chaves (opcional)">
          <input className={inputGrande} inputMode="numeric" value={f.valor_chaves} onChange={(e) => set("valor_chaves", e.target.value)} placeholder="350.000" />
        </Campo>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {[
          ["JA_COMPROU", "Já comprou"],
          ["VAI_COMPRAR", "Vai comprar"],
        ].map(([v, l]) => (
          <button
            key={v}
            type="button"
            onClick={() => set("situacao", v)}
            className={`rounded-2xl border-2 px-3 py-4 text-lg font-bold ${f.situacao === v ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {l}
          </button>
        ))}
      </div>
      {erro ? <Aviso>{erro}</Aviso> : null}
      {ok ? <Aviso tom="ok">{ok}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={salvar} disabled={enviando} className="w-full">
        {enviando ? "Salvando…" : "Salvar cliente"}
      </BotaoGrande>
    </Cartao>
  );
}

function FormPlanilha({ token, empreendimentos, onFim }: { token: string; empreendimentos: EmpreendimentoSpl[]; onFim: () => void }) {
  const [linhas, setLinhas] = useState<LinhaCarteira[]>([]);
  const [msg, setMsg] = useState<{ tom: "erro" | "ok"; texto: string } | null>(null);
  const [ocupado, setOcupado] = useState(false);

  async function abrir(file?: File) {
    if (!file) return;
    setMsg(null);
    try {
      const l = await lerPlanilhaCarteira(file, empreendimentos);
      if (!l.length) throw new Error("Preencha os clientes abaixo do cabeçalho.");
      setLinhas(l);
    } catch (e) {
      setLinhas([]);
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Não foi possível ler a planilha." });
    }
  }

  async function importar() {
    setOcupado(true);
    setMsg(null);
    try {
      const res = await fetch("/api/public/spl/planilha", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, linhas }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Falha na importação.");
      const erros = (data.erros ?? []) as { linha: number; erro: string }[];
      setMsg({
        tom: "ok",
        texto: `${data.incluidos} cliente(s) importado(s).${erros.length ? ` ${erros.length} linha(s) com problema: ${erros.slice(0, 5).map((e) => `linha ${e.linha} (${e.erro})`).join("; ")}` : ""}`,
      });
      setLinhas([]);
    } catch (e) {
      setMsg({ tom: "erro", texto: e instanceof Error ? e.message : "Falha na importação." });
    } finally {
      setOcupado(false);
    }
  }

  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onFim} />
      <h2 className="text-2xl font-black text-[#0A1931]">Subir planilha de clientes</h2>
      <p className="text-lg text-slate-600">Baixe o modelo, preencha e envie. Até 300 clientes por arquivo.</p>
      <BotaoGrande tipo="secundario" onClick={() => void baixarModeloCarteira()}>
        Baixar modelo da planilha
      </BotaoGrande>
      <input
        type="file"
        accept=".xls,.xlsx,.csv"
        onChange={(e) => void abrir(e.target.files?.[0])}
        className="block w-full rounded-2xl border-2 border-dashed border-slate-300 bg-white p-5 text-lg"
      />
      {linhas.length ? (
        <>
          <p className="text-lg font-bold">{linhas.length} cliente(s) encontrado(s)</p>
          <ul className="max-h-64 divide-y overflow-y-auto rounded-2xl border">
            {linhas.map((l, i) => (
              <li key={i} className="px-4 py-2">
                {l.nome} · {l.telefone} {l.empreendimento_slug ? `· ${l.empreendimento_slug}` : ""}
              </li>
            ))}
          </ul>
          <BotaoGrande tipo="ouro" onClick={importar} disabled={ocupado} className="w-full">
            {ocupado ? "Importando…" : `Importar ${linhas.length} cliente(s)`}
          </BotaoGrande>
        </>
      ) : null}
      {msg ? <Aviso tom={msg.tom}>{msg.texto}</Aviso> : null}
    </Cartao>
  );
}

function FormVendedor({
  token,
  padrao,
  modeloImob,
  nomeImob,
  onFim,
}: {
  token: string;
  padrao: ModeloVendedor;
  modeloImob: ModeloParceria;
  nomeImob: string;
  onFim: () => void;
}) {
  const [f, setF] = useState({ nome: "", telefone: "", email: "", cpf: "", chave_pix: "", chave_pix_tipo: "" as PixTipo | "", modelo: padrao as string });
  const [erro, setErro] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const set = <K extends keyof typeof f>(k: K, v: (typeof f)[K]) => setF((p) => ({ ...p, [k]: v }));
  const recebe = f.modelo !== "PROPRIO";
  const opcoes = opcoesRemuneracaoVendedor(modeloImob);
  const escolhida = opcoes.find((o) => o.value === f.modelo);

  async function salvar() {
    setErro(null);
    setOk(null);
    setEnviando(true);
    try {
      const res = await fetch("/api/public/spl/vendedor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, ...f }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Não foi possível cadastrar.");
      setOk(`${data.nome} entrou na sua rede. Portfólio: ${window.location.origin}${caminhoPortfolio(nomeImob, data.codigo)}`);
      setF({ nome: "", telefone: "", email: "", cpf: "", chave_pix: "", chave_pix_tipo: "", modelo: f.modelo });
    } catch (e) {
      setErro(e instanceof Error ? e.message : "Erro ao cadastrar.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Cartao className="space-y-4">
      <Voltar onClick={onFim} />
      <h2 className="text-2xl font-black text-[#0A1931]">Cadastrar vendedor</h2>
      <p className="text-base font-bold text-slate-800">Como vai remunerar este vendedor?</p>
      <div className="grid gap-2 sm:grid-cols-3">
        {opcoes.map((o) => (
          <button
            key={o.value}
            type="button"
            disabled={!o.permitido}
            onClick={() => set("modelo", o.value)}
            className={`rounded-2xl border-2 px-3 py-4 text-left text-base font-bold disabled:opacity-45 ${f.modelo === o.value ? "border-[#153E90] bg-[#153E90] text-white" : "border-slate-200 bg-white"}`}
          >
            {o.label}
            <span className="block text-sm font-semibold opacity-80">{o.doVendedor ? `${pct(o.doVendedor)} · fica ${pct(o.ficaImobiliaria)} com você` : "Você paga do seu jeito"}</span>
          </button>
        ))}
      </div>
      {escolhida?.repassaTudo ? (
        <Aviso tom="info">Neste modelo você repassa toda a sua comissão ({pct(escolhida.doVendedor)}) ao vendedor.</Aviso>
      ) : null}
      <Campo rotulo="Nome">
        <input className={inputGrande} value={f.nome} onChange={(e) => set("nome", e.target.value)} />
      </Campo>
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo rotulo="Celular / WhatsApp">
          <input className={inputGrande} inputMode="tel" value={f.telefone} onChange={(e) => set("telefone", mascaraTelefone(e.target.value))} placeholder="(66) 99999-9999" />
        </Campo>
        <Campo rotulo="E-mail (opcional)">
          <input className={inputGrande} value={f.email} onChange={(e) => set("email", e.target.value)} />
        </Campo>
      </div>
      {recebe ? (
        <>
          <Campo rotulo="CPF">
            <input className={inputGrande} inputMode="numeric" value={f.cpf} onChange={(e) => set("cpf", mascaraCpf(e.target.value))} placeholder="000.000.000-00" />
          </Campo>
          <CampoPix tipo={f.chave_pix_tipo} valor={f.chave_pix} onTipo={(t) => set("chave_pix_tipo", t)} onValor={(v) => set("chave_pix", v)} />
        </>
      ) : (
        <Aviso tom="info">No modelo próprio a imobiliária paga o vendedor. Ele não vê comissão nem forma de pagamento.</Aviso>
      )}
      {erro ? <Aviso>{erro}</Aviso> : null}
      {ok ? <Aviso tom="ok">{ok}</Aviso> : null}
      <BotaoGrande tipo="ouro" onClick={salvar} disabled={enviando} className="w-full">
        {enviando ? "Salvando…" : "Cadastrar vendedor"}
      </BotaoGrande>
    </Cartao>
  );
}
