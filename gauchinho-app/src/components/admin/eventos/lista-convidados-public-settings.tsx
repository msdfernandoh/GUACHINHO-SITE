"use client";

import { useState, useTransition } from "react";
import { updateListaPublicaAction } from "@/app/admin/eventos/listas-convidados/actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { resolvePublicSiteUrl } from "@/lib/seo/site-url";

type Props = {
  listaId: string;
  initialPublica: boolean;
  initialSlug: string | null;
  consultorNome: string;
  eventoNome: string;
};

export function ListaConvidadosPublicSettings({
  listaId,
  initialPublica,
  initialSlug,
  consultorNome,
  eventoNome,
}: Props) {
  const [publica, setPublica] = useState(initialPublica);
  const [slug, setSlug] = useState(initialSlug ?? "");
  const [savedSlug, setSavedSlug] = useState(initialSlug);
  const [erro, setErro] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [pending, startTransition] = useTransition();

  const publicPath = savedSlug && publica ? `/lista-convidados/${savedSlug}` : null;
  const publicUrl = publicPath ? `${resolvePublicSiteUrl()}${publicPath}` : null;

  const save = () => {
    setErro(null);
    startTransition(async () => {
      try {
        const res = await updateListaPublicaAction(listaId, { publica, slug: slug || undefined });
        setPublica(res.publica);
        setSavedSlug(res.slug);
        if (res.slug) setSlug(res.slug);
      } catch (e) {
        setErro(e instanceof Error ? e.message : "Erro ao salvar");
      }
    });
  };

  const copyLink = async () => {
    if (!publicUrl) return;
    try {
      await navigator.clipboard.writeText(publicUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setErro("Não foi possível copiar o link.");
    }
  };

  return (
    <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4 dark:border-amber-500/20">
      <p className="text-sm font-semibold text-zinc-800 dark:text-amber-100">Link público para cadastro</p>
      <p className="mt-1 text-xs text-zinc-600 dark:text-zinc-400">
        Com a lista pública, o consultor cadastra convidados sem entrar no admin.
      </p>

      <label className="mt-4 flex cursor-pointer items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={publica}
          onChange={(e) => setPublica(e.target.checked)}
          className="h-4 w-4 rounded border-zinc-400"
        />
        Lista pública
      </label>

      {publica ? (
        <div className="mt-3 space-y-2">
          <div>
            <Label className="text-xs">Slug do link</Label>
            <Input
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              className="mt-1 font-mono text-sm"
              placeholder={`${consultorNome}-${eventoNome}`.toLowerCase().replace(/\s+/g, "-")}
            />
            <p className="mt-1 text-xs text-zinc-500">
              URL: /lista-convidados/<span className="font-mono">{slug || "…"}</span>
            </p>
          </div>
          {publicUrl ? (
            <div className="flex flex-wrap items-center gap-2">
              <code className="max-w-full truncate rounded bg-zinc-900/10 px-2 py-1 text-xs dark:bg-black/30">
                {publicUrl}
              </code>
              <Button type="button" size="sm" variant="outline" onClick={copyLink}>
                {copied ? "Copiado!" : "Copiar link"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="button" size="sm" className="mt-4" disabled={pending} onClick={save}>
        {pending ? "Salvando…" : "Salvar visibilidade"}
      </Button>
      {erro ? <p className="mt-2 text-sm text-red-600">{erro}</p> : null}
    </div>
  );
}
