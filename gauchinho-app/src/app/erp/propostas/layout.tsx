import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function PropostasLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("propostas");
  return children;
}
