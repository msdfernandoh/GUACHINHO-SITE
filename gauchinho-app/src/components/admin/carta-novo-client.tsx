"use client";

import { useState } from "react";
import { parseCartaWhatsAppText } from "@/lib/cartas/parser";
import { createCartaAction } from "@/app/admin/cartas-contempladas/actions";
import { CartaFormFields } from "@/components/admin/carta-form-fields";
import { Button, Label, Textarea } from "@/components/ui/form-primitives";

export function CartaNovoClient() {
  const [mode, setMode] = useState<"manual" | "paste" | "review">("manual");
  const [pasteText, setPasteText] = useState("");
  const [parsed, setParsed] = useState<ReturnType<typeof parseCartaWhatsAppText> | null>(null);

  function handleParse() {
    setParsed(parseCartaWhatsAppText(pasteText));
    setMode("review");
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <Button type="button" variant={mode === "manual" ? "gold" : "outline"} size="sm" onClick={() => setMode("manual")}>
          Cadastro manual
        </Button>
        <Button type="button" variant={mode === "paste" ? "gold" : "outline"} size="sm" onClick={() => setMode("paste")}>
          Colar texto do WhatsApp
        </Button>
      </div>

      {mode === "manual" ? (
        <form action={createCartaAction}>
          <CartaFormFields />
        </form>
      ) : null}

      {mode === "paste" ? (
        <div className="space-y-3 rounded-xl border bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <Label>Texto colado</Label>
          <Textarea rows={10} value={pasteText} onChange={(e) => setPasteText(e.target.value)} placeholder="Cole a mensagem do WhatsApp..." />
          <Button type="button" onClick={handleParse} disabled={!pasteText.trim()}>
            Organizar campos
          </Button>
        </div>
      ) : null}

      {mode === "review" && parsed ? (
        <div className="space-y-3">
          <p className="text-sm text-zinc-500">Revise os campos antes de salvar.</p>
          <form action={createCartaAction}>
            <CartaFormFields initial={parsed} submitLabel="Confirmar e salvar" />
          </form>
          <Button type="button" variant="outline" size="sm" onClick={() => setMode("paste")}>
            Voltar ao texto
          </Button>
        </div>
      ) : null}
    </div>
  );
}
