import { cn } from "@/lib/utils/cn";

type Props = {
  id?: string;
  eyebrow?: string;
  title: string;
  subtitle?: string;
  className?: string;
  children?: React.ReactNode;
};

export function HomeSection({ id, eyebrow, title, subtitle, className, children }: Props) {
  return (
    <section id={id} className={cn("scroll-mt-24 py-16 md:py-24", className)}>
      <div className="mx-auto max-w-7xl px-4 sm:px-6">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-500/90">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-3 max-w-3xl text-3xl font-bold tracking-tight text-white md:text-5xl">
          {title}
        </h2>
        {subtitle ? (
          <p className="mt-4 max-w-2xl text-base leading-relaxed text-zinc-400 md:text-lg">
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
        "group relative inline-flex items-center justify-center overflow-hidden rounded-full px-7 py-3.5 text-sm font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]",
        variant === "gold" &&
          "bg-gradient-to-r from-amber-400 via-amber-500 to-amber-600 text-zinc-950 shadow-lg shadow-amber-500/30 hover:shadow-amber-500/45 hover:brightness-105",
        variant === "outline" &&
          "border border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/50 hover:text-amber-300",
      )}
    >
      {variant === "gold" && (
        <span
          className="pointer-events-none absolute inset-0 -translate-x-full skew-x-12 bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
          aria-hidden
        />
      )}
      {children}
    </a>
  );
}
