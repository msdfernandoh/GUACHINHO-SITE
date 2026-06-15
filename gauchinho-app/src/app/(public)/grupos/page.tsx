import { fetchPublicGruposRows } from "@/app/admin/grupos/actions";
import { GruposPublicClient } from "@/components/public/grupos-public-client";

export default async function GruposPublicPage() {
  const rows = await fetchPublicGruposRows();
  return <GruposPublicClient rows={rows} />;
}
