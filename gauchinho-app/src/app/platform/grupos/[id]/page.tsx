import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { GrupoOperationalWorkspace } from "@/components/platform/grupo-operational-workspace";
import type { GrupoRecord, AdministradoraModalidadeItem } from "@/lib/platform/grupos-prontidao";

export default async function PlatformGrupoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();

  const [grupoRes, administradorasRes, historicoRes] = await Promise.all([
    db
      .from("grupos_consorcio")
      .select(
        "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade,status,ativo,prazo_total,data_primeira_assembleia,parcelas_realizadas,prazo_restante,taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,seguro_habilitado,capacidade_total,vagas_disponiveis,vagas_atualizado_em,dados_estatisticos,dados_estatisticos_atualizado_em,permite_lance_embutido,percentual_lance_embutido,origem_governanca,status_governanca,observacoes,updated_at,administradora:administradoras(id,nome),tipo:administradora_tipos(id,nome,codigo),modalidades:grupos_modalidades_disponiveis(id,administradora_modalidade_id,ativo,ordem,configuracao,modalidade:administradora_modalidades_comissao(id,nome,codigo,modo_reduzido_padrao,percentual_padrao,percentual_minimo,percentual_maximo)),produtos:grupos_cotas(id,valor_credito,status,ativo),categorias:grupos_categorias(categoria:catalogo_grupo_categorias(codigo,nome,ativo))",
      )
      .eq("id", id)
      .maybeSingle(),
    db.from("administradoras").select("id,nome").eq("status", "ATIVA").order("nome"),
    db
      .from("grupo_estatisticas_historico")
      .select("id,fonte,campo,valor_anterior,valor_novo,observacao,created_at,usuario:usuarios(nome),empresa:empresas(nome_fantasia)")
      .eq("grupo_id", id)
      .order("created_at", { ascending: false })
      .limit(50),
  ]);

  if (!grupoRes.data) notFound();

  const grupo = grupoRes.data as unknown as GrupoRecord;
  const adminId = grupo.administradora_id;

  const [tiposRes, modalidadesRes, categoriasRes] = await Promise.all([
    adminId
      ? db
          .from("administradora_tipos")
          .select("id,nome,codigo")
          .eq("administradora_id", adminId)
          .eq("ativo", true)
          .order("nome")
      : Promise.resolve({ data: [] }),
    adminId
      ? db
          .from("administradora_modalidades_comissao")
          .select("id,nome,codigo,ativo,modo_reduzido_padrao,percentual_padrao,percentual_minimo,percentual_maximo")
          .eq("administradora_id", adminId)
          .eq("ativo", true)
          .order("nome")
      : Promise.resolve({ data: [] }),
    db.from("catalogo_grupo_categorias").select("codigo,nome").eq("ativo", true).order("ordem"),
  ]);

  return (
    <GrupoOperationalWorkspace
      grupo={grupo}
      administradoras={administradorasRes.data ?? []}
      tiposAdministradora={(tiposRes.data ?? []) as Array<{ id: string; nome: string; codigo: string }>}
      modalidadesAdministradora={(modalidadesRes.data ?? []) as unknown as AdministradoraModalidadeItem[]}
      historico={(historicoRes.data ?? []) as Array<{
        id: string;
        fonte: string;
        campo: string;
        valor_anterior: unknown;
        valor_novo: unknown;
        observacao: string | null;
        created_at: string;
        usuario?: { nome?: string } | null;
        empresa?: { nome_fantasia?: string } | null;
      }>}
      categoriasDisponiveis={(categoriasRes.data ?? []) as Array<{ codigo: string; nome: string }>}
    />
  );
}
