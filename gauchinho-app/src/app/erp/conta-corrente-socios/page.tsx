import { redirect } from "next/navigation";

// A conta-corrente legada foi consolidada no painel de fechamento.
// Mantém URLs já salvas funcionando sem expor um segundo cálculo societário.
export default function ContaCorrenteSociosPage() {
  redirect("/erp/fechamento-socios");
}
