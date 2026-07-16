"use client";

import { useTransition } from "react";
import Link from "next/link";
import {
  createQrCodeUnicoAction,
  toggleQrCodeUnicoAction,
  updateQrCodeUnicoAction,
} from "@/app/admin/configuracoes/qr-codes/actions";
import { SorteioQrPanel } from "@/components/admin/eventos/sorteio-qr-panel";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import type { QrCodeUnicoAdmin } from "@/lib/eventos-sorteio/qr-unico";

type Props = {
  items: QrCodeUnicoAdmin[];
  publicBaseUrl: string;
};

export function QrCodesAdminClient({ items, publicBaseUrl }: Props) {
  const [pending, startTransition] = useTransition();
  const base = publicBaseUrl.replace(/\/$/, "");

  return (
    <div className="space-y-8">
      <form action={createQrCodeUnicoAction} className="max-w-xl space-y-3 rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Novo QR Code único</h2>
        <p className="text-sm text-zinc-500">
          Use para materiais impressos. O mesmo QR pode ser vinculado a eventos diferentes em períodos
          distintos (um evento ativo por vez).
        </p>
        <div>
          <Label>Nome (ex.: Sinop, Cuiabá)</Label>
          <Input name="nome" required placeholder="Sinop" />
        </div>
        <div>
          <Label>Slug amigável (URL)</Label>
          <Input name="slug" placeholder="sinop" />
          <p className="mt-1 text-xs text-zinc-500">URL pública: {base}/qr/seu-slug</p>
        </div>
        <AdminFormSubmitButton label="Criar QR Code" pendingLabel="Criando…" />
      </form>

      <section className="space-y-4">
        <h2 className="text-lg font-semibold">QR Codes cadastrados ({items.length})</h2>
        {items.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum QR Code único ainda.</p>
        ) : (
          items.map((qr) => {
            const url = `${base}/qr/${qr.slug}`;
            return (
              <div key={qr.id} className="space-y-4 rounded-xl border p-4 dark:border-zinc-800">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-semibold">{qr.nome}</p>
                    <p className="break-all text-xs text-zinc-500">{url}</p>
                    {qr.vinculoAtivo ? (
                      <p className="mt-1 text-sm text-amber-700 dark:text-amber-400">
                        Ativo em:{" "}
                        <Link
                          href={`/admin/eventos/${qr.vinculoAtivo.evento_id}/sorteio`}
                          className="underline"
                        >
                          {qr.vinculoAtivo.evento_nome ?? "evento"}
                        </Link>{" "}
                        (
                        {new Date(qr.vinculoAtivo.periodo_inicio).toLocaleDateString("pt-BR")} –{" "}
                        {new Date(qr.vinculoAtivo.periodo_fim).toLocaleDateString("pt-BR")})
                      </p>
                    ) : (
                      <p className="mt-1 text-sm text-zinc-500">Sem vínculo ativo — disponível para eventos</p>
                    )}
                    <p className="mt-1 text-xs text-zinc-500">
                      Status: {qr.ativo ? "Habilitado" : "Desabilitado"}
                    </p>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        await toggleQrCodeUnicoAction(qr.id, !qr.ativo);
                      })
                    }
                  >
                    {qr.ativo ? "Desabilitar" : "Habilitar"}
                  </Button>
                </div>

                <form action={updateQrCodeUnicoAction.bind(null, qr.id)} className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Nome</Label>
                    <Input name="nome" defaultValue={qr.nome} required />
                  </div>
                  <div>
                    <Label>Slug</Label>
                    <Input name="slug" defaultValue={qr.slug} required />
                  </div>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input type="checkbox" name="ativo" defaultChecked={qr.ativo} />
                    QR habilitado
                  </label>
                  <div className="sm:col-span-2">
                    <AdminFormSubmitButton label="Salvar" pendingLabel="Salvando…" />
                  </div>
                </form>

                <SorteioQrPanel url={url} eventoNome={qr.nome} />
              </div>
            );
          })
        )}
      </section>
    </div>
  );
}
