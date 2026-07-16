import type { ContratacaoOnlineRow } from "./types";
import type { LinhaGrupoPropostaResumo } from "./extract-fields";
import { formatCurrency, formatWhatsappBrInput, formatCpfBrInput, formatCnpjBrInput } from "@/lib/utils/format";
import { formatCepBrInput } from "./endereco";

export type FichaCampo = { label: string; value: string };

function money(v: number | null | undefined): string {
  return v != null && Number.isFinite(v) ? formatCurrency(v) : "";
}

function pushCampo(out: FichaCampo[], label: string, value: string | null | undefined) {
  const v = value?.trim();
  if (!v) return;
  out.push({ label, value: v });
}

export function buildFichaAdministradoraCampos(args: {
  contratacao: ContratacaoOnlineRow;
  resumoFinanceiro: Record<string, number | string | null>;
  gruposLinhas: LinhaGrupoPropostaResumo[];
}): FichaCampo[] {
  const { contratacao: c, resumoFinanceiro: fin, gruposLinhas } = args;
  const out: FichaCampo[] = [];

  pushCampo(out, "Protocolo", c.protocolo);
  pushCampo(out, "Nome", c.nome);
  pushCampo(out, "Telefone / WhatsApp", c.telefone ? formatWhatsappBrInput(c.telefone) : null);
  pushCampo(out, "E-mail", c.email);
  pushCampo(out, "Tipo pessoa", c.tipo_pessoa?.toUpperCase() ?? null);

  if (c.tipo_pessoa === "cpf") {
    pushCampo(out, "CPF", c.cpf ? formatCpfBrInput(c.cpf) : null);
    pushCampo(out, "Data nascimento", c.data_nascimento?.slice(0, 10) ?? null);
  } else if (c.tipo_pessoa === "cnpj") {
    pushCampo(out, "Razão social", c.razao_social);
    pushCampo(out, "CNPJ", c.cnpj ? formatCnpjBrInput(c.cnpj) : null);
    pushCampo(out, "Responsável", c.responsavel_nome);
    pushCampo(
      out,
      "CPF responsável",
      c.responsavel_cpf ? formatCpfBrInput(c.responsavel_cpf) : null,
    );
  }

  pushCampo(out, "CEP", c.cep ? formatCepBrInput(c.cep) : null);
  pushCampo(out, "Endereço", c.endereco);
  pushCampo(out, "Número", c.numero);
  pushCampo(out, "Complemento", c.complemento);
  pushCampo(out, "Bairro", c.bairro);
  pushCampo(
    out,
    "Cidade/UF",
    [c.cidade, c.uf?.toUpperCase()].filter(Boolean).join(" / ") || null,
  );

  pushCampo(out, "Administradora", c.administradora);
  pushCampo(out, "Tipo do bem", c.tipo_bem);
  pushCampo(out, "Crédito selecionado", money(c.credito_selecionado));
  pushCampo(out, "Parcela inicial", money(c.parcela_estimada));
  pushCampo(out, "Prazo (meses)", c.prazo != null ? String(c.prazo) : null);
  pushCampo(out, "Parcela integral", money(fin.parcelaIntegral as number));
  pushCampo(out, "Parcela reduzida", money(fin.parcelaReduzida as number));
  pushCampo(out, "Parcela após contemplação", money(fin.parcelaPosContemplacao as number));
  pushCampo(out, "Saldo devedor", money(fin.saldoDevedor as number));
  pushCampo(out, "Crédito líquido", money(fin.creditoLiquido as number));
  pushCampo(out, "Lance total", money(fin.lanceTotal as number));
  pushCampo(out, "Forma pagamento", c.forma_pagamento ?? null);

  gruposLinhas.forEach((g, i) => {
    const prefix = gruposLinhas.length > 1 ? `Grupo ${i + 1} — ` : "Grupo — ";
    pushCampo(out, `${prefix}Número`, g.codigoGrupo);
    pushCampo(out, `${prefix}Modalidade`, g.modalidade);
    pushCampo(
      out,
      `${prefix}Qtd. cotas`,
      g.quantidadeCotas > 0 ? String(g.quantidadeCotas) : null,
    );
    pushCampo(
      out,
      `${prefix}Meses decorridos`,
      g.parcelasRealizadas != null ? `${g.parcelasRealizadas} meses` : null,
    );
  });

  return out;
}

export function formatFichaAdministradoraText(campos: FichaCampo[]): string {
  return campos.map((c) => `${c.label}: ${c.value}`).join("\n");
}

/** Dados de simulação de grupos dentro do lead (estrutura aninhada de contratação online). */
export function dadosSimulacaoGruposFromLead(
  leadDadosSimulacao: unknown,
): Record<string, unknown> {
  if (!leadDadosSimulacao || typeof leadDadosSimulacao !== "object") return {};
  const ds = leadDadosSimulacao as Record<string, unknown>;
  const inner = ds.dados_simulacao;
  if (inner && typeof inner === "object" && !Array.isArray(inner)) {
    return inner as Record<string, unknown>;
  }
  if (Array.isArray(ds.selecoes)) return ds;
  return ds;
}
