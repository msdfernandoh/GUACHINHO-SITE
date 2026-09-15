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
  let eventos: { id: string; nome: string; slug: string; ativo: boolean }[] = [];
  let historicoSite: any[] = [];

  try {
    const admin = (await import("@/lib/supabase/admin")).createAdminClient();
    const { garantirQrInstitucionalSite, buscarHistoricoDestinosQrCode } = await import(
      "@/lib/eventos-sorteio/qr-unico"
    );
    const siteQr = await garantirQrInstitucionalSite();
    if (siteQr?.id) {
      historicoSite = await buscarHistoricoDestinosQrCode(siteQr.id);
    }
    const { data: evs } = await admin
      .from("eventos")
      .select("id, nome, slug, ativo")
      .order("created_at", { ascending: false });
    eventos = (evs ?? []) as any;

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
        <h1 className="mt-2 text-2xl font-bold">QR Codes e Destinos</h1>
        <p className="text-sm text-zinc-500">
          Gerencie o QR Institucional permanente para materiais impressos e crie QR codes vinculados a eventos.
        </p>
      </div>
      {migrationHint ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm">
          {migrationHint}
        </div>
      ) : (
        <QrCodesAdminClient
          items={items}
          eventos={eventos}
          historicoSite={historicoSite}
          publicBaseUrl={publicBaseUrl}
        />
      )}
    </div>
  );
}
