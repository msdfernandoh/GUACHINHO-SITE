"use client";

import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils/cn";
import { normalizeConteudoImageUrl } from "@/lib/conteudo/normalize-image-url";

type Props = {
  src: string;
  alt: string;
  className?: string;
  fill?: boolean;
  sizes?: string;
  fallbackText?: string;
};

export function PartnerLogoImage({ src, alt, className, fill, sizes = "112px", fallbackText }: Props) {
  const url = normalizeConteudoImageUrl(src);
  const [failed, setFailed] = useState(false);

  if (!url || failed) {
    return (
      <span
        className={cn(
          "flex items-center justify-center rounded-lg border border-zinc-600/80 bg-zinc-900/80 px-2 py-2 text-center text-xs font-semibold text-zinc-200",
          className,
        )}
      >
        {fallbackText ?? alt}
      </span>
    );
  }

  if (fill) {
    return (
      <Image
        src={url}
        alt={alt}
        fill
        className={cn("object-contain", className)}
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
      width={112}
      height={40}
      className={cn("max-h-10 w-auto object-contain", className)}
      sizes={sizes}
      unoptimized={url.endsWith(".svg")}
      onError={() => setFailed(true)}
    />
  );
}
