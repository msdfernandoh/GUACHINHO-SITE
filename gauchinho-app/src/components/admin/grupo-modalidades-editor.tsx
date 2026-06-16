"use client";

import { useState } from "react";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import type { GrupoModalidadeLance } from "@/lib/types";

type Row = {
  key: string;
  id?: string;
  nome: string;
  percentual_lance_embutido: number;
  percentual_recurso_proprio_minimo: number;
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
    descricao: m.descricao ?? "",
    ativo: m.ativo !== false,
    ordem: m.ordem ?? i,
  };
}

export function GrupoModalidadesEditor({
  initial,
}: {
  initial?: GrupoModalidadeLance[];
}) {
  const [rows, setRows] = useState<Row[]>(() =>
    initial?.length ? initial.map(toRow) : [],
  );

  function addRow() {
    setRows((prev) => [
      ...prev,
      {
        key: `new-${Date.now()}`,
        nome: "",
        percentual_lance_embutido: 25,
        percentual_recurso_proprio_minimo: 0,
        descricao: "",
        ativo: true,
        ordem: prev.length,
      },
    ]);
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
    descricao: rest.descricao || null,
    ativo: rest.ativo,
    ordem: i,
  }));

  return (
    <section className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex items-center justify-between gap-2">
        <h2 className="font-semibold">Modalidades de lance</h2>
        <Button type="button" size="sm" variant="outline" onClick={addRow}>
          + Modalidade
        </Button>
      </div>
      <p className="text-xs text-zinc-500">
        Cadastre opções de lance embutido (ex.: 25% embutido ou 50% + 10% recurso próprio). Se vazio,
        usa os campos legados % lance embutido.
      </p>
      <input type="hidden" name="modalidades_json" value={JSON.stringify(payload)} />
      {rows.length === 0 ? (
        <p className="text-sm text-zinc-500">Nenhuma modalidade — fallback nos campos legados.</p>
      ) : (
        <ul className="space-y-4">
          {rows.map((r) => (
            <li
              key={r.key}
              className="grid gap-2 rounded-lg border border-zinc-200 p-3 dark:border-zinc-700 sm:grid-cols-2"
            >
              <div>
                <Label>Nome</Label>
                <Input
                  value={r.nome}
                  onChange={(e) => update(r.key, { nome: e.target.value })}
                  placeholder="50% embutido + 10% próprio"
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
                  value={r.percentual_recurso_proprio_minimo}
                  onChange={(e) =>
                    update(r.key, {
                      percentual_recurso_proprio_minimo: Number(e.target.value) || 0,
                    })
                  }
                />
              </div>
              <div className="sm:col-span-2">
                <Label>Descrição</Label>
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
