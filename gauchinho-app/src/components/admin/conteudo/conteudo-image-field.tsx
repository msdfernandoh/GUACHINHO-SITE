"use client";

import { useId, useState } from "react";
import { uploadConteudoMediaAction } from "@/app/admin/conteudo/actions";
import type { StorageBucketPublico } from "@/lib/storage/imagens";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";

type Props = {
  bucket: StorageBucketPublico;
  name: string;
  label: string;
  defaultUrl?: string | null;
  hint?: string;
  accept?: string;
};

export function ConteudoImageField({
  bucket,
  name,
  label,
  defaultUrl,
  hint,
  accept = "image/jpeg,image/png,image/webp,image/gif,image/svg+xml,.svg",
}: Props) {
  const inputId = useId();
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      setErr("Arquivo maior que 5 MB. Use PNG, JPG, WebP, GIF ou SVG.");
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("bucket", bucket);
      fd.set("file", file);
      const uploaded = await uploadConteudoMediaAction(fd);
      setUrl(uploaded);
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "Falha no upload";
      setErr(
        msg.includes("SERVICE_ROLE")
          ? "Upload indisponível: configure SUPABASE_SERVICE_ROLE_KEY no servidor (.env.local / Vercel)."
          : msg,
      );
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <Label htmlFor={inputId}>{label}</Label>
      {hint ? <p className="text-xs text-zinc-500">{hint}</p> : null}
      <Input
        id={inputId}
        name={name}
        value={url}
        onChange={(ev) => setUrl(ev.target.value)}
        placeholder="URL pública ou envie arquivo abaixo"
      />
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            "inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium dark:border-zinc-600 dark:bg-zinc-900",
            loading && "pointer-events-none opacity-60",
          )}
        >
          Importar logomarca
          <input type="file" accept={accept} onChange={onFile} disabled={loading} className="sr-only" />
        </label>
        {loading ? <span className="text-xs text-zinc-500">Enviando para o storage…</span> : null}
      </div>
      {err ? <p className="text-xs text-red-500">{err}</p> : null}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 max-h-24 rounded border object-contain dark:border-zinc-700" />
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={() => setUrl("")}>
        Limpar URL
      </Button>
    </div>
  );
}
