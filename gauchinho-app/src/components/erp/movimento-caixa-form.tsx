"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { registrarMovimentoManual, type CaixaActionResult } from "@/app/admin/financeiro/actions";

export function MovimentoCaixaForm() {
  const router = useRouter();
  const [aberto, setAberto] = useState(false);
  const [pending, setPending] = useState(false);
  const [result, setResult] = useState<CaixaActionResult | null>(null);
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    const response = await registrarMovimentoManual(new FormData(event.currentTarget));
    setPending(false);
    setResult(response);
    if (response.ok) {
      event.currentTarget.reset();
      router.refresh();
    }
  }
  return (
    <div className="flex flex-col items-end gap-2">
      <button type="button" onClick={() => setAberto((value) => !value)} className="rounded-lg bg-blue-700 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-800">
        {aberto ? "Fechar lançamento" : "+ Nova entrada ou saída"}
      </button>
      {aberto ? (
        <form onSubmit={submit} className="grid w-[min(44rem,90vw)] gap-3 rounded-xl border border-slate-200 bg-white p-4 shadow-lg sm:grid-cols-2">
          <select name="tipo" required className="rounded-lg border border-slate-300 px-3 py-2 text-sm">
            <option value="entrada">Entrada de caixa</option>
            <option value="saida">Saída de caixa</option>
          </select>
          <input name="valor" required inputMode="decimal" placeholder="Valor (R$)" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="data" type="date" required defaultValue={new Date().toISOString().slice(0, 10)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          <input name="descricao" required maxLength={240} placeholder="Descrição do lançamento" className="rounded-lg border border-slate-300 px-3 py-2 text-sm" />
          {result ? <p className={`text-sm sm:col-span-2 ${result.ok ? "text-emerald-700" : "text-rose-700"}`}>{result.message}</p> : null}
          <button disabled={pending} className="rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white disabled:opacity-60 sm:col-span-2">
            {pending ? "Salvando..." : "Salvar movimentação"}
          </button>
          <p className="text-xs text-slate-500 sm:col-span-2">O livro razão é somente inclusão: este lançamento não poderá ser editado ou excluído.</p>
        </form>
      ) : null}
    </div>
  );
}
