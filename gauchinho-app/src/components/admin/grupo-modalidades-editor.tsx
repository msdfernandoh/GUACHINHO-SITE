"use client";

import { useMemo, useState } from "react";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import type { GrupoModalidadeLance } from "@/lib/types";
import {
  legacyModalidadesFromGrupoRow,
  type ModalidadeLanceInput,
} from "@/lib/grupos/modalidades-admin";

type Row = {
  key: string;
  id?: string;
  nome: string;
  percentual_lance_embutido: number;
  percentual_recurso_proprio_minimo: number;
  tipo_parcela: "" | "integral" | "reduzida";
  percentual_parcela_reduzida: number | "";
  descricao: string;
  ativo: boolean;
  ordem: number;
};

function toRow(m: Partial<GrupoModalidadeLance>, i: number): Row {
  return {
    key: m.id ?? `new-${i}`,
    id: m.id,
    nome: m.nome ?? "",
    percentual_lance_embutido: Number(m.percentual_lance_embutido ?? 0),
    percentual_recurso_proprio_minimo: Number(m.percentual_recurso_proprio_minimo ?? 0),
    tipo_parcela:
      m.tipo_parcela === "integral" || m.tipo_parcela === "reduzida" ? m.tipo_parcela : "",
    percentual_parcela_reduzida:
      m.percentual_parcela_reduzida != null ? Number(m.percentual_parcela_reduzida) : "",
    descricao: m.descricao ?? "",
    ativo: m.ativo !== false,
    ordem: m.ordem ?? i,
  };
}

function inputToRow(m: ModalidadeLanceInput, i: number): Row {
  return {
    key: m.id ?? `legacy-${i}`,
    id: m.id,
    nome: m.nome,
    percentual_lance_embutido: Number(m.percentual_lance_embutido ?? 0),
    percentual_recurso_proprio_minimo: Number(m.percentual_recurso_proprio_minimo ?? 0),
    tipo_parcela:
      m.tipo_parcela === "integral" || m.tipo_parcela === "reduzida" ? m.tipo_parcela : "",
    percentual_parcela_reduzida:
      m.percentual_parcela_reduzida != null ? Number(m.percentual_parcela_reduzida) : "",
    descricao: m.descricao ?? "",
    ativo: m.ativo !== false,
    ordem: m.ordem ?? i,
  };
}

function emptyRow(ordem: number): Row {
  return {
    key: `new-${Date.now()}-${ordem}`,
    nome: "",
    percentual_lance_embutido: 25,
    percentual_recurso_proprio_minimo: 0,
    tipo_parcela: "integral",
    percentual_parcela_reduzida: "",
    descricao: "",
    ativo: true,
    ordem,
  };
}

export function GrupoModalidadesEditor({
  initial,
  legacyGrupo,
}: {
  initial?: GrupoModalidadeLance[];
  legacyGrupo?: Record<string, unknown>;
}) {
  const seed = useMemo(() => {
    if (initial?.length) return initial.map(toRow);
    if (legacyGrupo) return legacyModalidadesFromGrupoRow(legacyGrupo).map(inputToRow);
    return [];
  }, [initial, legacyGrupo]);

  const [rows, setRows] = useState<Row[]>(seed);

  function addRow(preset?: Partial<Row>) {
    setRows((prev) => [...prev, { ...emptyRow(prev.length), ...preset, ordem: prev.length }]);
  }

  function update(key: string, patch: Partial<Row>) {
    setRows((prev) => prev.map((r) => (r.key === key ? { ...r, ...patch } : r)));
  }

  function remove(key: string) {
    setRows((prev) => prev.filter((r) => r.key !== key));
  }

  const payload = rows.map(({ key: _k, ...rest }, i) => ({
    id: rest.id,
    nome: rest.nome,
    percentual_lance_embutido: rest.percentual_lance_embutido,
    percentual_recurso_proprio_minimo: rest.percentual_recurso_proprio_minimo,
    tipo_parcela: rest.tipo_parcela || null,
    percentual_parcela_reduzida:
      rest.percentual_parcela_reduzida === "" ? null : Number(rest.percentual_parcela_reduzida),
    descricao: rest.descricao || null,
    ativo: rest.ativo,
    ordem: i,
  }));

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="font-semibold">Estratégias (lance e parcela)</h2>
          <p className="text-xs text-zinc-500">
            Opções que o cliente escolhe em <strong>Ajustar</strong> em /grupos — combine lance
            embutido, recurso próprio e parcela integral ou reduzida.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              addRow({
                nome: "25% embutido",
                percentual_lance_embutido: 25,
                tipo_parcela: "integral",
              })
            }
          >
            + Lance 25%
          </Button>
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              addRow({
                nome: "Parcela reduzida",
                percentual_lance_embutido: 0,
                tipo_parcela: "reduzida",
                percentual_parcela_reduzida: 25,
              })
            }
          >
            + Reduzida
          </Button>
          <Button type="button" size="sm" variant="outline" onClick={() => addRow()}>
            + Personalizada
          </Button>
        </div>
      </div>
      <input type="hidden" name="modalidades_json" value={JSON.stringify(payload)} />
      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-4 py-6 text-sm text-zinc-600 dark:border-zinc-700 dark:bg-zinc-950/40 dark:text-zinc-400">
          Nenhuma estratégia cadastrada. Use os botões acima para criar opções de lance embutido e
          parcela reduzida.
        </p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-2"
            >
              <div>
                <Label>Nome (exibido no site)</Label>
                <Input
                  value={r.nome}
                  onChange={(e) => update(r.key, { nome: e.target.value })}
                  placeholder="50% embutido + parcela reduzida"
                />
              </div>
              <div className="flex items-end gap-2">
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={r.ativo}
                    onChange={(e) => update(r.key, { ativo: e.target.checked })}
                  />
                  Ativa
                </label>
                <Button type="button" size="sm" variant="ghost" onClick={() => remove(r.key)}>
                  Remover
                </Button>
              </div>
              <div>
                <Label>% lance embutido</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={r.percentual_lance_embutido}
                  onChange={(e) =>
                    update(r.key, { percentual_lance_embutido: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div>
                <Label>% recurso próprio mínimo</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  value={r.percentual_recurso_proprio_minimo}
                  onChange={(e) =>
                    update(r.key, {
                      percentual_recurso_proprio_minimo: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div>
                <Label>Tipo de parcela</Label>
                <Select
                  value={r.tipo_parcela}
                  onChange={(e) =>
                    update(r.key, {
                      tipo_parcela: e.target.value as Row["tipo_parcela"],
                    })
                  }
                >
                  <option value="">Conforme grupo / escolha do cliente</option>
                  <option value="integral">Integral</option>
                  <option value="reduzida">Reduzida</option>
                </Select>
              </div>
              <div>
                <Label>% parcela reduzida (referência)</Label>
                <Input
                  type="number"
                  step="0.01"
                  min={0}
                  disabled={r.tipo_parcela !== "reduzida"}
                  value={r.percentual_parcela_reduzida}
                  onChange={(e) =>
                    update(r.key, {
                      percentual_parcela_reduzida:
                        e.target.value === "" ? "" : Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição (opcional)</Label>
                <Input
                  value={r.descricao}
                  onChange={(e) => update(r.key, { descricao: e.target.value })}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
