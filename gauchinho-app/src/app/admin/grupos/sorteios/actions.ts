"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import {
  calcularPalavraChave,
  validarPrimeiroPremio,
  validarQuantidadeCotas,
} from "@/lib/grupos-sorteio/calcular-palavra-chave";
import { periodoFromInput } from "@/lib/grupos-sorteio/periodo";
import type { GrupoSorteioLoteriaRow } from "@/lib/types";

async function assertCanManageSorteios() {
  const usuario = await requireUsuario();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  if (!canManageGruposSorteios(usuario.perfil, leadsConfig.srdPodeEditarGrupos)) {
    throw new Error("Sem permissão para gerenciar sorteios de grupos");
  }
  return usuario;
}

export type SalvarSorteioInput = {
  grupoId: string;
  periodo: string;
  primeiroPremio: string;
  quantidadeCotas: number;
  dataSorteio?: string | null;
  fonteResultado?: string | null;
  buscadoAutomaticamente?: boolean;
  atualizarSeExistir?: boolean;
};

export async function salvarSorteioGrupoAction(input: SalvarSorteioInput) {
  const usuario = await assertCanManageSorteios();
  const premio = input.primeiroPremio.trim();
  if (!validarPrimeiroPremio(premio)) {
    throw new Error("O 1º Prêmio deve conter exatamente 5 dígitos.");
  }
  if (!validarQuantidadeCotas(input.quantidadeCotas)) {
    throw new Error("A quantidade de cotas deve ser um número inteiro maior que zero.");
  }

  const { ano, mes, periodoRef } = periodoFromInput(input.periodo);
  const palavra_chave = calcularPalavraChave(premio, input.quantidadeCotas);

  const supabase = await createClient();
  const { data: existente } = await supabase
    .from("grupos_sorteios_loteria")
    .select("id")
    .eq("grupo_id", input.grupoId)
    .eq("ano", ano)
    .eq("mes", mes)
    .maybeSingle();

  if (existente && !input.atualizarSeExistir) {
    throw new Error("Já existe um sorteio registrado para este grupo neste período.");
  }

  const row = {
    grupo_id: input.grupoId,
    periodo_ref: periodoRef,
    ano,
    mes,
    primeiro_premio: premio,
    quantidade_cotas: input.quantidadeCotas,
    palavra_chave,
    data_sorteio: input.dataSorteio?.trim() || null,
    fonte_resultado:
      input.buscadoAutomaticamente && input.fonteResultado?.trim()
        ? input.fonteResultado.trim()
        : "manual",
    resultado_buscado_automaticamente: !!input.buscadoAutomaticamente,
    criado_por_usuario_id: usuario.id,
    criado_por_nome: usuario.nome,
    criado_por_email: usuario.email,
  };

  if (existente) {
    const { error } = await supabase
      .from("grupos_sorteios_loteria")
      .update(row)
      .eq("id", existente.id);
    if (error) throw new Error(error.message);
  } else {
    const { error } = await supabase.from("grupos_sorteios_loteria").insert(row);
    if (error) throw new Error(error.message);
  }

  revalidatePath("/grupos");
  revalidatePath("/admin/grupos/sorteios");
  return { palavra_chave, ano, mes };
}

export type SalvarTodosInput = {
  periodo: string;
  primeiroPremio: string;
  dataSorteio?: string | null;
  fonteResultado?: string | null;
  buscadoAutomaticamente?: boolean;
  atualizarSeExistir?: boolean;
};

export async function salvarSorteioTodosGruposAction(input: SalvarTodosInput) {
  await assertCanManageSorteios();
  const premio = input.primeiroPremio.trim();
  if (!validarPrimeiroPremio(premio)) {
    throw new Error("O 1º Prêmio deve conter exatamente 5 dígitos.");
  }

  const supabase = await createClient();
  const { data: grupos, error: gErr } = await supabase
    .from("grupos_consorcio")
    .select("id, codigo_grupo, quantidade_cotas_sorteio")
    .eq("ativo", true)
    .not("quantidade_cotas_sorteio", "is", null);
  if (gErr) throw new Error(gErr.message);

  const comCotas = (grupos ?? []).filter(
    (g) =>
      g.quantidade_cotas_sorteio != null &&
      validarQuantidadeCotas(Number(g.quantidade_cotas_sorteio)),
  );

  let salvos = 0;
  for (const g of comCotas) {
    await salvarSorteioGrupoAction({
      grupoId: g.id,
      periodo: input.periodo,
      primeiroPremio: premio,
      quantidadeCotas: Number(g.quantidade_cotas_sorteio),
      dataSorteio: input.dataSorteio,
      fonteResultado: input.fonteResultado,
      buscadoAutomaticamente: input.buscadoAutomaticamente,
      atualizarSeExistir: input.atualizarSeExistir,
    });
    salvos += 1;
  }

  return { salvos, ignorados: (grupos?.length ?? 0) - comCotas.length };
}

export async function listarHistoricoSorteiosAction(filters: {
  ano?: number;
  mes?: number;
  grupoId?: string;
  limit?: number;
}): Promise<GrupoSorteioLoteriaRow[]> {
  const supabase = await createClient();
  let q = supabase
    .from("grupos_sorteios_loteria")
    .select(
      "*, grupo:grupos_consorcio(id, codigo_grupo, modalidade)",
    )
    .order("ano", { ascending: false })
    .order("mes", { ascending: false })
    .limit(filters.limit ?? 200);

  if (filters.ano) q = q.eq("ano", filters.ano);
  if (filters.mes) q = q.eq("mes", filters.mes);
  if (filters.grupoId) q = q.eq("grupo_id", filters.grupoId);

  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []) as GrupoSorteioLoteriaRow[];
}

export async function fetchGruposParaSorteioAction() {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("grupos_consorcio")
    .select("id, codigo_grupo, modalidade, quantidade_cotas_sorteio, ativo")
    .eq("ativo", true)
    .order("codigo_grupo");
  if (error) throw new Error(error.message);
  return data ?? [];
}

export async function excluirSorteioAction(id: string) {
  await assertCanManageSorteios();
  const supabase = await createClient();
  const { error } = await supabase.from("grupos_sorteios_loteria").delete().eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/grupos");
  revalidatePath("/admin/grupos/sorteios");
}

export async function limparSorteiosAction(filters: {
  ano?: number;
  mes?: number;
  grupoId?: string;
}) {
  await assertCanManageSorteios();
  const supabase = await createClient();
  let q = supabase.from("grupos_sorteios_loteria").delete({ count: "exact" });
  if (filters.ano) q = q.eq("ano", filters.ano);
  if (filters.mes) q = q.eq("mes", filters.mes);
  if (filters.grupoId) q = q.eq("grupo_id", filters.grupoId);
  const { error, count } = await q;
  if (error) throw new Error(error.message);
  revalidatePath("/grupos");
  revalidatePath("/admin/grupos/sorteios");
  return { removidos: count ?? 0 };
}
