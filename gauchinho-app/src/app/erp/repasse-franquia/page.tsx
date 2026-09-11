import { ErpRepasseFranquiaPage } from "@/components/erp/erp-operational-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page() {
  return <ErpRepasseFranquiaPage />;
}
