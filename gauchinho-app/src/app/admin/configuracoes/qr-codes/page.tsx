import Link from "next/link";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canEditSettings } from "@/lib/auth/permissions";
import { QrCodesAdminClient } from "@/components/admin/configuracoes/qr-codes-admin-client";
import { listQrCodesUnicosAdmin } from "@/lib/eventos-sorteio/qr-unico";
import { EVENTOS_SORTEIO_MIGRATION_HINT } from "@/lib/comercial-eventos/db-ready";

export default async function QrCodesUnicosAdminPage() {
  const usuario = await getUsuarioNegocio();
  if (!canEditSettings(usuario?.perfil)) {
    redirect("/admin");
  }

  let items: Awaited<ReturnType<typeof listQrCodesUnicosAdmin>> = [];
  let migrationHint: string | null = null;
  try {
    items = await listQrCodesUnicosAdmin();
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (/qr_codes_unicos|does not exist|Could not find|schema cache/i.test(msg)) {
      migrationHint = EVENTOS_SORTEIO_MIGRATION_HINT;
    } else {
      throw e;
    }
  }

  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "localhost:3000";
  const proto = h.get("x-forwarded-proto") ?? "http";
  const publicBaseUrl = `${proto}://${host}`;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/configuracoes" className="text-sm text-amber-600 hover:underline">
          ← Configurações
        </Link>
        <h1 className="mt-2 text-2xl font-bold">QR Codes únicos</h1>
        <p className="text-sm text-zinc-500">
          QR Codes reutilizáveis para materiais impressos. Vincule a um evento na aba Sorteio, com período
          de utilização.
        </p>
      </div>
      {migrationHint ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {migrationHint}
        </div>
      ) : (
        <QrCodesAdminClient items={items} publicBaseUrl={publicBaseUrl} />
      )}
    </div>
  );
}
