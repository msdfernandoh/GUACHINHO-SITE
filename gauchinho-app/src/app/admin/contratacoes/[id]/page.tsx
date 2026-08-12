import { notFound } from "next/navigation";
import { fetchContratacaoDetalhe } from "../actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { ContratacaoDetalheClient } from "./contratacao-detalhe-client";
import { createAdminClient } from "@/lib/supabase/admin";

export default async function ContratacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffAdmin();
  const { id } = await params;
  const data = await fetchContratacaoDetalhe(id);
  if (!data) notFound();
  const admin = createAdminClient();
  const { data: participantes } = await admin
    .from("participantes_comerciais")
    .select("id,nome,status,participante_tipos(tipo_codigo)")
    .eq("empresa_id", data.contratacao.empresa_id ?? "")
    .eq("status", "ATIVO")
    .order("nome");
  return (
    <ContratacaoDetalheClient
      contratacao={data.contratacao}
      documentos={data.documentos}
      publicUrl={data.publicUrl}
      resumoFinanceiro={data.resumoFinanceiro}
      gruposLinhas={data.gruposLinhas}
      statusLabelText={data.statusLabel}
      podeAcessarDocumentos={data.podeAcessarDocumentos}
      mensagemSemPermissaoDocumentos={data.mensagemSemPermissaoDocumentos}
      participantes={(participantes ?? []).map((p) => ({
        id: p.id as string,
        nome: p.nome as string,
        tipos: ((p.participante_tipos ?? []) as Array<{ tipo_codigo: string }>).map((t) => t.tipo_codigo),
      }))}
    />
  );
}
