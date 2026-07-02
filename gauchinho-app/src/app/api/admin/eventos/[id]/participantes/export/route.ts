import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { fetchParticipantesEvento } from "@/app/admin/eventos/actions";

function csvEscape(v: string) {
  if (/[",\n]/.test(v)) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

export async function GET(_request: Request, ctx: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Não autenticado" }, { status: 401 });

  const { id } = await ctx.params;
  const rows = await fetchParticipantesEvento(id);
  const header = [
    "nome",
    "telefone",
    "acompanhante",
    "convidou",
    "empresa",
    "status",
    "vagas",
    "criado_em",
    "checkin",
    "observacao",
  ];
  const lines = [
    header.join(","),
    ...rows.map((p) =>
      [
        p.nome_participante,
        p.telefone_participante,
        p.tem_acompanhante ? p.nome_acompanhante ?? "sim" : "",
        p.nome_convidou ?? "",
        p.empresa_convidou ?? "",
        p.status,
        String(p.quantidade_vagas),
        p.created_at,
        p.checkin_at ?? "",
        p.observacao ?? "",
      ]
        .map((c) => csvEscape(String(c)))
        .join(","),
    ),
  ];
  return new NextResponse(lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="participantes-${id}.csv"`,
    },
  });
}
