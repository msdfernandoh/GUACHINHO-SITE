import Link from "next/link";
import { CartaNovoClient } from "@/components/admin/carta-novo-client";

export default function NovaCartaPage() {
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/admin/cartas-contempladas" className="text-sm text-amber-600 hover:underline">
        ← Cartas contempladas
      </Link>
      <h1 className="text-2xl font-bold">Nova carta</h1>
      <CartaNovoClient />
    </div>
  );
}
