/** Regras de template e de envio compartilhadas entre servidor e navegador (sem dependências). */

export type BotaoTemplate =
  | { tipo: "QUICK_REPLY"; texto: string }
  | { tipo: "URL"; texto: string; url: string }
  | { tipo: "PHONE_NUMBER"; texto: string; telefone: string };

export type TemplateForm = {
  nome: string;
  categoria: "MARKETING" | "UTILITY";
  idioma: string;
  cabecalhoTipo: "NENHUM" | "TEXTO" | "IMAGEM";
  cabecalhoTexto: string;
  corpo: string;
  exemplos: string[];
  rodape: string;
  botoes: BotaoTemplate[];
};

export type ComponenteMeta = {
  type: string;
  format?: string;
  text?: string;
  example?: Record<string, unknown>;
  buttons?: { type: string; text: string; url?: string; phone_number?: string }[];
};

export type TemplateView = {
  id: string;
  waba_id: string;
  nome: string;
  idioma: string;
  categoria: string;
  status: string;
  motivo: string | null;
  componentes: ComponenteMeta[];
  header_midia_url: string | null;
  sincronizado_em: string | null;
};

export const STATUS_TEMPLATE: Record<string, { rotulo: string; cor: string }> = {
  APPROVED: { rotulo: "Aprovado", cor: "bg-emerald-100 text-emerald-800" },
  PENDING: { rotulo: "Pendente", cor: "bg-amber-100 text-amber-800" },
  IN_APPEAL: { rotulo: "Em recurso", cor: "bg-amber-100 text-amber-800" },
  REJECTED: { rotulo: "Rejeitado", cor: "bg-red-100 text-red-800" },
  PAUSED: { rotulo: "Pausado pela Meta", cor: "bg-orange-100 text-orange-800" },
  DISABLED: { rotulo: "Desativado", cor: "bg-slate-200 text-slate-700" },
  ARCHIVED: { rotulo: "Arquivado", cor: "bg-slate-200 text-slate-700" },
};

/** Números das variáveis {{n}} na ordem em que aparecem, sem repetir. */
export function variaveisDoTexto(texto: string): number[] {
  const vistos = new Set<number>();
  for (const m of texto.matchAll(/\{\{\s*(\d+)\s*\}\}/g)) vistos.add(Number(m[1]));
  return [...vistos].sort((a, b) => a - b);
}

export function nomeTemplateValido(nome: string) {
  return /^[a-z][a-z0-9_]{0,511}$/.test(nome);
}

/** Converte o que foi digitado em um nome aceito pela Meta (minúsculas, números e _). */
export function normalizarNomeTemplate(v: string) {
  return v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+/, "").slice(0, 60);
}

