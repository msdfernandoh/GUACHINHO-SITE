import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function ContratacoesLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("contratacoes");
  return children;
}
