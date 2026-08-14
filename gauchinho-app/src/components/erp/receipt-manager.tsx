"use client";
import { useActionState, useMemo, useState } from "react";
import {
  conciliarRecebimentoManualAction,
  registrarRecebimentoManualAction,
  type ReceiptState,
} from "@/app/erp/repasse-franquia/actions";
const initial: ReceiptState = { ok: false, message: "" };
const field =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2";
const money = (v: number) =>
  v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
type Receipt = {
  id: string;
  data_recebimento: string;
  competencia: string;
  valor_total: number;
  valor_classificado: number;
  conciliacao_status: string;
  numero_nota_fiscal: string | null;
  administradora: { nome: string } | null;
};
type Forecast = {
  id: string;
  administradora_id: string;
  competencia: string;
  valor_previsto: number;
  valor_liquidado: number;
  administradora: { nome: string } | null;
};
export function ReceiptManager({
  administradoras,
  contas,
  recebimentos,
  previsoes,
}: {
  administradoras: { id: string; nome: string }[];
  contas: { id: string; nome: string }[];
  recebimentos: Receipt[];
  previsoes: Forecast[];
}) {
  const [open, setOpen] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [registerState, registerAction, registerPending] = useActionState(
    registrarRecebimentoManualAction,
    initial,
  );
  const [concileState, concileAction, concilePending] = useActionState(
    conciliarRecebimentoManualAction,
    initial,
  );
  const [registerKey, setRegisterKey] = useState("");
  const [concileKey, setConcileKey] = useState("");
  const [items, setItems] = useState<Record<string, string>>({});
  const [classes, setClasses] = useState([
    { tipo: "PLANO_MIDIA", valor: "", descricao: "" },
  ]);
  const receipt = recebimentos.find((x) => x.id === selected);
  const available = useMemo(
    () =>
      previsoes.filter(
        (x) =>
          !receipt || x.administradora?.nome === receipt.administradora?.nome,
      ),
    [previsoes, receipt],
  );
  const itens = Object.entries(items)
    .filter(([, v]) => Number(v.replace(",", ".")) > 0)
    .map(([previsao_franquia_id, v]) => ({
      previsao_franquia_id,
      valor: Number(v.replace(",", ".")),
    }));
  const classifications = classes
    .filter((x) => Number(x.valor.replace(",", ".")) > 0)
    .map((x) => ({ ...x, valor: Number(x.valor.replace(",", ".")) }));
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">Recebimentos da Administradora</h2>
          <p className="text-sm text-slate-500">
            Recebimento real → conciliação → previsões e outras classificações.
          </p>
        </div>
        <button
          onClick={() => {
            if (!open) setRegisterKey(crypto.randomUUID());
            setOpen((current) => !current);
          }}
          className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white"
        >
          + Novo recebimento
        </button>
      </div>
      {open && (
        <form
          action={registerAction}
          className="space-y-4 rounded-xl border border-blue-200 bg-white p-5"
        >
          <input type="hidden" name="idempotency_key" value={registerKey} />
          <div className="grid gap-3 md:grid-cols-3">
            <label className="text-sm font-medium">
              Administradora *
              <select className={field} name="administradora_id" required>
                {administradoras.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Data do recebimento *
              <input
                className={field}
                type="date"
                name="data_recebimento"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Competência *
              <input
                className={field}
                type="month"
                name="competencia"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Valor total recebido *
              <input
                className={field}
                name="valor_total"
                inputMode="decimal"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Conta bancária
              <select className={field} name="conta_bancaria_id">
                <option value="">Caixa geral</option>
                {contas.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.nome}
                  </option>
                ))}
              </select>
            </label>
            <label className="text-sm font-medium">
              Conta/Caixa de entrada *
              <input
                className={field}
                name="conta_entrada"
                defaultValue="Caixa geral"
                required
              />
            </label>
            <label className="text-sm font-medium">
              Número da NF
              <input className={field} name="numero_nota_fiscal" />
            </label>
            <label className="text-sm font-medium">
              Data da NF
              <input className={field} type="date" name="data_nota_fiscal" />
            </label>
            <label className="text-sm font-medium">
              Descrição
              <input className={field} name="descricao" />
            </label>
          </div>
          <label className="text-sm font-medium">
            Observação
            <textarea className={field} name="observacoes" />
          </label>
          {registerState.message && (
            <p
              role="status"
              className={`rounded-lg p-3 text-sm ${registerState.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
            >
              {registerState.message}
            </p>
          )}
          <button
            disabled={registerPending}
            className="rounded-lg bg-blue-700 px-4 py-2 font-bold text-white"
          >
            {registerPending ? "Registrando..." : "Registrar recebimento"}
          </button>
        </form>
      )}
      <div className="overflow-x-auto rounded-xl border bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-slate-50 text-left">
            <tr>
              <th className="p-3">Data</th>
              <th>Administradora</th>
              <th>Competência</th>
              <th>Recebido</th>
              <th>Classificado</th>
              <th>Não classificado</th>
              <th>Status</th>
              <th>NF</th>
              <th>Ações</th>
            </tr>
          </thead>
          <tbody>
            {recebimentos.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-3">{r.data_recebimento}</td>
                <td>{r.administradora?.nome ?? "—"}</td>
                <td>{r.competencia}</td>
                <td>{money(Number(r.valor_total))}</td>
                <td>{money(Number(r.valor_classificado))}</td>
                <td>
                  {money(Number(r.valor_total) - Number(r.valor_classificado))}
                </td>
                <td>
                  <span className="rounded-full bg-amber-100 px-2 py-1 text-xs font-bold">
                    {r.conciliacao_status.replaceAll("_", " ")}
                  </span>
                </td>
                <td>{r.numero_nota_fiscal ?? "—"}</td>
                <td>
                  <button
                    onClick={() => {
                      setSelected(r.id);
                      setItems({});
                      setClasses([
                        { tipo: "PLANO_MIDIA", valor: "", descricao: "" },
                      ]);
                      setConcileKey(crypto.randomUUID());
                    }}
                    className="font-semibold text-blue-700"
                  >
                    {r.conciliacao_status === "CONCILIADO"
                      ? "Ver composição"
                      : "Conciliar"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {receipt && (
        <form
          action={concileAction}
          className="space-y-4 rounded-xl border border-violet-200 bg-white p-5"
        >
          <input type="hidden" name="recebimento_id" value={receipt.id} />
          <input type="hidden" name="idempotency_key" value={concileKey} />
          <input type="hidden" name="itens" value={JSON.stringify(itens)} />
          <input
            type="hidden"
            name="classificacoes"
            value={JSON.stringify(classifications)}
          />
          <div>
            <h3 className="font-bold">
              Conciliar recebimento — {money(Number(receipt.valor_total))}
            </h3>
            <p className="text-sm text-slate-500">
              A conciliação não cria uma segunda entrada de Caixa.
            </p>
          </div>
          <div className="space-y-2">
            <h4 className="font-semibold">Previsões de comissão</h4>
            {available.map((p) => (
              <label
                key={p.id}
                className="grid gap-2 rounded-lg border p-3 md:grid-cols-[1fr_180px]"
              >
                <span>
                  {p.competencia} · saldo{" "}
                  {money(Number(p.valor_previsto) - Number(p.valor_liquidado))}
                </span>
                <input
                  className={field}
                  inputMode="decimal"
                  placeholder="Valor conciliado"
                  value={items[p.id] ?? ""}
                  onChange={(e) =>
                    setItems((x) => ({ ...x, [p.id]: e.target.value }))
                  }
                />
              </label>
            ))}
          </div>
          <div className="space-y-2">
            <div className="flex justify-between">
              <h4 className="font-semibold">Outras classificações</h4>
              <button
                type="button"
                onClick={() =>
                  setClasses((x) => [
                    ...x,
                    { tipo: "NAO_IDENTIFICADO", valor: "", descricao: "" },
                  ])
                }
                className="rounded border px-2 py-1 text-xs"
              >
                Adicionar classificação
              </button>
            </div>
            {classes.map((c, i) => (
              <div
                key={i}
                className="grid gap-2 md:grid-cols-[1fr_160px_1fr_auto]"
              >
                <select
                  className={field}
                  value={c.tipo}
                  onChange={(e) =>
                    setClasses((x) =>
                      x.map((v, j) =>
                        j === i ? { ...v, tipo: e.target.value } : v,
                      ),
                    )
                  }
                >
                  {[
                    ["PENDENCIA_ANTERIOR", "Pendência anterior"],
                    ["COMISSAO_LEGADO", "Comissão antiga / legado"],
                    ["REPASSE_TERCEIRO_SOCIO", "Repasse a terceiro/sócio"],
                    ["PLANO_MIDIA", "Plano de Mídia"],
                    ["BONIFICACAO", "Bonificação"],
                    ["AJUSTE_ADMINISTRADORA", "Ajuste da Administradora"],
                    ["NAO_IDENTIFICADO", "Não identificado"],
                  ].map(([v, l]) => (
                    <option key={v} value={v}>
                      {l}
                    </option>
                  ))}
                </select>
                <input
                  className={field}
                  value={c.valor}
                  onChange={(e) =>
                    setClasses((x) =>
                      x.map((v, j) =>
                        j === i ? { ...v, valor: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Valor"
                />
                <input
                  className={field}
                  value={c.descricao}
                  onChange={(e) =>
                    setClasses((x) =>
                      x.map((v, j) =>
                        j === i ? { ...v, descricao: e.target.value } : v,
                      ),
                    )
                  }
                  placeholder="Descrição"
                />
                <button
                  type="button"
                  onClick={() => setClasses((x) => x.filter((_, j) => j !== i))}
                  className="text-red-600"
                >
                  Remover
                </button>
              </div>
            ))}
          </div>
          {concileState.message && (
            <p
              role="status"
              className={`rounded-lg p-3 text-sm ${concileState.ok ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}
            >
              {concileState.message}
            </p>
          )}
          <button
            disabled={concilePending}
            className="rounded-lg bg-violet-700 px-4 py-2 font-bold text-white"
          >
            {concilePending ? "Salvando..." : "Salvar conciliação"}
          </button>
        </form>
      )}
    </section>
  );
}
