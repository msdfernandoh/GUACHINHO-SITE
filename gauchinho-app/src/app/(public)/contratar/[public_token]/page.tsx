import { redirect } from "next/navigation";

export default async function ContratarRedirectPage({
  params,
}: {
  params: Promise<{ public_token: string }>;
}) {
  const { public_token } = await params;
  redirect(`/proposta/${public_token}`);
}
