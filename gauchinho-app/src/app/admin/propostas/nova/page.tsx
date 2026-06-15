import Link from "next/link";
import { PropostaForm } from "@/components/admin/proposta-form";

export default function NovaPropostaPage() {
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href="/admin/propostas" className="text-sm text-amber-600 hover:underline">
        ← Propostas
      </Link>
      <h1 className="text-2xl font-bold">Nova proposta</h1>
      <PropostaForm />
    </div>
  );
}
