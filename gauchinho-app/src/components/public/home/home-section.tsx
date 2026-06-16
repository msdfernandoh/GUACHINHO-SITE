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
    <section id={id} className={cn("scroll-mt-24 py-14 md:py-20", className)}>
      <div className="mx-auto max-w-6xl px-4">
        {eyebrow ? (
          <p className="text-xs font-semibold uppercase tracking-[0.25em] text-amber-500/90">
            {eyebrow}
          </p>
        ) : null}
        <h2 className="mt-2 text-2xl font-bold tracking-tight text-white md:text-3xl">{title}</h2>
        {subtitle ? <p className="mt-3 max-w-2xl text-zinc-400">{subtitle}</p> : null}
        {children ? <div className="mt-10">{children}</div> : null}
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
        "inline-flex items-center justify-center rounded-full px-6 py-3 text-sm font-semibold transition-all duration-200 hover:scale-[1.02] active:scale-[0.98]",
        variant === "gold" &&
          "bg-amber-500 text-zinc-950 shadow-lg shadow-amber-500/20 hover:bg-amber-400",
        variant === "outline" &&
          "border border-zinc-600 bg-zinc-900/80 text-zinc-100 hover:border-amber-500/50 hover:text-amber-300",
      )}
    >
      {children}
    </a>
  );
}
