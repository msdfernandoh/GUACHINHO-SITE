"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { isSupabaseStoragePublicUrl, normalizeConteudoImageUrl } from "@/lib/conteudo/normalize-image-url";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  fallbackText?: string;
  /** Altura mínima útil para logos em cards grandes (home parceiros). */
  large?: boolean;
};

export function PartnerLogoImage({
  src,
  alt,
  className,
  fill,
  sizes = "160px",
  fallbackText,
  large = false,
}: Props) {
  const url = normalizeConteudoImageUrl(src);
  const [failed, setFailed] = useState(false);

  const fallback = (
    <span
      className={cn(
        "flex h-full min-h-[3.5rem] w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-zinc-50 px-3 py-2 text-center font-semibold text-zinc-700",
        large ? "text-sm sm:text-base" : "text-xs",
        className,
      )}
    >
      {fallbackText ?? alt}
    </span>
  );

  if (!url || failed) {
    return fallback;
  }

  const imgClass = cn("object-contain object-center", fill ? "h-full w-full max-h-full max-w-full" : className);

  if (url.startsWith("/") || isSupabaseStoragePublicUrl(url)) {
    if (fill) {
      return (
        <Image
          src={url}
          alt={alt}
          fill
          className={imgClass}
          sizes={sizes}
          unoptimized={url.endsWith(".svg")}
          onError={() => setFailed(true)}
        />
      );
    }
    return (
      <Image
        src={url}
        alt={alt}
        width={large ? 180 : 112}
        height={large ? 72 : 40}
        className={imgClass}
        sizes={sizes}
        unoptimized={url.endsWith(".svg")}
        onError={() => setFailed(true)}
      />
    );
  }

  if (fill) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={alt}
        className={imgClass}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      src={url}
      alt={alt}
      className={imgClass}
      loading="lazy"
      referrerPolicy="no-referrer"
      onError={() => setFailed(true)}
    />
  );
}
