import Link from "next/link";
import { notFound } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageGruposSorteios } from "@/lib/auth/permissions";
import { DEFAULT_LEADS, getConfigJson } from "@/server/config";
import { GruposSorteioAdminClient } from "@/components/grupos-sorteio/grupos-sorteio-admin-client";
import {
  fetchGruposParaSorteioAction,
  listarHistoricoSorteiosAction,
} from "./actions";

export default async function GruposSorteiosAdminPage() {
  const usuario = await getUsuarioNegocio();
  if (!usuario) notFound();
  const leadsConfig = await getConfigJson("leads", DEFAULT_LEADS);
  const canManage = canManageGruposSorteios(usuario.perfil, leadsConfig.srdPodeEditarGrupos);
  if (!canManage) {
    return (
      <div className="rounded-lg border border-red-600/40 bg-red-500/10 px-4 py-3 text-sm">
        Você não tem permissão para gerenciar sorteios de grupos.
      </div>
    );
  }

  const grupos = await fetchGruposParaSorteioAction();
  const historico = await listarHistoricoSorteiosAction({ limit: 100 });

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <Link href="/admin/grupos" className="text-sm text-amber-600 hover:underline">
        ← Grupos
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Sorteios — Loteria Federal</h1>
        <p className="text-sm text-zinc-500">
          Palavra-chave = 1º Prêmio MOD quantidade de cotas do grupo.
        </p>
      </div>
      <GruposSorteioAdminClient grupos={grupos} historicoInicial={historico} />
    </div>
  );
}
