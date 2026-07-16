export const NPS_TIPOS = ["escala_0_10", "sim_nao", "texto"] as const;
export type NpsTipo = (typeof NPS_TIPOS)[number];

export type NpsPerguntaFixa = {
  chave: string;
  titulo: string;
  tipo: NpsTipo;
  obrigatoria: boolean;
};

export type NpsPerguntaCustom = {
  id: string;
  titulo: string;
  tipo: NpsTipo;
  ativa: boolean;
};

/** Config persistida em eventos_sorteios.nps_config */
export type NpsConfigStored = {
  /** Chaves fixas desativadas (ausente = ativa) */
  desativadas?: string[];
  custom?: NpsPerguntaCustom[];
};

export type NpsPerguntaPublica = {
  chave: string;
  titulo: string;
  tipo: NpsTipo;
  fixa: boolean;
  obrigatoria: boolean;
};

export const NPS_PERGUNTAS_FIXAS: NpsPerguntaFixa[] = [
  {
    chave: "recomendacao_evento",
    titulo: "De 0 a 10, quanto você recomendaria este evento?",
    tipo: "escala_0_10",
    obrigatoria: true,
  },
  {
    chave: "conteudo_apresentado",
    titulo: "Conteúdo apresentado",
    tipo: "escala_0_10",
    obrigatoria: true,
  },
  {
    chave: "clareza_temas",
    titulo: "Clareza dos temas",
    tipo: "escala_0_10",
    obrigatoria: true,
  },
  {
    chave: "ambiente",
    titulo: "Ambiente",
    tipo: "escala_0_10",
    obrigatoria: true,
  },
  {
    chave: "duracao_apresentacao",
    titulo: "Duração da apresentação",
    tipo: "escala_0_10",
    obrigatoria: true,
  },
  {
    chave: "alimentacao",
    titulo: "Alimentação (se aplicável)",
    tipo: "escala_0_10",
    obrigatoria: false,
  },
  {
    chave: "contato_diagnostico",
    titulo: "Podemos te contatar para um diagnóstico gratuito?",
    tipo: "sim_nao",
    obrigatoria: true,
  },
  {
    chave: "comentario",
    titulo: "Quer deixar um comentário?",
    tipo: "texto",
    obrigatoria: false,
  },
];

export function defaultNpsConfig(): NpsConfigStored {
  return { desativadas: [], custom: [] };
}

export function parseNpsConfig(raw: unknown): NpsConfigStored {
  if (!raw || typeof raw !== "object") return defaultNpsConfig();
  const obj = raw as Record<string, unknown>;
  const desativadas = Array.isArray(obj.desativadas)
    ? obj.desativadas.filter((x): x is string => typeof x === "string")
    : [];
  const customRaw = Array.isArray(obj.custom) ? obj.custom : [];
  const custom: NpsPerguntaCustom[] = [];
  for (const item of customRaw) {
    if (!item || typeof item !== "object") continue;
    const c = item as Record<string, unknown>;
    const id = typeof c.id === "string" ? c.id : "";
    const titulo = typeof c.titulo === "string" ? c.titulo.trim() : "";
    const tipo = NPS_TIPOS.includes(c.tipo as NpsTipo) ? (c.tipo as NpsTipo) : null;
    if (!id || !titulo || !tipo) continue;
    custom.push({ id, titulo, tipo, ativa: c.ativa !== false });
  }
  return { desativadas, custom };
}

/** Perguntas ativas para o formulário público. */
export function resolverPerguntasNpsPublicas(config: NpsConfigStored): NpsPerguntaPublica[] {
  const desativadas = new Set(config.desativadas ?? []);
  const fixas = NPS_PERGUNTAS_FIXAS.filter((p) => !desativadas.has(p.chave)).map((p) => ({
    chave: p.chave,
    titulo: p.titulo,
    tipo: p.tipo,
    fixa: true,
    obrigatoria: p.obrigatoria,
  }));
  const custom = (config.custom ?? [])
    .filter((p) => p.ativa)
    .map((p) => ({
      chave: `custom_${p.id}`,
      titulo: p.titulo,
      tipo: p.tipo,
      fixa: false,
      obrigatoria: true,
    }));
  return [...fixas, ...custom];
}

export type NpsRespostaValor = number | boolean | string | null;

export function validarRespostasNps(
  perguntas: NpsPerguntaPublica[],
  respostas: Record<string, unknown>,
): { ok: true; clean: Record<string, NpsRespostaValor> } | { ok: false; error: string } {
  const clean: Record<string, NpsRespostaValor> = {};
  for (const p of perguntas) {
    const raw = respostas[p.chave];
    if (p.tipo === "escala_0_10") {
      if (raw === undefined || raw === null || raw === "") {
        if (p.obrigatoria) return { ok: false, error: `Responda: ${p.titulo}` };
        clean[p.chave] = null;
        continue;
      }
      const n = typeof raw === "number" ? raw : Number(raw);
      if (!Number.isInteger(n) || n < 0 || n > 10) {
        return { ok: false, error: `${p.titulo}: escolha de 0 a 10.` };
      }
      clean[p.chave] = n;
      continue;
    }
    if (p.tipo === "sim_nao") {
      if (raw === true || raw === "sim" || raw === "true") {
        clean[p.chave] = true;
        continue;
      }
      if (raw === false || raw === "nao" || raw === "não" || raw === "false") {
        clean[p.chave] = false;
        continue;
      }
      if (p.obrigatoria) return { ok: false, error: `Responda: ${p.titulo}` };
      clean[p.chave] = null;
      continue;
    }
    const texto = typeof raw === "string" ? raw.trim() : "";
    if (!texto && p.obrigatoria) return { ok: false, error: `Preencha: ${p.titulo}` };
    clean[p.chave] = texto || null;
  }
  return { ok: true, clean };
}
