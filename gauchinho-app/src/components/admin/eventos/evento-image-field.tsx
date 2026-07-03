"use client";

import { useId, useState } from "react";
import { uploadEventoImagemAction } from "@/app/admin/eventos/actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { cn } from "@/lib/utils/cn";

type Kind = "capa" | "banner";

type Props = {
  kind: Kind;
  name: string;
  label: string;
  defaultUrl?: string | null;
  slugHint: string;
};

const ACCEPT = "image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp";

export function EventoImageField({ kind, name, label, defaultUrl, slugHint }: Props) {
  const inputId = useId();
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [loading, setLoading] = useState(false);
  const [okMsg, setOkMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setOkMsg(null);
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type)) {
      setErr("Formato inválido. Use JPEG, PNG ou WebP.");
      e.target.value = "";
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErr("Arquivo maior que 5 MB.");
      e.target.value = "";
      return;
    }
    setLoading(true);
    setErr(null);
    try {
      const fd = new FormData();
      fd.set("kind", kind);
      fd.set("slug_hint", slugHint || "evento");
      fd.set("file", file);
      const uploaded = await uploadEventoImagemAction(fd);
      setUrl(uploaded);
      setOkMsg("Imagem enviada com sucesso.");
    } catch (ex) {
      const msg = ex instanceof Error ? ex.message : "Falha no upload";
      setErr(
        msg.includes("SERVICE_ROLE")
          ? "Não foi possível enviar a imagem. Verifique a configuração do servidor (Storage)."
          : msg.includes("Formato") || msg.includes("5 MB")
            ? msg
            : "Não foi possível enviar a imagem. Tente novamente.",
      );
    } finally {
      setLoading(false);
      e.target.value = "";
    }
  }

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-zinc-300 p-4 dark:border-zinc-700">
      <Label htmlFor={inputId}>{label}</Label>
      <Input
        id={inputId}
        name={name}
        value={url}
        onChange={(ev) => {
          setUrl(ev.target.value);
          setOkMsg(null);
        }}
        placeholder="https://… ou envie arquivo abaixo"
      />
      <p className="text-xs text-zinc-500">Informe a URL manualmente ou envie um arquivo (até 5 MB).</p>
      <div className="flex flex-wrap items-center gap-3">
        <label
          className={cn(
            "inline-flex cursor-pointer items-center rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-2 text-sm font-medium transition hover:bg-zinc-100 active:scale-[0.98] dark:border-zinc-600 dark:bg-zinc-900 dark:hover:bg-zinc-800",
            loading && "pointer-events-none cursor-not-allowed opacity-60",
          )}
        >
          {loading ? "Enviando…" : kind === "capa" ? "Enviar imagem de capa" : "Enviar banner"}
          <input type="file" accept={ACCEPT} onChange={onFile} disabled={loading} className="sr-only" />
        </label>
      </div>
      {okMsg ? <p className="text-xs font-medium text-emerald-600 dark:text-emerald-400">{okMsg}</p> : null}
      {err ? <p className="text-xs text-red-500">{err}</p> : null}
      {url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={url} alt="" className="mt-2 max-h-32 w-full rounded border object-contain dark:border-zinc-700" />
      ) : null}
      <Button type="button" size="sm" variant="outline" onClick={() => setUrl("")}>
        Limpar URL
      </Button>
    </div>
  );
}
