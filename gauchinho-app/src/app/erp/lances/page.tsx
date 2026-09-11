import { ErpLancesPage } from "@/components/erp/erp-operational-pages";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  return <ErpLancesPage searchParams={searchParams} />;
}
