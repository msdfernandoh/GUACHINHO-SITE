import Link from "next/link";
import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { AdministratorWorkspace } from "@/components/platform/administrator-workspace";
import { CommissionRuleManager } from "@/components/erp/commission-rule-manager";

export default async function PlatformAdministradoraPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const db = await createClient();
  const [admin, tipos, modalidades, curvas, programas, grupos, concessoes] =
    await Promise.all([
      db
        .from("administradoras")
        .select("id,nome,nome_fantasia,status")
        .eq("id", id)
        .maybeSingle(),
      db
        .from("administradora_tipos")
        .select("id,nome,codigo,ativo")
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("administradora_modalidades_comissao")
        .select("id,nome,codigo,descricao,ativo")
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("administradora_curvas_estorno")
        .select(
          "id,nome,versao,vigencia_inicio,vigencia_fim,status,faixas:administradora_curva_estorno_faixas(mes_relativo,percentual_estorno)",
        )
        .eq("administradora_id", id)
        .order("versao", { ascending: false }),
      db
        .from("comissao_programas")
        .select(
          "id,nome,versao,status,ativo,empresa_id,administradora_id,empresa:empresas(nome_fantasia)",
        )
        .eq("administradora_id", id)
        .order("nome"),
      db
        .from("grupos_consorcio")
        .select(
          "id,codigo_grupo,status_governanca,tipo_administradora_id,modalidade_comissao_id",
        )
        .eq("administradora_id", id),
      db
        .from("empresa_administradoras")
        .select("empresa_id,empresa:empresas(nome_fantasia)")
        .eq("administradora_id", id)
        .eq("status", "ATIVA")
        .limit(1),
    ]);
  if (!admin.data) notFound();
  const pending = (grupos.data ?? []).filter(
    (g) => !g.tipo_administradora_id || !g.modalidade_comissao_id,
  ).length;
  const empresaId = concessoes.data?.[0]?.empresa_id;
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
      />
      {empresaId ? (
        <CommissionRuleManager
          empresaId={empresaId}
          programas={(programas.data ?? [])
            .filter((p) => p.empresa_id === empresaId)
            .map((p) => ({
              id: p.id,
              nome: p.nome,
              administradora_id: p.administradora_id,
            }))}
          administradoras={[
            {
              id: admin.data.id,
              nome: admin.data.nome_fantasia || admin.data.nome,
            },
          ]}
          cotas={[]}
          tipos={(tipos.data ?? [])
            .filter((x) => x.ativo)
            .map((x) => ({ id: x.id, nome: x.nome, administradoraId: id }))}
          modalidades={(modalidades.data ?? [])
            .filter((x) => x.ativo)
            .map((x) => ({ id: x.id, nome: x.nome, administradoraId: id }))}
          participantes={[]}
          officialSetup
          participantSetup={false}
        />
      ) : (
        <p className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-900">
          Nenhuma empresa possui concessão ativa desta Administradora; crie a
          concessão antes do Programa.
        </p>
      )}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Programas vinculados</h2>
          {(programas.data ?? []).length ? (
            <ul className="mt-3 space-y-2 text-sm">
              {programas.data!.map((p) => (
                <li key={p.id} className="rounded-lg bg-slate-50 p-3">
                  <span className="font-semibold">{p.nome}</span> · v{p.versao}{" "}
                  · {p.status}
                </li>
              ))}
            </ul>
          ) : (
            <p className="mt-2 text-sm text-amber-700">
              Nenhum programa vinculado.
            </p>
          )}
          <Link
            href="/erp/regras-comissao"
            className="mt-3 inline-block text-sm font-semibold text-cyan-700"
          >
            Abrir gestão de regras →
          </Link>
        </div>
        <div className="rounded-xl border bg-white p-5">
          <h2 className="font-bold">Validação da configuração</h2>
          <p
            className={`mt-2 font-semibold ${pending ? "text-amber-700" : "text-emerald-700"}`}
          >
            {pending
              ? `${pending} grupo(s) com configuração pendente`
              : "PRONTO PARA USAR"}
          </p>
          <p className="mt-2 text-sm text-slate-500">
            {tipos.data?.some((x) => x.ativo) ? "✓" : "⚠"} Tipo ·{" "}
            {modalidades.data?.some((x) => x.ativo) ? "✓" : "⚠"} Modalidade ·{" "}
            {curvas.data?.length ? "✓" : "⚠"} Curva ·{" "}
            {programas.data?.length ? "✓" : "⚠"} Programa
          </p>
          <Link
            href={`/platform/administradoras/${id}`}
            className="mt-3 inline-block rounded-lg border px-3 py-2 text-sm font-semibold"
          >
            Validar configuração
          </Link>
        </div>
      </section>
    </div>
  );
}
