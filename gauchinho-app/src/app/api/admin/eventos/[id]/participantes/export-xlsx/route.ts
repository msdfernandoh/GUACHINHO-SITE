import { NextResponse } from "next/server";
import writeXlsx from "write-excel-file/node";
import { rejectIfTenantBlocksLegacyOperationalApi } from "@/lib/tenant/assert-legacy-operational-api";
import { createClient } from "@/lib/supabase/server";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import {
  fetchParticipantesEventoEnriquecidos,
  type EnrichedEventoParticipante,
  type ParticipantesFiltros,
} from "@/lib/comercial-eventos/participantes-enriquecidos";
import { formatDateTime } from "@/lib/utils/format";

export async function GET(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const __tenantBlocked = await rejectIfTenantBlocksLegacyOperationalApi(request);
  if (__tenantBlocked) return __tenantBlocked;

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
  const url = new URL(request.url);

  // Filtros passados via query string
  const exportAll = url.searchParams.get("todos") === "1" || url.searchParams.get("todos") === "true";

  const filtros: ParticipantesFiltros | undefined = exportAll
    ? undefined
    : {
        status: url.searchParams.get("status") || undefined,
        checkin: (url.searchParams.get("checkin") as any) || undefined,
        veiculo: url.searchParams.get("veiculo") || undefined,
        moradia: url.searchParams.get("moradia") || undefined,
        investimento: url.searchParams.get("investimento") || undefined,
        convidou: url.searchParams.get("convidou") || undefined,
        busca: url.searchParams.get("busca") || undefined,
        acompanhante: url.searchParams.get("acompanhante") || undefined,
      };

  const { data: ev } = await supabase.from("eventos").select("nome, slug").eq("id", id).maybeSingle();
  const slugEvento = ev?.slug || id.slice(0, 8);

  const { participantes } = await fetchParticipantesEventoEnriquecidos(id, filtros);

  // Esquema de colunas para write-excel-file
  const columns = [
    {
      header: "Nome",
      width: 26,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.nome_participante }),
    },
    {
      header: "Telefone",
      width: 18,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.telefone_participante }),
    },
    {
      header: "Empresa",
      width: 22,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.empresa_convidou || "—" }),
    },
    {
      header: "Quem convidou",
      width: 22,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.nome_convidou || "—" }),
    },
    {
      header: "Acompanhante",
      width: 18,
      cell: (p: EnrichedEventoParticipante) => ({
        type: String,
        value: p.tem_acompanhante ? p.nome_acompanhante || "Sim" : "Não",
      }),
    },
    {
      header: "Status",
      width: 15,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.status }),
    },
    {
      header: "Vagas",
      width: 10,
      cell: (p: EnrichedEventoParticipante) => ({ type: Number, value: p.quantidade_vagas }),
    },
    {
      header: "Data do cadastro",
      width: 20,
      cell: (p: EnrichedEventoParticipante) => ({
        type: String,
        value: formatDateTime(p.created_at, null),
      }),
    },
    {
      header: "Data/hora do check-in",
      width: 22,
      cell: (p: EnrichedEventoParticipante) => ({
        type: String,
        value: p.checkin_at ? formatDateTime(p.checkin_at, null) : "—",
      }),
    },
    {
      header: "Veículo",
      width: 20,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.veiculo_label }),
    },
    {
      header: "Moradia",
      width: 24,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.moradia_label }),
    },
    {
      header: "Faixa de investimento",
      width: 26,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.investimento_label }),
    },
    {
      header: "Número da sorte",
      width: 18,
      cell: (p: EnrichedEventoParticipante) => ({ type: String, value: p.codigo_sorteio || "—" }),
    },
  ];

  const file = writeXlsx(participantes, {
    columns,
  });

  const buffer = await (file as any).toBuffer();
  const dataHoje = new Date().toISOString().slice(0, 10);
  const filename = `participantes-${slugEvento}-${dataHoje}.xlsx`;

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
