import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function LeadsLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("leads");
  return children;
}
