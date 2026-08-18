import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdministratorWorkspace } from "@/components/platform/administrator-workspace";

export default async function PlatformAdministradoraPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab } = await searchParams;
  const db = await createClient();
  const [admin, tipos, modalidades, curvas, modelos, programas, grupos, concessoes, historico] =
    await Promise.all([
      db
        .from("administradoras")
        .select("id,nome,nome_fantasia,status,descricao_institucional")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("administradora_tipos")
        .select("id,nome,codigo,ativo")
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("administradora_modalidades_comissao")
        .select("id,nome,codigo,descricao,ativo,aplicavel_todos_tipos,tipos:administradora_modalidade_tipos(tipo_id)")
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("administradora_curvas_estorno")
        .select(
          "id,nome,descricao,versao,vigencia_inicio,vigencia_fim,status,ativa,aplicavel_todos_tipos,aplicavel_todas_modalidades,faixas:administradora_curva_estorno_faixas(mes_relativo,percentual_estorno),tipos:administradora_curva_tipos(tipo_id),modalidades:administradora_curva_modalidades(modalidade_id)",
        )
        .eq("administradora_id", id)
        .order("versao", { ascending: false }),
      db
        .from("administradora_modelos_comissao")
        .select("id,nome,descricao,versao,percentual_total_referencia,status,tipo_id,tipo:administradora_tipos(nome),modalidades:administradora_modelo_modalidades(modalidade_id,regra_franquia_origem_id,modalidade:administradora_modalidades_comissao(nome))")
        .eq("administradora_id", id)
        .order("versao", { ascending: false }),
      db
        .from("comissao_programas")
        .select(
          "id,nome,versao,status,ativo,empresa_id,administradora_id,programa_origem_id,empresa:empresas(nome_fantasia),regras:comissao_regras_franquia(id,versao,base_calculo,percentual_total_comissao,valor_fixo_total,vigencia_inicio,vigencia_fim,configuracao_homologada,tipo_administradora_id,modalidade_comissao_id,curva_estorno_id,tipo:administradora_tipos(nome),modalidade:administradora_modalidades_comissao(nome),curva:administradora_curvas_estorno(nome,versao),etapas:comissao_regra_etapas(id,ordem,tipo_gatilho,mes_relativo,nome,percentual_venda))",
        )
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("grupos_consorcio")
        .select(
          "id,codigo_grupo,status_governanca,origem_governanca,status,ativo,prazo_total,taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,capacidade_total,vagas_disponiveis,vagas_atualizado_em,updated_at,tipo_administradora_id,tipo:administradora_tipos(id,nome,codigo),modalidades:grupos_modalidades_disponiveis(id,administradora_modalidade_id,ativo,modalidade:administradora_modalidades_comissao(id,nome,codigo)),produtos:grupos_cotas(id,valor_credito,ativo,grupo_cota_modalidade_valores(id,administradora_modalidade_id,valor_parcela,habilitado,ativo))",
        )
        .eq("administradora_id", id)
        .order("codigo_grupo"),
      db
        .from("empresa_administradoras")
        .select("empresa_id,empresa:empresas(nome_fantasia)")
        .eq("administradora_id", id)
        .eq("status", "ATIVA")
        .limit(100),
      db.from("plataforma_auditoria").select("id,acao,entidade_tipo,entidade_id,campos_alterados,created_at").in("entidade_tipo",["administradoras","administradora_tipos","administradora_modalidades_comissao","administradora_curvas_estorno","administradora_modelos_comissao","comissao_programas","comissao_regras_franquia"]).order("created_at",{ascending:false}).limit(500),
    ]);
  if (!admin.data) notFound();
  const pending = (grupos.data ?? []).filter(
    (g) =>
      !g.tipo_administradora_id ||
      !g.modalidades?.some((item) => item.ativo) ||
      !g.produtos?.some((item) => item.ativo),
  ).length;
  const auditEntityIds = new Set([
    id,
    ...(tipos.data ?? []).map((item) => item.id),
    ...(modalidades.data ?? []).map((item) => item.id),
    ...(curvas.data ?? []).map((item) => item.id),
    ...(modelos.data ?? []).map((item) => item.id),
    ...(programas.data ?? []).map((item) => item.id),
    ...(programas.data ?? []).flatMap((item) =>
      (item.regras ?? []).map((rule) => rule.id),
    ),
  ]);
  const administradoraHistory = (historico.data ?? []).filter((item) =>
    auditEntityIds.has(item.entidade_id),
  );
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <Link
            href="/platform/administradoras"
            className="text-sm font-semibold text-cyan-700"
          >
            ← Administradoras
          </Link>
          <h1 className="mt-2 text-3xl font-bold">
            {admin.data.nome_fantasia || admin.data.nome}
          </h1>
          <p className="text-slate-500">
            Fonte oficial de Tipos, Modalidades, Curvas, Programas e Grupos.
          </p>
        </div>
        <Link
          href="/platform/ajuda-comissoes"
          className="rounded-lg border px-4 py-2 font-semibold"
        >
          Como configurar comissões
        </Link>
      </header>
      <AdministratorWorkspace
        initialTab={tab}
        administradora={admin.data}
        tipos={tipos.data ?? []}
        modalidades={modalidades.data ?? []}
        curvas={(curvas.data ?? []).map((c) => ({
          ...c,
          faixas: (c.faixas ?? []) as {
            mes_relativo: number;
            percentual_estorno: number;
          }[],
        }))}
        modelos={(modelos.data ?? []) as never[]}
        programas={(programas.data ?? []) as never[]}
        grupos={(grupos.data ?? []) as never[]}
        franquiasCredenciadas={(concessoes.data ?? []).length}
        historico={administradoraHistory as never[]}
        gruposPendentes={pending}
      />
    </div>
  );
}
