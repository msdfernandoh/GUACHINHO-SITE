"use client";

import Image from "next/image";
import { MascoteGauchinho } from "@/components/public/mascote-gauchinho";
import { HOME_MEDIA } from "@/lib/home/home-media";
import { useTenantBrand } from "@/components/tenant/tenant-brand-context";

type Props = {
  eyebrow: string;
  title: string;
  subtitle?: string;
};

/** Hero centralizado no padrão Simulador / Calculadoras. */
export function PublicPremiumHero({ eyebrow, title, subtitle }: Props) {
  const brand = useTenantBrand();
  return (
    <header className="relative mb-8 sm:mb-10">
      {brand.isGauchinho ? <div
        className="pointer-events-none absolute -left-2 top-1/2 hidden -translate-y-1/2 select-none opacity-80 lg:block xl:-left-6"
        aria-hidden
      >
        <div className="relative h-40 w-40 xl:h-52 xl:w-52">
          <Image
            src={HOME_MEDIA.mascoteSvg}
            alt=""
            fill
            unoptimized
            className="object-contain object-bottom drop-shadow-[0_12px_32px_rgba(0,0,0,0.45)]"
            sizes="208px"
          />
        </div>
      </div> : null}
      {brand.isGauchinho ? <div
        className="pointer-events-none absolute left-2 top-2 opacity-[0.12] sm:left-4 lg:hidden"
        aria-hidden
      >
        <div className="relative h-16 w-16">
          <Image src={HOME_MEDIA.mascoteSvg} alt="" fill unoptimized className="object-contain" sizes="64px" />
        </div>
      </div> : null}
      <div className="relative z-[1] mx-auto max-w-3xl text-center">
        {brand.isGauchinho ? <div className="mb-4 flex justify-center">
          <MascoteGauchinho variant="cta" />
        </div> : null}
        <p className="text-xs font-bold uppercase tracking-[0.25em] text-amber-400 sm:text-sm">{eyebrow}</p>
        <h1 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-[2.75rem]">
          {title}
        </h1>
        {subtitle ? (
          <p className="mx-auto mt-4 max-w-2xl text-base leading-relaxed text-slate-400 sm:text-lg">{subtitle}</p>
        ) : null}
      </div>
    </header>
  );
}
