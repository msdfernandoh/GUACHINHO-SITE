"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { isMaster } from "@/lib/auth/permissions";
import { parseCartasWhatsAppLote } from "@/lib/cartas/parser";
import { getSplConfig } from "@/lib/spl/config-server";
import { formatCurrency } from "@/lib/utils/format";
import type { CartaTipo } from "@/lib/cartas/types";

export type OpcoesImportacaoCartas = {
  /** true: inativa as cartas ativas do mesmo tipo e administradora. false: só inclui. */
  substituir: boolean;
  /** Força imóvel ou veículo para todas as cartas do texto. null: lê do texto. */
  tipo: CartaTipo | null;
  /** Inclui também as cartas repetidas no texto (mensagem reenviada). */
  incluirRepetidas: boolean;
};

export type ResultadoImportacaoCartas = {
  ok: boolean;
  inativadas: number;
  incluidas: number;
  ignoradas: { linha: number; motivo: string }[];
  erro?: string;
};

async function exigirMaster() {
  const usuario = await requireUsuario();
  if (!isMaster(usuario.perfil)) throw new Error("Somente o master pode importar cartas.");
  return usuario;
}

const normalizar = (v: string | null | undefined) =>
  (v ?? "").normalize("NFD").replace(/[̀-ͯ]/g, "").trim().toLowerCase();

/**
 * Inclui as cartas do texto como disponíveis. Com `substituir`, inativa antes as
 * cartas ativas da mesma administradora e do mesmo tipo (veículo não mexe em imóvel).
 */
export async function importarCartasWhatsAppAction(
  texto: string,
  opcoes: OpcoesImportacaoCartas = { substituir: true, tipo: null, incluirRepetidas: false },
): Promise<ResultadoImportacaoCartas> {
  try {
    await exigirMaster();
    const config = await getSplConfig();
    const tipo = opcoes.tipo === "imovel" || opcoes.tipo === "automovel" ? opcoes.tipo : null;
    const itens = parseCartasWhatsAppLote(
      String(texto ?? ""),
      { imovel: config.margemEntradaCarta, automovel: config.margemEntradaCartaVeiculo },
      new Date(),
      tipo,
    );
    const ignoradas = itens.flatMap((item, i) =>
      item.erro
        ? [{ linha: i + 1, motivo: item.erro }]
        : item.repetida && !opcoes.incluirRepetidas
          ? [{ linha: i + 1, motivo: "Carta repetida no texto." }]
          : [],
    );
    const validas = itens.filter((item) => !item.erro && (opcoes.incluirRepetidas || !item.repetida));
    if (!validas.length) {
      return { ok: false, inativadas: 0, incluidas: 0, ignoradas, erro: "Nenhuma carta válida no texto colado." };
    }

    const db = createAdminClient();
    const { data: administradoras, error: adminErr } = await db
      .from("administradoras")
      .select("id, nome, nome_fantasia, razao_social, status")
      .eq("status", "ATIVA");
    if (adminErr) throw new Error("Não foi possível validar as administradoras.");

    const resolver = (nome: string | null) => {
      const alvo = normalizar(nome);
      if (!alvo) return null;
      return (
        (administradoras ?? []).find((a) =>
          [a.nome, a.nome_fantasia, a.razao_social].map(normalizar).some((n) => n && (n === alvo || n.includes(alvo))),
        ) ?? null
      );
    };

    const linhas = validas.map((item) => {
      const adm = resolver(item.administradora);
      if (!adm) throw new Error(`Administradora "${item.administradora ?? "?"}" não está cadastrada como ativa.`);
      return {
        tipo_carta: item.tipo_carta!,
        administradora_id: adm.id,
        administradora: adm.nome,
        credito: item.credito,
        entrada: item.entrada,
        prazo_quantidade: item.prazo_quantidade,
        valor_parcela: item.valor_parcela,
        saldo_devedor: item.saldo_devedor,
        proxima_parcela_data: item.proxima_parcela_data,
        taxa_transferencia: item.taxa_transferencia,
        texto_original: item.texto_original,
        status: "disponivel",
        ativo: true,
        destaque: false,
        observacoes: `Importada do WhatsApp. Entrada original ${formatCurrency(item.entrada_original ?? 0)} + margem ${formatCurrency(item.margem)}.`,
      };
    });

    // Só substitui o mesmo tipo: subir veículos não mexe nos imóveis, e vice-versa.
    let idsAtuais: string[] = [];
    if (opcoes.substituir) {
      const admIds = [...new Set(linhas.map((l) => l.administradora_id))];
      const tipos = [...new Set(linhas.map((l) => l.tipo_carta))];
      const { data: atuais, error: atuaisErr } = await db
        .from("cartas_contempladas")
        .select("id")
        .eq("ativo", true)
        .in("administradora_id", admIds)
        .in("tipo_carta", tipos);
      if (atuaisErr) throw new Error("Não foi possível ler as cartas atuais.");
      idsAtuais = (atuais ?? []).map((c: { id: string }) => c.id);
    }

    const { data: inseridas, error: insErr } = await db.from("cartas_contempladas").insert(linhas).select("id");
    if (insErr) throw new Error(`Não foi possível incluir as cartas: ${insErr.message}`);

    // Inativa somente depois que as novas entraram: o site nunca fica sem cartas.
    if (idsAtuais.length) {
      const { error: upErr } = await db
        .from("cartas_contempladas")
        .update({ ativo: false, status: "inativa", updated_at: new Date().toISOString() })
        .in("id", idsAtuais);
      if (upErr) throw new Error(`As novas cartas entraram, mas as antigas não foram inativadas: ${upErr.message}`);
    }

    revalidatePath("/admin/cartas-contempladas");
    revalidatePath("/cartas-contempladas");
    revalidatePath("/");
    return { ok: true, inativadas: idsAtuais.length, incluidas: inseridas?.length ?? 0, ignoradas };
  } catch (e) {
    return { ok: false, inativadas: 0, incluidas: 0, ignoradas: [], erro: e instanceof Error ? e.message : "Erro ao importar." };
  }
}
