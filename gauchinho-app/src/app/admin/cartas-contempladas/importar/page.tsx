import Link from "next/link";
import { requireUsuario } from "@/lib/auth/get-usuario";
import { isMaster } from "@/lib/auth/permissions";
import { getSplConfig } from "@/lib/spl/config-server";
import { ImportarCartasClient } from "@/components/admin/importar-cartas-client";

export const dynamic = "force-dynamic";

export default async function ImportarCartasPage() {
  const usuario = await requireUsuario();
  if (!isMaster(usuario.perfil)) {
    return <p className="rounded-xl border bg-white p-6 text-sm">Esta função é exclusiva do master.</p>;
  }
  const { margemEntradaCarta, margemEntradaCartaVeiculo } = await getSplConfig();
  return (
    <div className="mx-auto max-w-5xl space-y-5 px-1 sm:px-0">
      <Link href="/admin/cartas-contempladas" className="text-sm text-amber-600 hover:underline">
        ← Cartas contempladas
      </Link>
      <div>
        <h1 className="text-2xl font-bold">Atualizar cartas pelo WhatsApp</h1>
        <p className="text-sm text-zinc-500">
          Cole a conversa como chegou. Você escolhe se só cadastra ou se cadastra e substitui as cartas do mesmo tipo.
        </p>
      </div>
      <ImportarCartasClient margens={{ imovel: margemEntradaCarta, automovel: margemEntradaCartaVeiculo }} />
    </div>
  );
}
