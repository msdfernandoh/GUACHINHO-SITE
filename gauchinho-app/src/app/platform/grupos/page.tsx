import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import {
  type GrupoRecord,
} from "@/lib/platform/grupos-prontidao";
import { deduplicarCatalogoGrupos } from "@/lib/platform/grupos-listagem";
import { GruposListPlatformClient } from "@/components/platform/grupos-list-platform-client";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function PlatformGruposListingPage({
  searchParams,
}: {
  searchParams: Promise<{ busca?: string; status?: string; administradora_id?: string }>;
}) {
  const filters = await searchParams;
  const db = await createClient();

  let query = db
    .from("grupos_consorcio")
    .select(
      "id,codigo_grupo,administradora_id,tipo_administradora_id,modalidade,status,ativo,prazo_total,data_primeira_assembleia,parcelas_realizadas,prazo_restante,taxa_administrativa_percentual,fundo_reserva_percentual,seguro_percentual,capacidade_total,vagas_disponiveis,vagas_atualizado_em,dados_estatisticos,origem_governanca,status_governanca,updated_at,tipo_reajuste_anual,reajuste_anual_percentual,reajuste_anual_indice,ano_ultimo_reajuste,data_ultimo_reajuste,credito_reajustado_ate_meses,administradora:administradoras(id,nome),tipo:administradora_tipos(id,nome,codigo),modalidades:grupos_modalidades_disponiveis(id,administradora_modalidade_id,ativo,modalidade:administradora_modalidades_comissao(id,nome,codigo)),produtos:grupos_cotas(id,valor_credito,status,ativo)",
    )
    .order("codigo_grupo");

  if (filters.busca) {
    query = query.ilike("codigo_grupo", `%${filters.busca}%`);
  }
  if (filters.status) {
    query = query.eq("status", filters.status);
  }
  if (filters.administradora_id) {
    query = query.eq("administradora_id", filters.administradora_id);
  }

  const [{ data: grupos }, { data: administradoras }] = await Promise.all([
    query.limit(200),
    db.from("administradoras").select("id,nome").eq("status", "ATIVA").order("nome"),
  ]);

  const rows = deduplicarCatalogoGrupos((grupos ?? []) as unknown as GrupoRecord[]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-cyan-600">Platform</p>
          <h1 className="mt-1 text-3xl font-extrabold text-slate-900 dark:text-white">
            Catálogo Operacional de Grupos
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Grupos oficiais das Administradoras com produtos de crédito, modalidades de pagamento, assembleias, reajuste anual e vagas.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Link
            href="/platform/grupos/solicitacoes"
            className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-2 text-sm font-bold text-amber-800 shadow-sm hover:bg-amber-100"
          >
            Aprovações das franquias
          </Link>
          <Link
            href="/platform/grupos/vinculacoes"
            className="rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-bold text-slate-700 shadow-sm hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
          >
            🔗 Vinculações Legadas
          </Link>
          <Link
            href="/platform/grupos/novo"
            className="rounded-lg bg-cyan-700 px-4 py-2 text-sm font-bold text-white shadow hover:bg-cyan-800"
          >
            + Novo Grupo Global
          </Link>
        </div>
      </div>

      {/* Filtros */}
      <form className="flex flex-wrap items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input
          name="busca"
          defaultValue={filters.busca || ""}
          placeholder="Buscar por número do grupo..."
          className="flex-1 min-w-[200px] rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        <select
          name="administradora_id"
          defaultValue={filters.administradora_id || ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Todas as Administradoras</option>
          {(administradoras ?? []).map((a) => (
            <option key={a.id} value={a.id}>
              {a.nome}
            </option>
          ))}
        </select>
        <select
          name="status"
          defaultValue={filters.status || ""}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 focus:border-cyan-600 focus:outline-none dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        >
          <option value="">Todos os status</option>
          <option value="Disponível">Disponível</option>
          <option value="Em Andamento">Em Andamento</option>
          <option value="Encerrado">Encerrado</option>
          <option value="Inativo">Inativo</option>
        </select>
        <button
          type="submit"
          className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-900"
        >
          Filtrar
        </button>
      </form>

      {/* Tabela Interativa com Reajuste Anual Operacional */}
      <GruposListPlatformClient grupos={rows} />
    </div>
  );
}
