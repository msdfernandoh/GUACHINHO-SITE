"use client";

import { useState } from "react";
import { uploadConteudoMediaAction } from "@/app/admin/conteudo/actions";
import type { StorageBucketPublico } from "@/lib/storage/imagens";
import { Button, Input, Label } from "@/components/ui/form-primitives";

type Props = {
  bucket: StorageBucketPublico;
  name: string;
  label: string;
  defaultUrl?: string | null;
};

export function ConteudoImageField({ bucket, name, label, defaultUrl }: Props) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("bucket", bucket);
      fd.set("file", file);
      const uploaded = await uploadConteudoMediaAction(fd);
      setUrl(uploaded);
    } catch (ex) {
      setErr(ex instanceof Error ? ex.message : "Falha no upload");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input name={name} value={url} onChange={(ev) => setUrl(ev.target.value)} placeholder="URL ou envie arquivo" />
      <input type="file" accept="image/*" onChange={onFile} disabled={loading} className="text-sm" />
      {loading ? <p className="text-xs text-zinc-500">Enviando…</p> : null}
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
