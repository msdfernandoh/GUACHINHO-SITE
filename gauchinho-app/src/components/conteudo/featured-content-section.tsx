import Link from "next/link";
import { HomeCtaLink, HomeSection } from "@/components/public/home/home-section";
import { HomeReveal } from "@/components/public/home/home-reveal";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
  ctaHref: string;
  ctaLabel: string;
  children: React.ReactNode;
  hideIfEmpty?: boolean;
  empty?: boolean;
};

export function FeaturedContentSection({
  eyebrow,
  title,
  subtitle,
  ctaHref,
  ctaLabel,
  children,
  hideIfEmpty,
  empty,
}: Props) {
  if (hideIfEmpty && empty) return null;

  return (
    <HomeSection eyebrow={eyebrow} title={title} subtitle={subtitle}>
      <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{children}</div>
      {!empty ? (
        <div className="mt-10">
          <HomeCtaLink href={ctaHref} variant="outline">
            {ctaLabel}
          </HomeCtaLink>
        </div>
      ) : null}
    </HomeSection>
  );
}

export function FeaturedContentReveal({ index, children }: { index: number; children: React.ReactNode }) {
  return <HomeReveal delayMs={index * 60}>{children}</HomeReveal>;
}

export function FeaturedContentLinkCard({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link href={href} className="block h-full">
      {children}
    </Link>
  );
}
