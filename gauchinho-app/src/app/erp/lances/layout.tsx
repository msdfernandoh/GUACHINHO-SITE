import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function LancesLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("lances");
  return children;
}
