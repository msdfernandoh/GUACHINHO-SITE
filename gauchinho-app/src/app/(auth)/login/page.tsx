import Link from "next/link";
import { isRaconModel } from "@/lib/tenant/model-family";
import { loginAction } from "./actions";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { headers } from "next/headers";
import { isPlatformHost } from "@/lib/tenant/dominio";
import { getResolvedTenant } from "@/lib/tenant/get-resolved-empresa";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; next?: string }>;
}) {
  const sp = await searchParams;
  const platform = isPlatformHost((await headers()).get("host"));
  const tenant = platform ? null : await getResolvedTenant();
  const isRacon = isRaconModel(tenant?.siteModel);
  const nome = tenant?.branding.nome_site || "Gauchinho";
  const primary = tenant?.branding.cor_primaria || "#0099dd";
  const error = sp.error;
  const next = sp.next ?? "/admin";

  return (
    <div className="flex min-h-[calc(100vh-8rem)] flex-1 items-center justify-center px-4 pb-8">
      <div className={isRacon ? "w-full max-w-md rounded-2xl border border-sky-100 bg-white p-8 shadow-xl shadow-sky-950/10" : "w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 shadow-lg dark:border-zinc-800 dark:bg-zinc-900"}>
        <h1 className={isRacon ? "text-2xl font-bold text-slate-900" : "text-2xl font-bold text-zinc-900 dark:text-white"}>
          {platform ? "Plataforma SaaS" : `Acesso ${nome}`}
        </h1>
        <p className="mt-1 text-sm text-zinc-500">{platform ? "Acesso exclusivo Platform Superadmin" : "Entre com e-mail e senha"}</p>
        {error ? (
          <p className="mt-4 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        ) : null}
        <form action={loginAction} className="mt-6 space-y-4">
          <input type="hidden" name="next" value={next} />
          <div>
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" name="email" type="email" required autoComplete="email" />
          </div>
          <div>
            <Label htmlFor="password">Senha</Label>
            <Input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </div>
          <Button type="submit" className="w-full" style={isRacon ? { backgroundColor: primary, color: "white" } : undefined}>
            Entrar
          </Button>
        </form>
        <p className="mt-6 text-center text-sm text-zinc-500">
          <Link href="/" className={isRacon ? "font-medium hover:underline" : "text-amber-600 hover:underline dark:text-amber-500"} style={isRacon ? { color: primary } : undefined}>
            Voltar ao site
          </Link>
        </p>
      </div>
    </div>
  );
}
