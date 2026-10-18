import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function Layout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("vendas");
  return children;
}
