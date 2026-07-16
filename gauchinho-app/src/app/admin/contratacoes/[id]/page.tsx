import { notFound } from "next/navigation";
import { fetchContratacaoDetalhe } from "../actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import { ContratacaoDetalheClient } from "./contratacao-detalhe-client";

export default async function ContratacaoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireStaffAdmin();
  const { id } = await params;
  const data = await fetchContratacaoDetalhe(id);
  if (!data) notFound();
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
    />
  );
}
