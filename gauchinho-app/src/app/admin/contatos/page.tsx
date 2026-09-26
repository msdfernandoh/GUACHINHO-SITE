import { listMyContactFilterOptions, listMyContacts } from "./actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import ContactsClient from "./ui";

export const dynamic = "force-dynamic";
export default async function ContactsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; empresa?: string; profissao?: string; tag?: string }>;
}) {
  await requireStaffAdmin();
  const params = await searchParams;
  const page = Number(params.page);
  const filters = {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    empresa: params.empresa,
    profissao: params.profissao,
    tag: params.tag,
  };
  const [result, filterOptions] = await Promise.all([
    listMyContacts(filters),
    listMyContactFilterOptions(),
  ]);
  return <ContactsClient key={`${result.page}:${filters.empresa ?? ""}:${filters.profissao ?? ""}:${filters.tag ?? ""}`} initialContacts={result.contacts as never[]} total={result.total} page={result.page} pageSize={result.pageSize} filters={filters} filterOptions={filterOptions} />;
}
