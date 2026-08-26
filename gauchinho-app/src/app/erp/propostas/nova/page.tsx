import Link from "next/link";
import { ArrowLeft, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { PropostaForm } from "@/components/admin/proposta-form";

export default async function ErpNovaPropostaPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | undefined>>;
}) {
  const { cliente_id } = await searchParams;
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();

  let initial: Record<string, unknown> = {};
  let clienteNome: string | null = null;

  if (cliente_id && empresaAtiva) {
    const { data: cliente } = await supabase
      .from("clientes")
      .select("id, nome, telefone, email, cidade, uf, cpf_cnpj")
      .eq("id", cliente_id)
      .eq("empresa_id", empresaAtiva.id)
      .maybeSingle();

    if (cliente) {
      clienteNome = cliente.nome;
      initial = {
        cliente_id: cliente.id,
        nome_cliente: cliente.nome,
        whatsapp_cliente: cliente.telefone || "",
        email_cliente: cliente.email || "",
        cidade_cliente: cliente.cidade ? `${cliente.cidade}${cliente.uf ? `/${cliente.uf}` : ""}` : "",
      };
    }
  }

  return (
    <div className="mx-auto max-w-3xl space-y-6 pb-12">
      <div className="flex items-center justify-between">
        <Link
          href={cliente_id ? `/erp/clientes/${cliente_id}` : "/erp/propostas"}
          className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700"
        >
          <ArrowLeft size={16} />
          {cliente_id ? "Voltar ao cliente" : "Voltar a propostas"}
        </Link>
      </div>

      <header className="rounded-3xl bg-gradient-to-br from-slate-900 to-slate-800 p-6 text-white shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-400">
          Comercial · ERP
        </p>
        <h1 className="mt-1 text-2xl font-black">
          {clienteNome ? `Nova Cota para ${clienteNome}` : "Nova Proposta / Cota"}
        </h1>
        <p className="mt-1 text-xs text-slate-300">
          {clienteNome
            ? "Os dados cadastrais do cliente foram pré-selecionados para agilizar a emissão."
            : "Preencha os dados do cliente e condições comerciais para emitir a proposta."}
        </p>
      </header>

      {clienteNome && (
        <div className="flex items-center gap-3 rounded-2xl border border-blue-200 bg-blue-50/70 p-4 text-xs dark:border-blue-900/40 dark:bg-blue-950/30">
          <span className="grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-blue-600 text-white">
            <UserRound size={16} />
          </span>
          <div>
            <p className="font-bold text-blue-900 dark:text-blue-200">
              Cliente vinculado: {clienteNome}
            </p>
            <p className="text-slate-600 dark:text-slate-400">
              Esta proposta/cota será vinculada diretamente ao histórico deste cliente no ERP.
            </p>
          </div>
        </div>
      )}

      <PropostaForm initial={initial} origem="erp" />
    </div>
  );
}
