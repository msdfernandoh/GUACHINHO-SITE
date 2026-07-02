import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { fetchEventoAdmin, fetchParticipantesEvento, updateParticipanteStatusAction } from "../../actions";
import { Button, Input, Label, Select } from "@/components/ui/form-primitives";
import { formatDateTime } from "@/lib/utils/format";
import { PARTICIPANTE_STATUS } from "@/lib/comercial-eventos/types";

export default async function EventoParticipantesPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) redirect("/admin");
  const { id } = await params;
  const sp = await searchParams;
  let evento;
  try {
    evento = await fetchEventoAdmin(id);
  } catch {
    notFound();
  }
  const participantes = await fetchParticipantesEvento(id, {
    status: sp.status,
    convidou: sp.convidou,
    acompanhante: sp.acompanhante,
  });

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/admin/eventos/${id}`} className="text-sm text-amber-600 hover:underline">
          ← {evento.nome}
        </Link>
        <h1 className="mt-2 text-2xl font-bold">Participantes</h1>
      </div>

      <form method="get" className="flex flex-wrap gap-3 rounded-xl border p-4 dark:border-zinc-800">
        <div>
          <Label>Status</Label>
          <Select name="status" defaultValue={sp.status ?? ""}>
            <option value="">Todos</option>
            {PARTICIPANTE_STATUS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </Select>
        </div>
        <div>
          <Label>Quem convidou</Label>
          <Input name="convidou" defaultValue={sp.convidou ?? ""} />
        </div>
        <div>
          <Label>Acompanhante</Label>
          <Select name="acompanhante" defaultValue={sp.acompanhante ?? ""}>
            <option value="">—</option>
            <option value="sim">Com acompanhante</option>
            <option value="nao">Sem acompanhante</option>
          </Select>
        </div>
        <div className="flex items-end">
          <Button type="submit">Filtrar</Button>
        </div>
      </form>

      <div className="flex justify-end">
        <a
          href={`/api/admin/eventos/${id}/participantes/export`}
          className="text-sm text-amber-600 hover:underline"
        >
          Exportar CSV
        </a>
      </div>

      <div className="overflow-x-auto rounded-xl border dark:border-zinc-800">
        <table className="min-w-[960px] w-full text-sm">
          <thead className="border-b bg-zinc-50 text-left text-xs uppercase dark:bg-zinc-900">
            <tr>
              <th className="px-2 py-2">Nome</th>
              <th className="px-2 py-2">Telefone</th>
              <th className="px-2 py-2">Acomp.</th>
              <th className="px-2 py-2">Convidou</th>
              <th className="px-2 py-2">Empresa</th>
              <th className="px-2 py-2">Status</th>
              <th className="px-2 py-2">Vagas</th>
              <th className="px-2 py-2">Criado</th>
              <th className="px-2 py-2">Check-in</th>
              <th className="px-2 py-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {participantes.map((p) => (
              <tr key={p.id} className="border-b dark:border-zinc-800">
                <td className="px-2 py-2">{p.nome_participante}</td>
                <td className="px-2 py-2">{p.telefone_participante}</td>
                <td className="px-2 py-2">{p.tem_acompanhante ? p.nome_acompanhante ?? "Sim" : "—"}</td>
                <td className="px-2 py-2">{p.nome_convidou ?? "—"}</td>
                <td className="px-2 py-2">{p.empresa_convidou ?? "—"}</td>
                <td className="px-2 py-2">{p.status}</td>
                <td className="px-2 py-2">{p.quantidade_vagas}</td>
                <td className="px-2 py-2">{formatDateTime(p.created_at, null)}</td>
                <td className="px-2 py-2">{p.checkin_at ? formatDateTime(p.checkin_at, null) : "—"}</td>
                <td className="px-2 py-2">
                  <div className="flex flex-wrap gap-1">
                    {(["presente", "cancelado", "ausente"] as const).map((st) => {
                      const act = updateParticipanteStatusAction.bind(null, p.id, id, st);
                      return (
                        <form key={st} action={act}>
                          <Button type="submit" size="sm" variant="outline">
                            {st}
                          </Button>
                        </form>
                      );
                    })}
                    {p.telefone_participante ? (
                      <a
                        href={`https://wa.me/${p.telefone_participante.replace(/\D/g, "")}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-emerald-500 underline"
                      >
                        WhatsApp
                      </a>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
