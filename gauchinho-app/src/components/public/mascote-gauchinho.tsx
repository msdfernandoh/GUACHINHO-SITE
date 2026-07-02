"use client";

import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils/cn";
import { PUBLIC_LOGO_MASCOT_SRC } from "@/lib/brand/public-logo-text";

type Props = {
  variant?: "hero" | "cta" | "floating" | "compact";
  className?: string;
};

const SIZES = {
  hero: "h-28 w-28 sm:h-36 sm:w-36",
  cta: "h-16 w-16 sm:h-20 sm:w-20",
  floating: "h-14 w-14 opacity-90",
  compact: "h-10 w-10",
} as const;

export function MascoteGauchinho({ variant = "compact", className }: Props) {
  return (
    <span
      className={cn("relative inline-block shrink-0", SIZES[variant], className)}
      aria-hidden
    >
      <Image
        src={PUBLIC_LOGO_MASCOT_SRC}
        alt=""
        fill
        className="object-contain drop-shadow-md"
        sizes="144px"
        unoptimized
        onError={(e) => {
          e.currentTarget.style.display = "none";
        }}
      />
    </span>
  );
}
