"use client";

import { useState, useTransition } from "react";
import type { IndiceFinanceiroRow } from "@/lib/indices-financeiros/types";
import { atualizarIndiceAgora, atualizarTodosIndicesAutomaticos, saveIndiceAdmin } from "@/app/admin/indices-financeiros/actions";
import { Button, Input } from "@/components/ui/form-primitives";

type Props = {
  initial: IndiceFinanceiroRow[];
};

export function IndicesFinanceirosAdmin({ initial }: Props) {
  const [rows, setRows] = useState(initial);
  const [msg, setMsg] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function updateLocal(codigo: string, patch: Partial<IndiceFinanceiroRow>) {
    setRows((prev) => prev.map((r) => (r.codigo === codigo ? { ...r, ...patch } : r)));
  }

  function saveRow(row: IndiceFinanceiroRow) {
    setMsg(null);
    startTransition(async () => {
      try {
        await saveIndiceAdmin({
          codigo: row.codigo,
          nome: row.nome,
          valor_mensal: row.valor_mensal,
          valor_anual: row.valor_anual,
          valor_acumulado_12m: row.valor_acumulado_12m,
          fonte: row.fonte,
          data_referencia: row.data_referencia,
          ativo: row.ativo,
          atualizacao_automatica: row.atualizacao_automatica,
          fallback_manual: row.fallback_manual,
          observacao: row.observacao,
        });
        setMsg(`Índice ${row.codigo} salvo.`);
      } catch (e) {
        setMsg(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  }

  function refreshOne(codigo: string) {
    setMsg(null);
    startTransition(async () => {
      const r = await atualizarIndiceAgora(codigo);
      if (r.ok) {
        setMsg(r.message ?? `${codigo}: atualizado com sucesso.`);
      } else {
        setMsg(r.message ?? `${codigo}: falha na atualização`);
      }
      window.location.reload();
    });
  }

  function refreshAll() {
    setMsg(null);
    startTransition(async () => {
      const results = await atualizarTodosIndicesAutomaticos();
      const falhas = results.filter((r) => !r.ok);
      if (falhas.length === 0) {
        setMsg("Índices automáticos atualizados.");
      } else {
        setMsg(falhas.map((f) => f.message ?? f.codigo).join(" | "));
      }
      window.location.reload();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending} onClick={refreshAll}>
          Atualizar automáticos (BCB)
        </Button>
      </div>
      {msg ? <p className="text-sm text-zinc-600 dark:text-zinc-400">{msg}</p> : null}

      <div className="overflow-x-auto rounded-xl border border-zinc-200 dark:border-zinc-800">
        <table className="min-w-full text-sm">
          <thead className="bg-zinc-100 dark:bg-zinc-900">
            <tr>
              <th className="px-3 py-2 text-left">Código</th>
              <th className="px-3 py-2 text-left">Nome</th>
              <th className="px-3 py-2 text-left">Mensal %</th>
              <th className="px-3 py-2 text-left">Anual %</th>
              <th className="px-3 py-2 text-left">12m %</th>
              <th className="px-3 py-2 text-left">Ref.</th>
              <th className="px-3 py-2 text-left">Última atual.</th>
              <th className="px-3 py-2 text-left">Flags</th>
              <th className="px-3 py-2 text-left">Ações</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.codigo} className="border-t border-zinc-200 dark:border-zinc-800">
                <td className="px-3 py-2 font-mono text-xs">{row.codigo}</td>
                <td className="px-3 py-2">
                  <Input
                    value={row.nome}
                    onChange={(e) => updateLocal(row.codigo, { nome: e.target.value })}
                    className="min-w-[8rem]"
                  />
                </td>
                <td className="px-3 py-2">
                  <NumField
                    value={row.valor_mensal}
                    onChange={(v) => updateLocal(row.codigo, { valor_mensal: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <NumField
                    value={row.valor_anual}
                    onChange={(v) => updateLocal(row.codigo, { valor_anual: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <NumField
                    value={row.valor_acumulado_12m}
                    onChange={(v) => updateLocal(row.codigo, { valor_acumulado_12m: v })}
                  />
                </td>
                <td className="px-3 py-2">
                  <Input
                    type="date"
                    value={row.data_referencia?.slice(0, 10) ?? ""}
                    onChange={(e) =>
                      updateLocal(row.codigo, { data_referencia: e.target.value || null })
                    }
                  />
                </td>
                <td className="px-3 py-2 text-xs text-zinc-500">
                  {row.ultima_atualizacao
                    ? new Date(row.ultima_atualizacao).toLocaleString("pt-BR")
                    : "—"}
                </td>
                <td className="px-3 py-2 space-y-1">
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={row.ativo}
                      onChange={(e) => updateLocal(row.codigo, { ativo: e.target.checked })}
                    />
                    Ativo
                  </label>
                  <label className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={row.atualizacao_automatica}
                      onChange={(e) =>
                        updateLocal(row.codigo, { atualizacao_automatica: e.target.checked })
                      }
                    />
                    Auto
                  </label>
                </td>
                <td className="px-3 py-2 space-y-1">
                  <Button type="button" size="sm" disabled={pending} onClick={() => saveRow(row)}>
                    Salvar
                  </Button>
                  {row.atualizacao_automatica ? (
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      disabled={pending}
                      onClick={() => refreshOne(row.codigo)}
                    >
                      Atualizar agora
                    </Button>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="text-xs text-zinc-500">
        IGP-M, Poupança e Tesouro: cadastro manual até integração estável. IPCA, CDI e Selic: BCB SGS
        quando &quot;Auto&quot; estiver ativo.
      </p>
    </div>
  );
}

function NumField({
  value,
  onChange,
}: {
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  return (
    <Input
      inputMode="decimal"
      className="w-24"
      value={value ?? ""}
      onChange={(e) => {
        const t = e.target.value.replace(",", ".");
        if (t === "") onChange(null);
        else {
          const n = Number(t);
          onChange(Number.isFinite(n) ? n : null);
        }
      }}
    />
  );
}
