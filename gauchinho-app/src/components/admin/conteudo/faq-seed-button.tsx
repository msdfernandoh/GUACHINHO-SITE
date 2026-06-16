"use client";

import { useState, useTransition } from "react";
import { popularFaqInstitucionalAction } from "@/app/admin/conteudo/actions";
import { Button } from "@/components/ui/form-primitives";

export function FaqInstitucionalSeedButton() {
  const [pending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<string | null>(null);

  return (
    <div className="flex flex-wrap items-center gap-3">
      <Button
        type="button"
        variant="outline"
        disabled={pending}
        onClick={() => {
          startTransition(async () => {
            try {
              const r = await popularFaqInstitucionalAction();
              setFeedback(`${r.inserted} inserida(s), ${r.skipped} já existente(s).`);
            } catch (e) {
              setFeedback(e instanceof Error ? e.message : "Erro ao popular FAQ");
            }
          });
        }}
      >
        {pending ? "Populando…" : "Popular FAQ institucional"}
      </Button>
      {feedback ? <span className="text-sm text-zinc-500">{feedback}</span> : null}
    </div>
  );
}
