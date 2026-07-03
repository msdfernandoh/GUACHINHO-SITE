import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";
import { PUBLIC_LOGO_MASCOT_SRC } from "@/lib/brand/public-logo-text";

export type PublicLogoProps = {
  href?: string;
  logoUrl?: string | null;
  /** Marca principal (ex.: GAUCHINHO) */
  title?: string;
  subtitle?: string;
  className?: string;
  size?: "sm" | "md";
  /** Mascote ao lado do texto quando não há logo em imagem */
  showMascot?: boolean;
  mascotSrc?: string;
};

export function PublicLogo({
  href = "/",
  logoUrl,
  title = "GAUCHINHO",
  subtitle = "Consórcios e soluções financeiras",
  className,
  size = "md",
  showMascot = true,
  mascotSrc = PUBLIC_LOGO_MASCOT_SRC,
}: PublicLogoProps) {
  const titleClass =
    size === "sm"
      ? "text-lg font-black tracking-[0.14em] sm:text-xl"
      : "text-xl font-black tracking-[0.16em] sm:text-2xl";

  const subClass =
    size === "sm"
      ? "text-[7px] font-semibold uppercase leading-[1.25] tracking-[0.06em] text-zinc-400 sm:text-[7.5px]"
      : "text-[7px] font-semibold uppercase leading-[1.25] tracking-[0.07em] text-zinc-400 sm:text-[8px] md:text-[8.5px]";

  const mascotSize = size === "sm" ? "h-9 w-9" : "h-11 w-11 sm:h-12 sm:w-12";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex max-w-[min(100%,13.5rem)] shrink-0 items-center gap-2 transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500 sm:max-w-[14.5rem] md:max-w-[15.5rem] lg:max-w-[16.5rem]",
        className,
      )}
      aria-label="Gauchinho — voltar ao início"
    >
      {logoUrl?.trim() ? (
        <span className="relative block h-10 w-40 sm:h-12 sm:w-48">
          <Image
            src={logoUrl.trim()}
            alt={title}
            fill
            className="object-contain object-left"
            sizes="(max-width: 640px) 160px, 192px"
            priority
          />
        </span>
      ) : (
        <>
          {showMascot ? (
            <span className={cn("relative shrink-0", mascotSize)} aria-hidden>
              <Image
                src={mascotSrc}
                alt=""
                fill
                className="object-contain object-center drop-shadow-sm"
                sizes="48px"
                priority
                unoptimized
              />
            </span>
          ) : null}
          <span className="flex min-w-0 flex-col">
            <span
              className={cn(
                titleClass,
                "bg-gradient-to-r from-amber-200 to-amber-500 bg-clip-text text-transparent group-hover:from-amber-100 group-hover:to-amber-400",
              )}
            >
              {title.toUpperCase()}
            </span>
            {subtitle ? (
              <span
                className={cn(
                  subClass,
                  "mt-0.5 hidden max-w-[8.25rem] whitespace-normal sm:block sm:max-w-[8.75rem] md:max-w-[9.25rem] lg:max-w-[10rem]",
                )}
              >
                {subtitle}
              </span>
            ) : null}
          </span>
        </>
      )}
    </Link>
  );
}
