import Link from "next/link";
import { getAreaParceiroHome } from "./actions";

export default async function AreaParceiroPage({
  searchParams,
}: {
  searchParams: Promise<{ org?: string }>;
}) {
  const sp = await searchParams;
  let home: Awaited<ReturnType<typeof getAreaParceiroHome>> | null = null;
  let error: string | null = null;
  try {
    home = await getAreaParceiroHome(sp.org ?? null);
  } catch (e) {
    error = e instanceof Error ? e.message : "Acesso indisponível.";
  }

  if (error || !home) {
    return (
      <div className="rounded-lg border border-stone-200 bg-white p-6">
        <h1 className="text-xl font-semibold">Área do parceiro</h1>
        <p className="mt-2 text-sm text-stone-600">{error ?? "Acesso indisponível."}</p>
      </div>
    );
  }

  const orgQ = home.organizacaoAtivaId
    ? `?org=${encodeURIComponent(home.organizacaoAtivaId)}`
    : "";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Olá, {home.usuarioNome}</h1>
        <p className="mt-1 text-sm text-stone-600">
          Empresa: {home.empresaNome}
          {home.organizacaoAtivaId
            ? ` · Organização ativa: ${home.organizacaoAtivaId.slice(0, 8)}…`
            : " · Sem organização ativa"}
        </p>
      </div>

      {home.organizacaoIds.length > 1 && (
        <div className="rounded-lg border border-stone-200 bg-white p-4">
          <p className="text-sm font-medium">Alternar organização</p>
          <ul className="mt-2 flex flex-wrap gap-2 text-sm">
            {home.organizacaoIds.map((id) => (
              <li key={id}>
                <Link
                  href={`/area-parceiro?org=${encodeURIComponent(id)}`}
                  className={
                    id === home.organizacaoAtivaId
                      ? "font-semibold underline"
                      : "text-stone-600 hover:underline"
                  }
                >
                  {id.slice(0, 8)}…
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}

      {home.semOrgAtiva ? (
        <p className="text-sm text-amber-800">
          Participante sem organização ativa — não há leads/propostas acessíveis.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {home.permissoes.visualizarLeads && (
            <Link
              href={`/area-parceiro/leads${orgQ}`}
              className="rounded-lg border border-stone-200 bg-white p-5 hover:border-stone-400"
            >
              <p className="font-semibold">Leads</p>
              <p className="mt-1 text-sm text-stone-600">Listar e gerenciar leads do seu escopo.</p>
            </Link>
          )}
          {home.permissoes.visualizarPropostas && (
            <Link
              href={`/area-parceiro/propostas${orgQ}`}
              className="rounded-lg border border-stone-200 bg-white p-5 hover:border-stone-400"
            >
              <p className="font-semibold">Propostas</p>
              <p className="mt-1 text-sm text-stone-600">Criar e editar propostas em rascunho.</p>
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
