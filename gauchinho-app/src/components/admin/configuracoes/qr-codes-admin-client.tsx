"use client";

import { useId, useState, useTransition } from "react";
import Link from "next/link";
import QRCode from "react-qr-code";
import {
  createQrCodeUnicoAction,
  toggleQrCodeUnicoAction,
  updateQrCodeUnicoAction,
  updateDestinoQrCodeAction,
} from "@/app/admin/configuracoes/qr-codes/actions";
import { SorteioQrPanel } from "@/components/admin/eventos/sorteio-qr-panel";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import type {
  QrCodeUnicoAdmin,
  QrCodeTipoDestino,
  QrCodeDestinoHistoricoRow,
} from "@/lib/eventos-sorteio/qr-unico";

type Props = {
  items: QrCodeUnicoAdmin[];
  eventos: { id: string; nome: string; slug: string; ativo: boolean }[];
  historicoSite?: QrCodeDestinoHistoricoRow[];
  publicBaseUrl: string;
};

export function QrCodesAdminClient({
  items,
  eventos,
  historicoSite = [],
  publicBaseUrl,
}: Props) {
  const [pending, startTransition] = useTransition();
  const base = publicBaseUrl.replace(/\/$/, "");

  // Localizar o QR Institucional (slug 'site')
  const siteQr = items.find((q) => q.slug === "site");
  const outrosQrs = items.filter((q) => q.slug !== "site");

  // Estado para o seletor de destino do QR Institucional
  const [tipoDestino, setTipoDestino] = useState<QrCodeTipoDestino>(
    siteQr?.tipo_destino || "site"
  );
  const [copied, setCopied] = useState(false);
  const [showHistory, setShowHistory] = useState(false);

  const siteSvgId = `qr-site-svg-${useId().replace(/:/g, "")}`;
  const siteUrl = `${base}/qr/site`;

  const copySiteUrl = async () => {
    try {
      await navigator.clipboard.writeText(siteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  };

  const downloadSiteSvg = () => {
    const svg = document.getElementById(siteSvgId)?.querySelector("svg");
    if (!svg) return;
    const blob = new Blob([svg.outerHTML], { type: "image/svg+xml" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "qr-institucional-gauchinho.svg";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const downloadSitePng1200 = () => {
    const svg = document.getElementById(siteSvgId)?.querySelector("svg");
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement("canvas");
    canvas.width = 1200;
    canvas.height = 1200;
    const ctx = canvas.getContext("2d");
    const img = new Image();
    img.onload = () => {
      if (!ctx) return;
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, 1200, 1200);
      ctx.drawImage(img, 100, 100, 1000, 1000);
      const pngUrl = canvas.toDataURL("image/png");
      const a = document.createElement("a");
      a.href = pngUrl;
      a.download = "qr-institucional-gauchinho-1200px.png";
      a.click();
    };
    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
  };

  return (
    <div className="space-y-10">
      {/* 1. SEÇÃO EM DESTAQUE: QR INSTITUCIONAL PERMANENTE */}
      {siteQr && (
        <section className="relative overflow-hidden rounded-2xl border-2 border-amber-500/40 bg-linear-to-br from-amber-50/50 via-white to-amber-50/20 p-6 shadow-sm dark:from-zinc-900/80 dark:via-zinc-900 dark:to-zinc-900/50 dark:border-amber-500/30">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-amber-200/60 pb-4 dark:border-zinc-800">
            <div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/15 px-3 py-1 text-xs font-semibold text-amber-800 dark:text-amber-300">
                  <span className="h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
                  QR Institucional Permanente (Físico)
                </span>
                <span className="text-xs text-zinc-500">Impresso / Gráfica / Perene</span>
              </div>
              <h2 className="mt-2 text-xl font-bold text-zinc-900 dark:text-zinc-100">
                {siteQr.nome}
              </h2>
              <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
                O QR Code impresso <strong className="font-semibold text-zinc-800 dark:text-zinc-200">nunca muda</strong> ({siteUrl}). Altere abaixo para onde ele aponta em tempo real.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copySiteUrl}
                className="font-mono text-xs"
              >
                {copied ? "✓ Copiado!" : "Copiar Link"}
              </Button>
              <a
                href={siteUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-xs hover:bg-amber-700"
              >
                Testar Destino ↗
              </a>
            </div>
          </div>

          <div className="mt-6 grid gap-8 lg:grid-cols-12">
            {/* Bloco Visual do QR */}
            <div className="flex flex-col items-center justify-center rounded-xl border border-zinc-200 bg-white/80 p-6 text-center shadow-xs dark:border-zinc-800 dark:bg-zinc-950/60 lg:col-span-4">
              <div id={siteSvgId} className="rounded-xl bg-white p-4 shadow-sm">
                <QRCode value={siteUrl} size={220} level="H" />
              </div>
              <p className="mt-3 font-mono text-xs text-zinc-500">{siteUrl}</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSitePng1200}
                  className="text-xs"
                >
                  Baixar PNG (1200px)
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={downloadSiteSvg}
                  className="text-xs"
                >
                  Baixar SVG
                </Button>
              </div>
            </div>

            {/* Configuração de Destino Atual */}
            <div className="space-y-4 lg:col-span-8">
              <form
                action={updateDestinoQrCodeAction.bind(null, siteQr.id)}
                className="space-y-4 rounded-xl border border-zinc-200 bg-white/90 p-5 shadow-xs dark:border-zinc-800 dark:bg-zinc-950/40"
              >
                <h3 className="font-semibold text-zinc-900 dark:text-zinc-100">
                  Definir Destino do QR Institucional
                </h3>
                <p className="text-xs text-zinc-500">
                  Ao salvar, qualquer pessoa que escanear o material impresso será redirecionada instantaneamente para o novo destino.
                </p>

                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Tipo de Destino</Label>
                    <select
                      name="tipo_destino"
                      value={tipoDestino}
                      onChange={(e) => setTipoDestino(e.target.value as QrCodeTipoDestino)}
                      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                    >
                      <option value="site">Home do Site (gauchinhoconsorcios.com.br)</option>
                      <option value="checkin_evento">Check-in de Evento Específico (Sorteio)</option>
                      <option value="whatsapp">WhatsApp Institucional / Comercial</option>
                      <option value="pagina_interna">Página Interna do Site</option>
                      <option value="custom">Link Externo Personalizado</option>
                      <option value="evento">Evento Vinculado por Período (Legado)</option>
                    </select>
                  </div>

                  {tipoDestino === "checkin_evento" && (
                    <div>
                      <Label>Selecione o Evento</Label>
                      <select
                        name="destino_evento_id"
                        defaultValue={siteQr.destino_evento_id || ""}
                        className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 shadow-xs focus:border-amber-500 focus:outline-hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
                      >
                        <option value="">Selecione um evento...</option>
                        {eventos.map((ev) => (
                          <option key={ev.id} value={ev.id}>
                            {ev.nome} {ev.ativo ? "(Ativo)" : "(Inativo)"}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {(tipoDestino === "whatsapp" ||
                    tipoDestino === "pagina_interna" ||
                    tipoDestino === "custom" ||
                    tipoDestino === "site") && (
                    <div className={tipoDestino === "site" ? "sm:col-span-1 opacity-70" : "sm:col-span-1"}>
                      <Label>
                        {tipoDestino === "whatsapp"
                          ? "Link ou Número de WhatsApp"
                          : tipoDestino === "pagina_interna"
                          ? "Caminho da Página (ex: /consorcio)"
                          : tipoDestino === "custom"
                          ? "URL Completa (https://...)"
                          : "URL de Destino"}
                      </Label>
                      <Input
                        name="destino_url"
                        defaultValue={
                          siteQr.destino_url || (tipoDestino === "site" ? "/" : "")
                        }
                        placeholder={
                          tipoDestino === "whatsapp"
                            ? "https://wa.me/5566999126120"
                            : tipoDestino === "pagina_interna"
                            ? "/consorcio"
                            : "https://exemplo.com.br"
                        }
                      />
                    </div>
                  )}

                  <div className="sm:col-span-2">
                    <Label>Motivo da Alteração (Opcional — Auditável no Histórico)</Label>
                    <Input
                      name="motivo"
                      placeholder="Ex: Stand na feira de agronegócio, Campanha promocional de inverno..."
                    />
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <button
                    type="button"
                    onClick={() => setShowHistory(!showHistory)}
                    className="text-xs font-semibold text-amber-700 hover:underline dark:text-amber-400"
                  >
                    {showHistory
                      ? "Ocultar histórico de destinos"
                      : `Ver histórico de alterações (${historicoSite.length})`}
                  </button>
                  <AdminFormSubmitButton label="Salvar Novo Destino" pendingLabel="Salvando…" />
                </div>
              </form>

              {/* Tabela de Histórico de Alterações */}
              {showHistory && (
                <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-xs dark:border-zinc-800 dark:bg-zinc-950/60">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-zinc-500">
                    Histórico de Alterações de Destino
                  </h4>
                  {historicoSite.length === 0 ? (
                    <p className="mt-2 text-xs text-zinc-400">Nenhuma alteração registrada ainda.</p>
                  ) : (
                    <div className="mt-3 max-h-60 overflow-y-auto divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                      {historicoSite.map((h) => (
                        <div key={h.id} className="py-2.5">
                          <div className="flex items-center justify-between text-zinc-500">
                            <span>
                              {new Date(h.created_at).toLocaleString("pt-BR")}
                            </span>
                            <span className="font-medium text-zinc-700 dark:text-zinc-300">
                              Por: {h.alterado_por_nome || "Administrador"}
                            </span>
                          </div>
                          <div className="mt-1">
                            <span className="rounded bg-zinc-100 px-1.5 py-0.5 text-[11px] text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                              {h.tipo_destino_anterior || "evento"}
                            </span>
                            <span className="mx-1.5 text-zinc-400">→</span>
                            <span className="rounded bg-amber-100 px-1.5 py-0.5 font-semibold text-[11px] text-amber-800 dark:bg-amber-900/50 dark:text-amber-200">
                              {h.tipo_destino_novo}
                            </span>
                            {h.destino_url_novo && (
                              <span className="ml-2 font-mono text-[11px] text-zinc-500">
                                ({h.destino_url_novo})
                              </span>
                            )}
                          </div>
                          {h.motivo && (
                            <p className="mt-1 text-zinc-600 italic dark:text-zinc-400">
                              “{h.motivo}”
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* 2. CRIAÇÃO DE QR CODES ESPECÍFICOS */}
      <form action={createQrCodeUnicoAction} className="max-w-xl space-y-3 rounded-xl border p-4 dark:border-zinc-800">
        <h2 className="text-lg font-semibold">Novo QR Code específico</h2>
        <p className="text-sm text-zinc-500">
          Crie QR Codes adicionais vinculados a cidades, eventos específicos ou materiais regionais.
        </p>
        <div>
          <Label>Nome (ex.: Sinop, Cuiabá, Stand Shopping)</Label>
          <Input name="nome" required placeholder="Sinop" />
        </div>
        <div>
          <Label>Slug amigável (URL)</Label>
          <Input name="slug" placeholder="sinop" />
          <p className="mt-1 text-xs text-zinc-500">URL pública: {base}/qr/seu-slug</p>
        </div>
        <AdminFormSubmitButton label="Criar QR Code" pendingLabel="Criando…" />
      </form>

      {/* 3. DEMAIS QR CODES CADASTRADOS */}
      <section className="space-y-4">
        <h2 className="text-lg font-semibold">Outros QR Codes cadastrados ({outrosQrs.length})</h2>
        {outrosQrs.length === 0 ? (
          <p className="text-sm text-zinc-500">Nenhum QR Code adicional cadastrado.</p>
        ) : (
          outrosQrs.map((qr) => {
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
