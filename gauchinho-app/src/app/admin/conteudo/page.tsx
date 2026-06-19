import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";

const LINKS = [
  { href: "/admin/conteudo/casos", label: "Casos de sucesso", desc: "Histórias na página Depoimentos (#casos-de-sucesso)" },
  { href: "/admin/conteudo/dicas", label: "Dicas do Tchê", desc: "Artigos educativos" },
  { href: "/admin/conteudo/depoimentos", label: "Depoimentos", desc: "Página pública /depoimentos (com casos abaixo)" },
  { href: "/admin/conteudo/faq", label: "FAQ", desc: "Perguntas frequentes" },
  { href: "/admin/conteudo/parceiros", label: "Parceiros", desc: "Vitrine institucional" },
];

export default async function ConteudoAdminHubPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Conteúdo</h1>
        <p className="text-sm text-zinc-500">Prova social, FAQ, dicas e parceiros no site público</p>
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        {LINKS.map((l) => (
          <Link
            key={l.href}
            href={l.href}
            className="rounded-xl border bg-white p-5 transition hover:border-amber-500/50 dark:border-zinc-800 dark:bg-zinc-900"
          >
            <p className="font-semibold">{l.label}</p>
            <p className="mt-1 text-sm text-zinc-500">{l.desc}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