export function validarTemplate(f: TemplateForm, temImagem: boolean): string | null {
  if (!nomeTemplateValido(f.nome)) return "Nome: use só letras minúsculas, números e _ (comece por letra).";
  if (!["MARKETING", "UTILITY"].includes(f.categoria)) return "Escolha a categoria.";
  const corpo = f.corpo.trim();
  if (!corpo) return "Escreva o corpo da mensagem.";
  if (corpo.length > 1024) return "O corpo passa de 1.024 caracteres.";
  const vars = variaveisDoTexto(corpo);
  if (vars.some((n, i) => n !== i + 1)) return "As variáveis precisam ser seguidas: {{1}}, {{2}}, {{3}}…";
  if (/^\{\{\s*\d+\s*\}\}/.test(corpo) || /\{\{\s*\d+\s*\}\}$/.test(corpo)) return "O corpo não pode começar nem terminar com uma variável.";
  for (const n of vars) if (!f.exemplos[n - 1]?.trim()) return `Informe um exemplo para a variável {{${n}}}.`;
  if (f.cabecalhoTipo === "TEXTO") {
    const c = f.cabecalhoTexto.trim();
    if (!c) return "Escreva o texto do cabeçalho ou escolha 'sem cabeçalho'.";
    if (c.length > 60) return "O cabeçalho passa de 60 caracteres.";
    if (/\{\{/.test(c)) return "O cabeçalho não aceita variáveis aqui.";
  }
  if (f.cabecalhoTipo === "IMAGEM" && !temImagem) return "Envie a imagem do cabeçalho (JPG ou PNG de até 5 MB).";
  if (f.rodape.trim().length > 60) return "O rodapé passa de 60 caracteres.";
  if (/\{\{/.test(f.rodape)) return "O rodapé não aceita variáveis.";
  if (f.botoes.length > 10) return "No máximo 10 botões.";
  if (f.botoes.filter((b) => b.tipo === "URL").length > 2) return "No máximo 2 botões de link.";
  if (f.botoes.filter((b) => b.tipo === "PHONE_NUMBER").length > 1) return "No máximo 1 botão de telefone.";
  for (const b of f.botoes) {
    const t = b.texto.trim();
    if (!t || t.length > 25) return "Cada botão precisa de um texto de até 25 caracteres.";
    if (b.tipo === "URL" && !/^https:\/\/[^\s]+$/.test(b.url.trim())) return "O link do botão precisa começar com https://";
    if (b.tipo === "PHONE_NUMBER" && !/^\+[1-9]\d{7,14}$/.test(b.telefone.replace(/[^\d+]/g, ""))) return "Telefone do botão: use +55 e DDD.";
  }
  return null;
}

/** Componentes no formato da Graph API para POST /{waba}/message_templates. */
export function montarComponentes(f: TemplateForm, headerHandle?: string | null): ComponenteMeta[] {
  const c: ComponenteMeta[] = [];
  if (f.cabecalhoTipo === "TEXTO") c.push({ type: "HEADER", format: "TEXT", text: f.cabecalhoTexto.trim() });
  if (f.cabecalhoTipo === "IMAGEM" && headerHandle) c.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [headerHandle] } });
  const corpo = f.corpo.trim();
  const vars = variaveisDoTexto(corpo);
  c.push({ type: "BODY", text: corpo, ...(vars.length ? { example: { body_text: [vars.map((n) => f.exemplos[n - 1].trim())] } } : {}) });
  if (f.rodape.trim()) c.push({ type: "FOOTER", text: f.rodape.trim() });
  if (f.botoes.length)
    c.push({
      type: "BUTTONS",
      buttons: f.botoes.map((b) =>
        b.tipo === "QUICK_REPLY"
          ? { type: "QUICK_REPLY", text: b.texto.trim() }
          : b.tipo === "URL"
            ? { type: "URL", text: b.texto.trim(), url: b.url.trim() }
            : { type: "PHONE_NUMBER", text: b.texto.trim(), phone_number: b.telefone.replace(/[^\d+]/g, "") },
      ),
    });
  return c;
}

export function componente(componentes: ComponenteMeta[], tipo: string) {
  return componentes.find((c) => c.type?.toUpperCase() === tipo);
}

/** Quantas variáveis o corpo do template espera. */
export function variaveisDoTemplate(componentes: ComponenteMeta[]) {
  return variaveisDoTexto(componente(componentes, "BODY")?.text ?? "").length;
}

export function preencherTexto(texto: string, valores: string[]) {
  return texto.replace(/\{\{\s*(\d+)\s*\}\}/g, (m, n) => valores[Number(n) - 1]?.trim() || m);
}

/** Componentes do envio (POST /{phone}/messages) para um template com variáveis e imagem. */
export function componentesDeEnvio(componentes: ComponenteMeta[], parametros: string[], headerMidiaUrl?: string | null) {
  const out: object[] = [];
  const h = componente(componentes, "HEADER");
  if (h?.format?.toUpperCase() === "IMAGE") {
    if (!headerMidiaUrl) throw new Error("O template tem imagem no cabeçalho, mas não há link da imagem.");
    out.push({ type: "header", parameters: [{ type: "image", image: { link: headerMidiaUrl } }] });
  }
  const n = variaveisDoTemplate(componentes);
  if (n) {
    if (parametros.length < n || parametros.slice(0, n).some((p) => !p?.trim())) throw new Error("Faltam valores para as variáveis do template.");
    out.push({ type: "body", parameters: parametros.slice(0, n).map((text) => ({ type: "text", text: text.trim().slice(0, 500) })) });
  }
  return out;
}

/** Fonte de cada variável do template na campanha. */
export const FONTES_VARIAVEL = [
  { value: "primeiro_nome", label: "Primeiro nome do contato" },
  { value: "nome", label: "Nome completo do contato" },
  { value: "fixo", label: "Texto fixo" },
] as const;

export function primeiroNome(nome: string | null | undefined) {
  const p = String(nome ?? "").trim().split(/\s+/)[0] ?? "";
  return p ? p.charAt(0).toUpperCase() + p.slice(1).toLowerCase() : "";
}

/** Resolve as variáveis para um destinatário; nome vazio vira "tudo bem". */
export function resolverParametros(variaveis: string[], nome: string | null | undefined) {
  return variaveis.map((v) => {
    if (v === "primeiro_nome") return primeiroNome(nome) || "tudo bem";
    if (v === "nome") return String(nome ?? "").trim() || "tudo bem";
    return v.startsWith("fixo:") ? v.slice(5) : v;
  });
}

/** Número no formato do WhatsApp (só dígitos, com DDI). Telefones do Brasil sem DDI ganham 55. */
export function numeroWhatsapp(raw: string | null | undefined): string | null {
  let d = String(raw ?? "").replace(/\D/g, "").replace(/^0+/, "");
  if (d.length === 10 || d.length === 11) d = "55" + d;
  return /^[1-9]\d{9,14}$/.test(d) ? d : null;
}

export function ehPedidoDeDescadastro(texto: string | null | undefined) {
  return /^(sair|parar|pare|stop|cancelar|descadastrar|remover|nao quero( mais)?( receber)?)[.! ]*$/.test(
    String(texto ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase(),
  );
}

/** Hora cheia (0–23) no fuso da operação. */
export function horaLocal(agora = new Date(), fuso = "America/Cuiaba") {
  return Number(new Intl.DateTimeFormat("en-GB", { timeZone: fuso, hour: "2-digit", hourCycle: "h23" }).format(agora));
}

export function dentroDaJanela(inicio: number, fim: number, agora = new Date()) {
  const h = horaLocal(agora);
  return h >= inicio && h < fim;
}

export const STATUS_CAMPANHA: Record<string, string> = {
  rascunho: "Rascunho",
  agendada: "Agendada",
  enviando: "Enviando",
  ativa: "Ativa",
  pausada: "Pausada",
  concluida: "Concluída",
  cancelada: "Cancelada",
};
