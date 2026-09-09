import Link from "next/link";
import { isRaconModel } from "@/lib/tenant/model-family";
import { headers } from "next/headers";
import { isPlatformHost } from "@/lib/tenant/dominio";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";
import { EsqueciSenhaForm } from "./esqueci-senha-form";

export default async function EsqueciSenhaPage() {
  const platform = isPlatformHost((await headers()).get("host"));
  const tenant = platform ? null : await getResolvedTenant();
  const isRacon = isRaconModel(tenant?.siteModel);
  const nome = tenant?.branding.nome_site || "Gauchinho";
  const primary = tenant?.branding.cor_primaria || "#0099dd";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 pb-8">
      <div
        className={
          isRacon
            ? "w-full max-w-md rounded-2xl border border-sky-100 bg-white p-8 shadow-xl shadow-sky-950/10"
            : "w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"
        }
      >
        <h1
          className={
            isRacon
              ? "text-2xl font-bold text-slate-900"
              : "text-2xl font-bold text-zinc-900 dark:text-white"
          }
        >
          Recuperar Senha
        </h1>
        <p className="mt-1 text-sm text-zinc-500">
          {platform
            ? "Recuperação de acesso à Plataforma SaaS"
            : `Recuperação de acesso — ${nome}`}
        </p>

        <EsqueciSenhaForm isRacon={isRacon} primary={primary} />

        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link
            href="/login"
            className={
              isRacon
                ? "font-medium hover:underline"
                : "text-amber-600 hover:underline dark:text-amber-500"
            }
            style={isRacon ? { color: primary } : undefined}
          >
            Lembrou da senha? Entrar
          </Link>
        </p>
      </div>
    </div>
  );
}
