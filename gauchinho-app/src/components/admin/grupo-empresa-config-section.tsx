"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { updateEmpresaGrupoConfigAction, resetEmpresaGrupoConfigAction } from "@/app/admin/grupos/actions";
import type { EmpresaGrupoConfig } from "@/lib/grupos/empresa-grupos-config";

export function GrupoEmpresaConfigSection({
  empresaId,
  grupoId,
  codigoGrupo,
  config,
}: {
  empresaId: string;
  grupoId: string;
  codigoGrupo: string;
  config: EmpresaGrupoConfig | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const handleUpdate = (formData: FormData) => {
    startTransition(async () => {
      try {
        await updateEmpresaGrupoConfigAction(formData);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao salvar configuração.");
      }
    });
  };

  const handleReset = (formData: FormData) => {
    if (!confirm(`Deseja restaurar a apresentação padrão global da administradora para o Grupo ${codigoGrupo}?`)) {
      return;
    }
    startTransition(async () => {
      try {
        await resetEmpresaGrupoConfigAction(formData);
        router.refresh();
      } catch (err) {
        alert(err instanceof Error ? err.message : "Erro ao restaurar padrão global.");
      }
    });
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-50/50 p-6 dark:border-amber-500/20 dark:bg-zinc-900/90 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-50">
            Apresentação Local do Tenant (Meu Catálogo)
          </h2>
          <p className="text-xs text-zinc-600 dark:text-zinc-400">
            Personalize a visibilidade, destaque e títulos comerciais deste grupo especificamente para o site da sua empresa. Os atributos oficiais da administradora permanecem inalterados.
          </p>
        </div>
        {config ? (
          <form action={handleReset}>
            <input type="hidden" name="empresa_id" value={empresaId} />
            <input type="hidden" name="grupo_id" value={grupoId} />
            <Button type="submit" variant="outline" size="sm" disabled={pending}>
              Restaurar Padrão Global
            </Button>
          </form>
        ) : null}
      </div>

      <form action={handleUpdate} className="space-y-4 pt-2">
        <input type="hidden" name="empresa_id" value={empresaId} />
        <input type="hidden" name="grupo_id" value={grupoId} />

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <Label>Título Comercial Local</Label>
            <Input
              name="titulo_comercial"
              placeholder={`Ex: Grupo ${codigoGrupo}`}
              defaultValue={config?.titulo_comercial ?? ""}
            />
            <span className="text-[11px] text-zinc-500">Deixe em branco para usar &quot;Grupo {codigoGrupo}&quot;</span>
          </div>

          <div>
            <Label>Ordem de Exibição</Label>
            <Input
              type="number"
              name="ordem"
              placeholder="Ex: 1, 2, 3..."
              defaultValue={config?.ordem ?? ""}
            />
            <span className="text-[11px] text-zinc-500">Ordem na lista de grupos do seu site</span>
          </div>
        </div>

        <div>
          <Label>Descrição Comercial Local (Opcional)</Label>
          <Input
            name="descricao_comercial"
            placeholder="Ex: Excelente grupo com lance embutido de 30%..."
            defaultValue={config?.descricao_comercial ?? ""}
          />
        </div>

        <div className="flex flex-wrap items-center gap-6 pt-1">
          <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              name="visivel"
              value="true"
              defaultChecked={config ? config.visivel : true}
              className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Visível no site da empresa</span>
          </label>

          <label className="flex items-center gap-2 text-sm text-zinc-800 dark:text-zinc-200 cursor-pointer">
            <input
              type="checkbox"
              name="destaque"
              value="true"
              defaultChecked={config ? config.destaque : false}
              className="rounded border-zinc-300 text-amber-600 focus:ring-amber-500"
            />
            <span>Exibir em destaque no simulador local</span>
          </label>
        </div>

        <div className="pt-2">
          <Button type="submit" size="sm" disabled={pending}>
            {pending ? "Salvando..." : "Salvar Apresentação Local"}
          </Button>
        </div>
      </form>
    </div>
  );
}
