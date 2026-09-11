import { ErpAssembleiasPage } from "@/components/erp/erp-assembleias-page";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Page({
  searchParams = Promise.resolve({}),
}: {
  searchParams?: Promise<Record<string, string | undefined>>;
}) {
  return <ErpAssembleiasPage searchParams={searchParams} />;
}
