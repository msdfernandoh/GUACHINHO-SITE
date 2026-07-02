"use client";

import { saveHomeModulosConfigAction } from "./actions";
import { Button, Input } from "@/components/ui/form-primitives";
import {
  DEFAULT_HOME_MODULOS,
  normalizeHomeModulosConfig,
  type HomeModulosConfig,
} from "@/lib/config/home-modulos";

type Props = {
  stored: unknown;
};

export function HomeModulosForm({ stored }: Props) {
  const config: HomeModulosConfig = normalizeHomeModulosConfig(stored);

  return (
    <form action={saveHomeModulosConfigAction} className="max-w-2xl space-y-4">
      <p className="text-sm text-zinc-500">
        Ative ou desative seções da página inicial e defina a ordem (número menor aparece antes). Módulos
        sem conteúdo continuam ocultos mesmo ativos.
      </p>
      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="w-full min-w-[28rem] text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
            <tr>
              <th className="px-3 py-2 font-semibold">Módulo</th>
              <th className="px-3 py-2 font-semibold">Ordem</th>
              <th className="px-3 py-2 font-semibold">Ativo</th>
            </tr>
          </thead>
          <tbody>
            {config.modulos.map((m) => (
              <tr key={m.id} className="border-b border-zinc-100 dark:border-zinc-800/80">
                <td className="px-3 py-2">{m.nome}</td>
                <td className="px-3 py-2">
                  <Input
                    name={`ordem_${m.id}`}
                    type="number"
                    min={1}
                    max={99}
                    defaultValue={String(m.ordem)}
                    className="w-20"
                  />
                </td>
                <td className="px-3 py-2">
                  <label className="flex items-center gap-2">
                    <input type="checkbox" name={`ativo_${m.id}`} defaultChecked={m.ativo} />
                    <span className="sr-only">Ativo</span>
                  </label>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        Chave no banco: <code className="rounded bg-zinc-100 px-1 dark:bg-zinc-900">home_modulos_config</code>
      </p>
      <Button type="submit">Salvar módulos da Home</Button>
    </form>
  );
}
