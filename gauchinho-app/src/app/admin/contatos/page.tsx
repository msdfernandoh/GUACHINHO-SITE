import { listMyContacts } from "./actions";
import { requireStaffAdmin } from "@/lib/auth/require-staff-admin";
import ContactsClient from "./ui";

export const dynamic = "force-dynamic";
export default async function ContactsPage() {
  await requireStaffAdmin();
  const contacts = await listMyContacts();
  return <ContactsClient initialContacts={contacts as never[]} />;
}
