"use client";

import {
  GruposSorteioPanel,
  type GrupoSorteioOption,
} from "@/components/grupos-sorteio/grupos-sorteio-panel";
import {
  excluirSorteioAction,
  limparSorteiosAction,
  salvarSorteioGrupoAction,
  salvarSorteioTodosGruposAction,
} from "@/app/admin/grupos/sorteios/actions";
import type { GrupoSorteioLoteriaRow } from "@/lib/types";

export function GruposSorteioAdminClient({
  grupos,
}: {
  grupos: GrupoSorteioOption[];
  historicoInicial?: GrupoSorteioLoteriaRow[];
}) {
  return (
    <GruposSorteioPanel
      variant="admin"
      grupos={grupos}
      canManage
      showTopTrigger
      onSalvar={async (p) => {
        await salvarSorteioGrupoAction(p);
      }}
      onSalvarTodos={async (p) => salvarSorteioTodosGruposAction(p)}
      onExcluirRegistro={async (id) => {
        await excluirSorteioAction(id);
      }}
      onLimparSorteios={async (filters) => limparSorteiosAction(filters)}
    />
  );
}

export function GruposSorteioPublicSection({
  grupos,
  canManage,
  showTopTrigger = false,
}: {
  grupos: GrupoSorteioOption[];
  canManage: boolean;
  showTopTrigger?: boolean;
}) {
  return (
    <GruposSorteioPanel
      variant="public"
      grupos={grupos}
      canManage={canManage}
      showTopTrigger={showTopTrigger}
      onSalvar={
        canManage
          ? async (p) => {
              await salvarSorteioGrupoAction(p);
            }
          : undefined
      }
      onSalvarTodos={
        canManage
          ? async (p) => salvarSorteioTodosGruposAction(p)
          : undefined
      }
      onExcluirRegistro={
        canManage
          ? async (id) => {
              await excluirSorteioAction(id);
            }
          : undefined
      }
      onLimparSorteios={
        canManage
          ? async (filters) => limparSorteiosAction(filters)
          : undefined
      }
    />
  );
}
