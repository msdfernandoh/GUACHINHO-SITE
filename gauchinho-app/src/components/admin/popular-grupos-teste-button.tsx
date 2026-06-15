"use client";

import { useState, useTransition } from "react";
import { popularGruposTesteAction } from "@/app/admin/grupos/actions";
import { Button } from "@/components/ui/form-primitives";

export function PopularGruposTesteButton() {
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setMessage(null);
    setError(null);
    startTransition(async () => {
      try {
        const result = await popularGruposTesteAction();
        setMessage(
          `${result.created} grupo(s) criado(s), ${result.skipped} já existente(s) (códigos 1203, 1283, 1443, 1533, 2045, 3012).`,
        );
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro ao popular grupos");
      }
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button type="button" variant="outline" disabled={pending} onClick={handleClick}>
        {pending ? "Populando…" : "Popular grupos de teste"}
      </Button>
      {message ? <p className="max-w-xs text-right text-xs text-emerald-600">{message}</p> : null}
      {error ? <p className="max-w-xs text-right text-xs text-red-600">{error}</p> : null}
    </div>
  );
}
