import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";

export default async function ErpRobosLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  await requireErpRouteAccess("robos");
  return <>{children}</>;
}
