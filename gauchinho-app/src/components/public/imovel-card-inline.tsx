import Link from "next/link";
import Image from "next/image";
import { MapPin } from "lucide-react";
import type { ImovelPublic } from "@/lib/imoveis/types";
import { IMOVEL_TIPOS } from "@/lib/imoveis/types";
import { formatCurrency } from "@/lib/utils/format";
import { Button } from "@/components/ui/form-primitives";

export function ImovelCardInline({ imovel }: { imovel: ImovelPublic }) {
  const tipo = IMOVEL_TIPOS.find((t) => t.value === imovel.tipo_imovel)?.label ?? imovel.tipo_imovel;
  const valorLabel =
    imovel.exibir_valor_publico && imovel.valor != null
      ? formatCurrency(Number(imovel.valor))
      : "Valor sob consulta";

  return (
    <article className="overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900/60">
      <div className="relative aspect-video bg-zinc-800">
        {imovel.foto_principal_url ? (
          <Image src={imovel.foto_principal_url} alt="" fill className="object-cover" />
        ) : (
          <div className="flex h-full items-center justify-center">
            <MapPin className="h-10 w-10 text-zinc-600" />
          </div>
        )}
      </div>
      <div className="p-4">
        <h3 className="font-semibold">
          <Link href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`}>{imovel.titulo}</Link>
        </h3>
        <p className="text-sm text-zinc-400">
          {tipo} · {imovel.cidade}
        </p>
        <p className="mt-2 font-bold text-amber-400">{valorLabel}</p>
        <Link href={`/oportunidades-imobiliarias/imovel/${imovel.slug}`} className="mt-3 inline-block">
          <Button size="sm" type="button">
            Ver detalhes
          </Button>
        </Link>
      </div>
    </article>
  );
}
