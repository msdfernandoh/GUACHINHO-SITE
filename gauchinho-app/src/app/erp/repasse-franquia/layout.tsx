import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function RepasseLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("repasse-franquia");
  return children;
}
