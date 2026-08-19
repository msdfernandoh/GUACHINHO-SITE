import { createClient } from "@/lib/supabase/server";
import { listarGruposLegados } from "@/lib/platform/vinculacoes-legadas-service";
import { VinculacoesLegadasView } from "@/components/platform/vinculacoes-legadas-view";

export default async function VinculacoesLegadasPage() {
  const [dataLegados, db] = await Promise.all([
    listarGruposLegados(),
    createClient()
  ]);

  const { data: gruposSaas } = await db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,status,ativo,administradora:administradoras(nome),tipo:administradora_tipos(nome),modalidade_comissao:administradora_modalidades_comissao(nome),cotas:grupos_cotas(id,valor_credito,valor_parcela,prazo,ativo,status)"
    )
    .order("codigo_grupo");

  const gruposSaasDisponiveis = ((gruposSaas ?? []) as any[]).map((g) => ({
    id: g.id,
    codigo_grupo: g.codigo_grupo,
    administradora_nome: g.administradora?.nome || "Administradora",
    tipo_nome: g.tipo?.nome || null,
    modalidade_nome: g.modalidade_comissao?.nome || null,
    cotas: ((g.cotas ?? []) as any[])
      .filter((c) => c.ativo && !["Inativo", "Esgotado"].includes(c.status))
      .map((c) => ({
        id: c.id,
        valor_credito: Number(c.valor_credito),
        valor_parcela: Number(c.valor_parcela),
        prazo: Number(c.prazo)
      }))
  }));

  return (
    <VinculacoesLegadasView
      itens={dataLegados.itens}
      historico={dataLegados.historico}
      totalPendentes={dataLegados.totalPendentes}
      totalSugestoes={dataLegados.totalSugestoes}
      gruposSaasDisponiveis={gruposSaasDisponiveis}
    />
  );
}
