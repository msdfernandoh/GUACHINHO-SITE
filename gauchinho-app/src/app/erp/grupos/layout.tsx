import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function GruposLayout({ children }: { children: React.ReactNode }) {
  await requireErpRouteAccess("grupos");
  return children;
}
