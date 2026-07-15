"use client";

import {
  GruposSorteioPanel,
  type GrupoSorteioOption,
} from "@/components/grupos-sorteio/grupos-sorteio-panel";
import {
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
      onSalvar={async (p) => {
        await salvarSorteioGrupoAction(p);
      }}
      onSalvarTodos={async (p) => salvarSorteioTodosGruposAction(p)}
    />
  );
}

export function GruposSorteioPublicSection({
  grupos,
  canManage,
}: {
  grupos: GrupoSorteioOption[];
  canManage: boolean;
}) {
  return (
    <GruposSorteioPanel
      variant="public"
      grupos={grupos}
      canManage={canManage}
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
    />
  );
}
