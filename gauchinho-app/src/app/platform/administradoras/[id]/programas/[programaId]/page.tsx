import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { ProgramaWorkspace, type ProgramaDetail, type TipoItem, type ModalidadeItem, type CurvaItem } from "@/components/platform/programa-workspace";

export default async function ProgramaPlatformPage({
  params,
}: {
  params: Promise<{ id: string; programaId: string }>;
}) {
  const { id, programaId } = await params;
  const db = await createClient();

  const [programaRes, tiposRes, modalidadesRes, curvasRes] = await Promise.all([
    db
      .from("comissao_programas")
      .select(
        "id,nome,descricao,versao,status,ativo,administradora_id,empresa_id,programa_origem_id,administradora:administradoras(nome,nome_fantasia),empresa:empresas(nome_fantasia),regras:comissao_regras_franquia(id,versao,percentual_total_comissao,valor_fixo_total,base_calculo,vigencia_inicio,vigencia_fim,configuracao_homologada,origem_configuracao,tipo_administradora_id,modalidade_comissao_id,curva_estorno_id,tipo:administradora_tipos(id,nome),modalidade:administradora_modalidades_comissao(id,nome),curva:administradora_curvas_estorno(id,nome,versao),etapas:comissao_regra_etapas(id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda))",
      )
      .eq("id", programaId)
      .eq("administradora_id", id)
      .maybeSingle(),
    db
      .from("administradora_tipos")
      .select("id,nome,codigo")
      .eq("administradora_id", id)
      .eq("ativo", true)
      .order("nome"),
    db
      .from("administradora_modalidades_comissao")
      .select("id,nome,codigo")
      .eq("administradora_id", id)
      .eq("ativo", true)
      .order("nome"),
    db
      .from("administradora_curvas_estorno")
      .select("id,nome,versao")
      .eq("administradora_id", id)
      .eq("status", "HOMOLOGADA")
      .eq("ativa", true)
      .order("versao", { ascending: false }),
  ]);

  if (!programaRes.data) notFound();

  const programa = programaRes.data as unknown as ProgramaDetail;
  const tipos = (tiposRes.data ?? []) as TipoItem[];
  const modalidades = (modalidadesRes.data ?? []) as ModalidadeItem[];
  const curvas = (curvasRes.data ?? []) as CurvaItem[];

  return (
    <ProgramaWorkspace
      programa={programa}
      administradoraId={id}
      tipos={tipos}
      modalidades={modalidades}
      curvas={curvas}
    />
  );
}
