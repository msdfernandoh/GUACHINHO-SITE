"use client";

import { useRef, useState, useTransition, type ReactNode } from "react";
import { useRouter } from "next/navigation";

type Result = { ok: true; quantidade: number } | { ok: false; error: string };

export function BulkArchiveSelection({
  children,
  entityLabel,
  action,
  enabled = true,
}: {
  children: ReactNode;
  entityLabel: "propostas" | "contratações";
  action: (formData: FormData) => Promise<Result>;
  enabled?: boolean;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const router = useRouter();
  const [selected, setSelected] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function recount() {
    const count = formRef.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]:checked').length ?? 0;
    setSelected(count);
    setMessage(null);
  }

  function toggleAll(checked: boolean) {
    formRef.current?.querySelectorAll<HTMLInputElement>('input[name="ids"]').forEach((item) => {
      if (!item.disabled) item.checked = checked;
    });
    const selectAll = formRef.current?.querySelector<HTMLInputElement>("input[data-select-all]");
    if (selectAll) selectAll.checked = checked;
    recount();
  }

  function submit() {
    if (!formRef.current || selected === 0) return;
    const confirmed = window.confirm(
      `Excluir ${selected} ${entityLabel} da operação? A ação é auditada e itens com venda/cota serão bloqueados.`,
    );
    if (!confirmed) return;
    const data = new FormData(formRef.current);
    startTransition(async () => {
      const result = await action(data);
      if (!result.ok) {
        setMessage(result.error);
        return;
      }
      toggleAll(false);
      setMessage(`${result.quantidade} ${entityLabel} excluída(s) da operação.`);
      router.refresh();
    });
  }

  if (!enabled) return <>{children}</>;

  return (
    <form ref={formRef} onChange={recount} onSubmit={(event) => { event.preventDefault(); submit(); }}>
      <div className="mb-3 flex flex-wrap items-center gap-3 rounded-xl border border-red-200 bg-red-50 p-3 text-sm">
        <label className="flex cursor-pointer items-center gap-2 font-semibold text-slate-800">
          <input data-select-all type="checkbox" onChange={(event) => toggleAll(event.currentTarget.checked)} />
          Selecionar todas desta página
        </label>
        <span className="text-slate-600">{selected} selecionada(s)</span>
        <button type="submit" disabled={pending || selected === 0} className="rounded-lg bg-red-600 px-4 py-2 font-bold text-white disabled:cursor-not-allowed disabled:opacity-50">
          {pending ? "Excluindo..." : "Excluir selecionadas"}
        </button>
        <span className="text-xs text-slate-600">Somente antes da geração da venda/cota.</span>
      </div>
      {message && <p role="status" className={`mb-3 rounded-lg px-3 py-2 text-sm font-semibold ${message.includes("excluída") ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"}`}>{message}</p>}
      {children}
    </form>
  );
}
