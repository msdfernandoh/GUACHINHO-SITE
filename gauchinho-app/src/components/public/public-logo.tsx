import Link from "next/link";
import Image from "next/image";
import { cn } from "@/lib/utils/cn";

export type PublicLogoProps = {
  href?: string;
  logoUrl?: string | null;
  /** Nome principal (default GAUCHINHO) */
  title?: string;
  subtitle?: string;
  className?: string;
  size?: "sm" | "md";
};

export function PublicLogo({
  href = "/",
  logoUrl,
  title = "GAUCHINHO",
  subtitle = "Escritório de Soluções Financeiras",
  className,
  size = "md",
}: PublicLogoProps) {
  const titleClass =
    size === "sm"
      ? "text-base font-bold tracking-[0.12em] sm:text-lg"
      : "text-lg font-bold tracking-[0.15em] sm:text-xl";

  return (
    <Link
      href={href}
      className={cn(
        "group inline-flex max-w-[min(100%,20rem)] flex-col transition-opacity hover:opacity-90 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-500",
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
          <span className={cn(titleClass, "text-amber-400 group-hover:text-amber-300")}>
            {title.toUpperCase()}
          </span>
          {subtitle ? (
            <span className="mt-0.5 text-[10px] font-medium leading-tight text-zinc-400 sm:text-xs">
              {subtitle}
            </span>
          ) : null}
        </>
      )}
    </Link>
  );
}
