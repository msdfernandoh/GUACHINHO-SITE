import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { ErpCommissionHubView } from "@/components/erp/comissoes/erp-commission-hub-view";

export const dynamic = "force-dynamic";

export default async function ErpRegrasComissaoPage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  const empresaId = empresaAtiva?.id ?? "";
  const supabase = await createClient();

  const [
    canWriteRes,
    perfisRes,
    regrasFranquiaRes,
    regrasPerfisRes,
    vinculosRes,
    participantesRes,
    administradorasRes,
    programasRes,
    tiposRes,
    modalidadesRes,
    curvasRes,
    fiscaisRes,
  ] = await Promise.all([
    supabase.rpc("can_write_tenant_internal", { p_empresa_id: empresaId }),
    supabase.from("comissao_perfis").select("*").eq("empresa_id", empresaId).order("nome"),
    supabase
      .from("comissao_regras_franquia")
      .select("*, programa:comissao_programas(nome, administradora:administradoras(nome)), tipo:administradora_tipos(nome), modalidade_obj:administradora_modalidades_comissao(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("comissao_regras_participantes")
      .select("*, perfil:comissao_perfis(nome, papel_base), programa:comissao_programas(nome, administradora:administradoras(nome)), tipo:administradora_tipos(nome), modalidade_obj:administradora_modalidades_comissao(nome), curva:administradora_curvas_estorno(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("participante_comissao_perfis")
      .select("*, participante:participantes_comerciais(nome, cpf), perfil:comissao_perfis(nome)")
      .eq("empresa_id", empresaId)
      .order("created_at", { ascending: false }),
    supabase
      .from("participantes_comerciais")
      .select("id, nome, participante_tipos(tipo_codigo)")
      .eq("empresa_id", empresaId)
      .order("nome"),
    supabase.from("administradoras").select("id, nome").order("nome"),
    supabase.from("comissao_programas").select("id, nome, administradora_id, versao, status, ativo, administradora:administradoras(nome)").eq("empresa_id", empresaId).order("nome"),
    supabase.from("administradora_tipos").select("id, nome, administradora_id").eq("ativo", true).order("nome"),
    supabase.from("administradora_modalidades_comissao").select("id, nome, administradora_id").eq("ativo", true).order("nome"),
    supabase
      .from("administradora_curvas_estorno")
      .select("*, administradora:administradoras(nome), faixas:administradora_curva_estorno_faixas(mes_relativo, percentual_estorno)")
      .order("nome"),
    supabase.from("empresa_configuracoes_fiscais").select("*").eq("empresa_id", empresaId).order("vigencia_inicio", { ascending: false }),
  ]);

  const canWrite = Boolean(canWriteRes.data);
  const perfis = perfisRes.data ?? [];

  const regrasFranquia = (regrasFranquiaRes.data ?? []).map((rf: any) => ({
    id: rf.id,
    programa_id: rf.programa_id,
    programa_nome: rf.programa?.nome,
    administradora_nome: rf.programa?.administradora?.nome,
    versao: rf.versao,
    tipo_administradora_id: rf.tipo_administradora_id,
    tipo_nome: rf.tipo?.nome,
    modalidade_comissao_id: rf.modalidade_comissao_id,
    modalidade_nome: rf.modalidade_obj?.nome || rf.modalidade,
    percentual_total_comissao: rf.percentual_total_comissao,
    valor_fixo_total: rf.valor_fixo_total,
    base_calculo: rf.base_calculo,
    vigencia_inicio: rf.vigencia_inicio,
    vigencia_fim: rf.vigencia_fim,
    ativa: rf.ativa,
    configuracao_homologada: rf.configuracao_homologada,
    etapas_cronograma: rf.etapas_cronograma ?? [],
  }));

  const regrasPerfis = (regrasPerfisRes.data ?? []).map((rp: any) => ({
    id: rp.id,
    perfil_id: rp.perfil_id,
    perfil_nome: rp.perfil?.nome,
    papel_base: rp.perfil?.papel_base || rp.tipo_participante,
    programa_id: rp.programa_id,
    programa_nome: rp.programa?.nome,
    administradora_nome: rp.programa?.administradora?.nome,
    tipo_administradora_id: rp.tipo_administradora_id,
    tipo_nome: rp.tipo?.nome,
    modalidade_comissao_id: rp.modalidade_comissao_id,
    modalidade_nome: rp.modalidade_obj?.nome || rp.modalidade,
    base_v2: rp.base_v2 || (rp.base_calculo === "valor_fixo" ? "VALOR_FIXO" : "COMISSAO_FRANQUEADORA_LIQUIDA"),
    percentual_comissao: rp.percentual_comissao,
    valor_fixo_total: rp.valor_fixo_total,
    seguir_cronograma_franquia: rp.seguir_cronograma_franquia !== false && rp.modo_regra !== "MANUAL",
    aplicar_curva_estorno: Boolean(rp.aplicar_curva_estorno || rp.curva_estorno_id),
    curva_estorno_id: rp.curva_estorno_id,
    curva_nome: rp.curva?.nome,
    versao: rp.versao || 1,
    status: (rp.status || (rp.configuracao_homologada ? "HOMOLOGADA" : "RASCUNHO")) as any,
    configuracao_homologada: rp.configuracao_homologada,
    ativa: rp.ativa,
    vigencia_inicio: rp.vigencia_inicio,
    vigencia_fim: rp.vigencia_fim,
    nome_regra: rp.nome_regra,
    observacoes: rp.observacoes,
  }));

  const vinculos = (vinculosRes.data ?? []).map((v: any) => ({
    id: v.id,
    participante_id: v.participante_id,
    participante_nome: v.participante?.nome || "Participante",
    participante_cpf: v.participante?.cpf,
    papel_tipo: v.papel_tipo,
    perfil_id: v.perfil_id,
    perfil_nome: v.perfil?.nome || "Perfil",
    override_percentual: v.override_percentual,
    vigencia_inicio: v.vigencia_inicio,
    vigencia_fim: v.vigencia_fim,
    ativo: v.ativo,
    observacoes: v.observacoes,
  }));

  const participantes = (participantesRes.data ?? []).map((p: any) => ({
    id: p.id,
    nome: p.nome,
    tipos: (p.participante_tipos ?? []).map((t: any) => t.tipo_codigo),
  }));

  const curvasEstorno = (curvasRes.data ?? []).map((c: any) => ({
    id: c.id,
    nome: c.nome,
    descricao: c.descricao,
    administradora_id: c.administradora_id,
    administradora_nome: c.administradora?.nome,
    versao: c.versao,
    vigencia_inicio: c.vigencia_inicio,
    vigencia_fim: c.vigencia_fim,
    ativa: c.ativa,
    encerra_na_contemplacao: c.encerra_na_contemplacao,
    faixas: (c.faixas ?? []).sort((a: any, b: any) => a.mes_relativo - b.mes_relativo),
  }));

  return (
    <Suspense fallback={<div className="p-8 text-center text-slate-500 font-semibold">Carregando Regras de Comissão...</div>}>
      <ErpCommissionHubView
        empresaId={empresaId}
        perfis={perfis}
        regrasFranquia={regrasFranquia}
        regrasPerfis={regrasPerfis}
        vinculos={vinculos}
        participantes={participantes}
        administradoras={administradorasRes.data ?? []}
        programas={programasRes.data ?? []}
        tipos={tiposRes.data ?? []}
        modalidades={modalidadesRes.data ?? []}
        curvasEstorno={curvasEstorno}
        fiscais={fiscaisRes.data ?? []}
        canWrite={canWrite}
      />
    </Suspense>
  );
}
