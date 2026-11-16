import { isValidBrazilianPhone, normalizePhoneForLead } from "@/lib/crm/upsert-lead";
import {
  MODELOS_PARCERIA,
  MODELOS_VENDEDOR,
  SOLUCOES,
  type ModeloParceria,
  type ModeloVendedor,
  type SolucaoSpl,
} from "./types";

type Ok<T> = { ok: true; data: T };
type Erro = { ok: false; error: string };

const txt = (v: unknown, max = 160) => String(v ?? "").trim().slice(0, max);
const digitos = (v: unknown) => String(v ?? "").replace(/\D/g, "");
const emailValido = (e: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e);

export function cnpjValido(cnpj: string): boolean {
  if (!/^\d{14}$/.test(cnpj) || /^(\d)\1{13}$/.test(cnpj)) return false;
  const calc = (base: string, pesos: number[]) => {
    const soma = base.split("").reduce((a, d, i) => a + Number(d) * pesos[i]!, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const d1 = calc(cnpj.slice(0, 12), [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  const d2 = calc(cnpj.slice(0, 12) + d1, [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]);
  return cnpj.endsWith(`${d1}${d2}`);
}

export function cpfValido(cpf: string): boolean {
  if (!/^\d{11}$/.test(cpf) || /^(\d)\1{10}$/.test(cpf)) return false;
  for (let t = 9; t <= 10; t++) {
    let soma = 0;
    for (let i = 0; i < t; i++) soma += Number(cpf[i]) * (t + 1 - i);
    if (((soma * 10) % 11) % 10 !== Number(cpf[t])) return false;
  }
  return true;
}

export type CadastroImobiliariaInput = {
  nome: string;
  responsavel: string;
  telefone: string;
  email: string;
  cnpj: string | null;
  chave_pix: string | null;
  modelo_parceria: ModeloParceria;
  quantidade_vendedores: number;
  modelo_vendedores: ModeloVendedor;
};

export function validarCadastroImobiliaria(raw: Record<string, unknown>): Ok<CadastroImobiliariaInput> | Erro {
  const nome = txt(raw.nome);
  const responsavel = txt(raw.responsavel);
  const telefone = normalizePhoneForLead(txt(raw.telefone, 40));
  const email = txt(raw.email, 200).toLowerCase();
  const cnpj = digitos(raw.cnpj);
  const chave_pix = txt(raw.chave_pix, 140);
  const modelo_parceria = txt(raw.modelo_parceria, 40) as ModeloParceria;
  const modelo_vendedores = (txt(raw.modelo_vendedores, 40) || "PROPRIO") as ModeloVendedor;
  const quantidade_vendedores = Math.floor(Number(raw.quantidade_vendedores ?? 0));

  if (nome.length < 2) return { ok: false, error: "Informe o nome da imobiliária." };
  if (responsavel.length < 3) return { ok: false, error: "Informe o nome do responsável." };
  if (!isValidBrazilianPhone(telefone)) return { ok: false, error: "Telefone inválido. Inclua o DDD." };
  if (!emailValido(email)) return { ok: false, error: "E-mail inválido." };
  if (!MODELOS_PARCERIA.some((m) => m.value === modelo_parceria)) return { ok: false, error: "Escolha o modelo de parceria." };
  if (!MODELOS_VENDEDOR.some((m) => m.value === modelo_vendedores)) return { ok: false, error: "Escolha o modelo de trabalho dos vendedores." };
  if (!Number.isFinite(quantidade_vendedores) || quantidade_vendedores < 0 || quantidade_vendedores > 1000) {
    return { ok: false, error: "Quantidade de vendedores inválida." };
  }
  const participa = modelo_parceria !== "SOMENTE_LIBERAR_CARTEIRA";
  if (cnpj && !cnpjValido(cnpj)) return { ok: false, error: "CNPJ inválido." };
  if (participa && !cnpj) return { ok: false, error: "Informe o CNPJ da imobiliária." };
  if (participa && chave_pix.length < 3) return { ok: false, error: "Informe a chave PIX para receber as comissões." };

  return {
    ok: true,
    data: {
      nome,
      responsavel,
      telefone,
      email,
      cnpj: cnpj || null,
      chave_pix: participa ? chave_pix : chave_pix || null,
      modelo_parceria,
      quantidade_vendedores,
      modelo_vendedores,
    },
  };
}

export type CadastroVendedorInput = {
  nome: string;
  telefone: string;
  email: string | null;
  cpf: string | null;
  chave_pix: string | null;
};

/** O PIX só é pedido quando o vendedor recebe comissão pela parceria. */
export function validarCadastroVendedor(raw: Record<string, unknown>, modelo: ModeloVendedor): Ok<CadastroVendedorInput> | Erro {
  const nome = txt(raw.nome);
  const telefone = normalizePhoneForLead(txt(raw.telefone, 40));
  const email = txt(raw.email, 200).toLowerCase();
  const cpf = digitos(raw.cpf);
  const chave_pix = txt(raw.chave_pix, 140);
  if (nome.length < 3) return { ok: false, error: "Informe seu nome completo." };
  if (!isValidBrazilianPhone(telefone)) return { ok: false, error: "Telefone inválido. Inclua o DDD." };
  if (email && !emailValido(email)) return { ok: false, error: "E-mail inválido." };
  const recebe = modelo !== "PROPRIO";
  if (recebe && !cpfValido(cpf)) return { ok: false, error: "Informe um CPF válido para receber as comissões." };
  if (!recebe && cpf && !cpfValido(cpf)) return { ok: false, error: "CPF inválido." };
  if (recebe && chave_pix.length < 3) return { ok: false, error: "Informe a chave PIX para receber as comissões." };
  return {
    ok: true,
    data: { nome, telefone, email: email || null, cpf: cpf || null, chave_pix: recebe ? chave_pix : null },
  };
}

export type CadastroClienteInput = {
  nome: string;
  telefone: string;
  email: string | null;
  empreendimento_slug: string | null;
  unidade: string | null;
  situacao: "JA_COMPROU" | "VAI_COMPRAR" | null;
  valor_chaves: number | null;
  solucao: SolucaoSpl | null;
};

export function valorMonetarioBr(v: unknown): number | null {
  if (typeof v === "number") return Number.isFinite(v) && v > 0 ? v : null;
  const s = String(v ?? "").replace(/R\$\s*/g, "").replace(/\s/g, "").trim();
  if (!s) return null;
  const n = s.includes(",") ? Number(s.replace(/\./g, "").replace(",", ".")) : Number(s.replace(/\.(?=\d{3}(\D|$))/g, ""));
  return Number.isFinite(n) && n > 0 ? Math.round(n * 100) / 100 : null;
}

export function validarCadastroCliente(raw: Record<string, unknown>): Ok<CadastroClienteInput> | Erro {
  const nome = txt(raw.nome);
  const telefone = normalizePhoneForLead(txt(raw.telefone, 40));
  const email = txt(raw.email, 200).toLowerCase();
  const empreendimento_slug = txt(raw.empreendimento_slug, 40).toLowerCase() || null;
  const unidade = txt(raw.unidade, 60) || null;
  const situacaoRaw = txt(raw.situacao, 20);
  const situacao = situacaoRaw === "JA_COMPROU" || situacaoRaw === "VAI_COMPRAR" ? situacaoRaw : null;
  const solucaoRaw = txt(raw.solucao, 40);
  const solucao = SOLUCOES.some((s) => s.value === solucaoRaw) ? (solucaoRaw as SolucaoSpl) : null;
  const valor_chaves = valorMonetarioBr(raw.valor_chaves);
  if (nome.length < 2) return { ok: false, error: "Informe o nome do cliente." };
  if (!isValidBrazilianPhone(telefone)) return { ok: false, error: "Telefone do cliente inválido. Inclua o DDD." };
  if (email && !emailValido(email)) return { ok: false, error: "E-mail do cliente inválido." };
  return {
    ok: true,
    data: { nome, telefone, email: email || null, empreendimento_slug, unidade, situacao, valor_chaves, solucao },
  };
}

/** Código curto legível (sem 0/O/1/I) para convites e links de vendedor. */
export function gerarCodigo(tamanho = 8, rand: () => number = Math.random): string {
  const alfabeto = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < tamanho; i++) s += alfabeto[Math.floor(rand() * alfabeto.length)];
  return s;
}
