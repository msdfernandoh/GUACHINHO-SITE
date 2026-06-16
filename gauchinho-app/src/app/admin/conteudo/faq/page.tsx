import Link from "next/link";
import { redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageConteudo } from "@/lib/auth/permissions";
import { fetchAdminFaq } from "../actions";
import { Button } from "@/components/ui/form-primitives";
import { FaqInstitucionalSeedButton } from "@/components/admin/conteudo/faq-seed-button";

export default async function AdminFaqPage() {
  const u = await getUsuarioNegocio();
  if (!canManageConteudo(u?.perfil)) redirect("/admin");
  const list = await fetchAdminFaq();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/conteudo" className="text-sm text-amber-600 hover:underline">
            ← Conteúdo
          </Link>
          <h1 className="text-2xl font-bold">FAQ</h1>
        </div>
        <Link href="/admin/conteudo/faq/novo">
          <Button>Nova pergunta</Button>
        </Link>
      </div>
      <FaqInstitucionalSeedButton />
      <p className="text-xs text-zinc-500">
        Respostas genéricas e seguras. Em produção, use variável ALLOW_FAQ_SEED=1 se necessário.
      </p>
      <table className="min-w-full rounded-xl border text-sm dark:border-zinc-800">
        <thead className="bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-800/50">
          <tr>
            <th className="px-3 py-2">Pergunta</th>
            <th className="px-3 py-2">Categoria</th>
            <th className="px-3 py-2">Publicado</th>
            <th className="px-3 py-2" />
          </tr>
        </thead>
        <tbody>
          {list.map((r) => (
            <tr key={r.id} className="border-t dark:border-zinc-800">
              <td className="max-w-md truncate px-3 py-2">{r.pergunta}</td>
              <td className="px-3 py-2">{r.categoria ?? "—"}</td>
              <td className="px-3 py-2">{r.publicado ? "Sim" : "Não"}</td>
              <td className="px-3 py-2">
                <Link href={`/admin/conteudo/faq/${r.id}`} className="text-amber-600 hover:underline">
                  Editar
                </Link>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
