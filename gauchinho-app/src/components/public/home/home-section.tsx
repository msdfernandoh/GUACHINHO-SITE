import type { CSSProperties } from "react";
import { cn } from "@/lib/utils/cn";

type Props = {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  style?: CSSProperties;
  children?: React.ReactNode;
};

export function HomeSection({ id, eyebrow, title, subtitle, className, style, children }: Props) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-16 md:py-24", className)} style={style}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {eyebrow ? (
          <p
            className="text-xs font-bold uppercase tracking-[0.28em]"
            style={{ color: "var(--brand-gold)" }}
          >
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-slate-400 md:text-lg">
            {subtitle}
          </p>
        ) : null}
        {children ? <div className="mt-12 md:mt-14">{children}</div> : null}
      </div>
    </section>
  );
}

export function HomeCtaLink({
  href,
  children,
  variant = "gold",
}: {
  href: string;
  children: React.ReactNode;
  variant?: "gold" | "outline";
}) {
  const external = href.startsWith("http");
  return (
    <a
      href={href}
      {...(external ? { target: "_blank", rel: "noreferrer" } : {})}
      className={cn(
        "group relative inline-flex items-center justify-center overflow-hidden rounded-xl px-7 py-3.5 text-sm font-bold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
        variant === "gold" &&
          "text-[#0A1628] shadow-lg hover:brightness-110",
        variant === "outline" &&
          "border-2 text-white hover:bg-white/5",
      )}
      style={
        variant === "gold"
          ? {
              background: "linear-gradient(135deg, #C9A84C, #F0D080, #C9A84C)",
              boxShadow: "0 8px 24px rgba(201,168,76,0.3)",
            }
          : {
              borderColor: "rgba(255,255,255,0.25)",
            }
      }
    >
      {variant === "gold" && (
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/30 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          aria-hidden
        />
      )}
      {children}
    </a>
  );
}
