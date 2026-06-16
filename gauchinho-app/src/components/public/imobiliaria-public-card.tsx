import Link from "next/link";
import Image from "next/image";
import { Building2, ExternalLink, Globe, MapPin, MessageCircle, Phone } from "lucide-react";
import { cn } from "@/lib/utils/cn";
import {
  formatEnderecoImobiliaria,
  temEnderecoVisivel,
} from "@/lib/imobiliarias/format-endereco";
import type { ImobiliariaPublic } from "@/lib/imobiliarias/public-card-utils";
import {
  normalizeSiteUrl,
  resolveWhatsappImobiliaria,
  whatsappImobiliariaUrl,
} from "@/lib/imobiliarias/public-card-utils";

export type ImobiliariaCardVariant = "grid" | "hero" | "panel";

type Props = {
  imob: ImobiliariaPublic;
  variant?: ImobiliariaCardVariant;
  imoveisCount?: number;
  whatsappFallback?: string | null;
  panelTitle?: string;
  className?: string;
};

export function ImobiliariaPublicCard({
  imob,
  variant = "grid",
  imoveisCount,
  whatsappFallback,
  panelTitle,
  className,
}: Props) {
  const endereco = formatEnderecoImobiliaria(imob);
  const showEndereco = temEnderecoVisivel(imob) && endereco;
  const waDigits = resolveWhatsappImobiliaria(imob, whatsappFallback);
  const waHref = waDigits ? whatsappImobiliariaUrl(waDigits) : null;
  const siteHref = normalizeSiteUrl(imob.site);
  const descricao =
    imob.descricao_curta?.trim() || (variant === "hero" ? imob.descricao?.trim() : null) || null;
  const cidadeLinha = [imob.cidade, imob.estado].filter(Boolean).join(" — ");

  const logoSize =
    variant === "hero" ? "h-28 w-28 md:h-36 md:w-36" : variant === "panel" ? "h-24 w-24" : "h-20 w-20";

  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border border-zinc-800/90 bg-gradient-to-br from-zinc-900/90 to-zinc-950 shadow-lg shadow-black/20",
        variant === "grid" && "p-6 transition hover:border-amber-500/35 hover:shadow-amber-500/5",
        variant === "panel" && "p-6",
        variant === "hero" && "p-6 md:p-8",
        className,
      )}
    >
      {panelTitle ? (
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-amber-500/90">
          {panelTitle}
        </p>
      ) : null}

      <div
        className={cn(
          "flex gap-5",
          variant === "grid" && "flex-col items-center text-center sm:flex-row sm:items-start sm:text-left",
          variant === "hero" && "flex-col md:flex-row md:items-start",
          variant === "panel" && "flex-col items-center text-center md:items-start md:text-left",
        )}
      >
        <div
          className={cn(
            "relative flex shrink-0 items-center justify-center overflow-hidden rounded-xl border border-zinc-700/80 bg-zinc-950/80 p-3 ring-1 ring-amber-500/10",
            logoSize,
          )}
        >
          {imob.logo_url ? (
            <Image
              src={imob.logo_url}
              alt=""
              width={144}
              height={144}
              className="max-h-full max-w-full object-contain"
            />
          ) : (
            <Building2 className="h-12 w-12 text-amber-500/80" aria-hidden />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <h2
            className={cn(
              "font-bold text-white",
              variant === "hero" ? "text-2xl md:text-3xl" : "text-lg md:text-xl",
            )}
          >
            {variant === "grid" ? (
              <Link href={`/oportunidades-imobiliarias/${imob.slug}`} className="hover:text-amber-400">
                {imob.nome}
              </Link>
            ) : (
              imob.nome
            )}
          </h2>
          {cidadeLinha ? (
            <p className="mt-1 flex items-center justify-center gap-1 text-sm text-zinc-400 md:justify-start">
              <MapPin className="h-3.5 w-3.5 shrink-0 text-amber-500/70" />
              {cidadeLinha}
            </p>
          ) : null}
          {showEndereco ? (
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">{endereco}</p>
          ) : null}
          {imob.telefone?.trim() ? (
            <p className="mt-2 flex items-center justify-center gap-1.5 text-sm text-zinc-400 md:justify-start">
              <Phone className="h-3.5 w-3.5 text-zinc-600" />
              {imob.telefone}
            </p>
          ) : null}
          {descricao ? (
            <p className="mt-3 text-sm leading-relaxed text-zinc-400">{descricao}</p>
          ) : null}
          {imoveisCount != null && imoveisCount >= 0 ? (
            <p className="mt-3 text-xs font-medium uppercase tracking-wide text-amber-500/80">
              {imoveisCount} {imoveisCount === 1 ? "imóvel ativo" : "imóveis ativos"}
            </p>
          ) : null}

          <div
            className={cn(
              "mt-5 flex flex-wrap gap-2",
              variant === "grid" && "justify-center sm:justify-start",
              variant === "panel" && "justify-center md:justify-start",
            )}
          >
            {waHref ? (
              <a
                href={waHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-emerald-900/30 transition hover:bg-emerald-500"
              >
                <MessageCircle className="h-4 w-4" />
                WhatsApp
              </a>
            ) : null}
            {siteHref ? (
              <a
                href={siteHref}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center justify-center gap-2 rounded-full border border-zinc-600 bg-zinc-900 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition hover:border-amber-500/50 hover:text-amber-300"
              >
                <Globe className="h-4 w-4" />
                Site
                <ExternalLink className="h-3 w-3 opacity-60" />
              </a>
            ) : null}
            <Link
              href={`/oportunidades-imobiliarias/${imob.slug}`}
              className="inline-flex items-center justify-center gap-2 rounded-full border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm font-semibold text-amber-300 transition hover:bg-amber-500/20"
            >
              Ver imóveis
            </Link>
          </div>
        </div>
      </div>
    </article>
  );
}

/** Alias semântico para detalhe do imóvel. */
export function ImobiliariaInfoPanel(props: Props) {
  return (
    <ImobiliariaPublicCard
      {...props}
      variant="panel"
      panelTitle={props.panelTitle ?? "Imobiliária responsável"}
    />
  );
}
