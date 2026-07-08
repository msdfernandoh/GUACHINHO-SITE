import { notFound, redirect } from "next/navigation";
import { getUsuarioNegocio } from "@/lib/auth/get-usuario";
import { canManageLeads } from "@/lib/auth/permissions";
import { ListaConvidadosDetailClient } from "@/components/admin/eventos/lista-convidados-detail-client";
import { fetchEventosOptionsForListas, fetchListaConvidadosDetail } from "../actions";

export default async function ListaConvidadosDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const u = await getUsuarioNegocio();
  if (!canManageLeads(u?.perfil)) redirect("/admin");

  const { id } = await params;
  let detail;
  try {
    detail = await fetchListaConvidadosDetail(id);
  } catch {
    notFound();
  }
  if (!detail) notFound();

  const eventos = await fetchEventosOptionsForListas();

  return (
    <ListaConvidadosDetailClient lista={detail.lista} itens={detail.itens} eventos={eventos} />
  );
}
