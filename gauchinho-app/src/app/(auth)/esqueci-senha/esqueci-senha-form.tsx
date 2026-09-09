"use client";

import { useActionState } from "react";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { solicitarRecuperacaoSenhaAction, type RecuperarSenhaState } from "./actions";

export function EsqueciSenhaForm({
  isRacon,
  primary,
}: {
  isRacon: boolean;
  primary: string;
}) {
  const [state, formAction, isPending] = useActionState(
    solicitarRecuperacaoSenhaAction,
    null as RecuperarSenhaState | null,
  );

  return (
    <div className="mt-6 space-y-4">
      {state ? (
        <div
          role="status"
          className={`rounded-lg px-4 py-3 text-sm leading-relaxed ${
            state.ok
              ? "border border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800/40 dark:bg-emerald-950/40 dark:text-emerald-300"
              : "border border-red-200 bg-red-50 text-red-700 dark:border-red-800/40 dark:bg-red-950/40 dark:text-red-300"
          }`}
        >
          {state.message}
        </div>
      ) : null}

      {state?.ok ? (
        <div className="pt-2 text-center">
          <Link
            href="/login"
            className={
              isRacon
                ? "inline-flex items-center justify-center font-semibold hover:underline"
                : "inline-flex items-center justify-center font-semibold text-amber-600 hover:underline dark:text-amber-500"
            }
            style={isRacon ? { color: primary } : undefined}
          >
            ← Voltar para o Login
          </Link>
        </div>
      ) : (
        <form action={formAction} className="space-y-4">
          <div>
            <Label htmlFor="email">E-mail cadastrado</Label>
            <Input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="seu-email@exemplo.com"
            />
          </div>

          <Button
            type="submit"
            disabled={isPending}
            className="w-full"
            style={isRacon ? { backgroundColor: primary, color: "white" } : undefined}
          >
            {isPending ? "Enviando link..." : "Enviar instruções por e-mail"}
          </Button>
        </form>
      )}
    </div>
  );
}
