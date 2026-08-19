import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { saveClienteAction } from "../../actions";

export default async function EditarClientePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();

  const [{ data: cliente }, { data: consultores }] = await Promise.all([
    empresaAtiva
      ? supabase.from("clientes").select("*").eq("id", id).eq("empresa_id", empresaAtiva.id).maybeSingle()
      : Promise.resolve({ data: null }),
    empresaAtiva
      ? supabase.from("participantes_comerciais").select("id,nome,nome_exibicao").eq("empresa_id", empresaAtiva.id).eq("status", "ativo").order("nome")
      : Promise.resolve({ data: [] }),
  ]);

  if (!cliente) return <div className="rounded-2xl bg-amber-50 p-6 text-amber-900">Cliente não encontrado.</div>;

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link href={`/erp/clientes/${id}`} className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700">
        <ArrowLeft size={17} /> Voltar ao cliente
      </Link>

      <section className="rounded-3xl bg-slate-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">Cadastro operacional</p>
        <h1 className="mt-2 text-3xl font-black">Editar cliente</h1>
      </section>

      <form action={saveClienteAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <input type="hidden" name="id" value={id} />

        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Dados Pessoais & Identificação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="tipo_pessoa" label="Tipo de cliente" value={cliente.tipo_pessoa} select options={[["PF", "Pessoa física (PF)"], ["PJ", "Pessoa jurídica (PJ)"]]} />
            <Field name="nome" label="Nome / Razão social" value={cliente.nome} />
            <Field name="nome_fantasia" label="Nome fantasia" value={cliente.nome_fantasia} />
            <Field name="cpf_cnpj" label="CPF / CNPJ" value={cliente.cpf_cnpj} />
            <Field name="rg" label="RG / Documento de identidade" value={cliente.rg} />
            <Field name="orgao_emissor" label="Órgão emissor" value={cliente.orgao_emissor} />
            <Field name="data_nascimento" label="Data de nascimento" type="date" value={cliente.data_nascimento} />
            <Field name="estado_civil" label="Estado civil" value={cliente.estado_civil} select options={[["", "Não informado"], ["Solteiro(a)", "Solteiro(a)"], ["Casado(a)", "Casado(a)"], ["Divorciado(a)", "Divorciado(a)"], ["Viúvo(a)", "Viúvo(a)"], ["União Estável", "União Estável"]]} />
            <Field name="profissao" label="Profissão" value={cliente.profissao} />
            <Field name="representante_nome" label="Responsável / representante" value={cliente.representante_nome} />
            <Field name="telefone" label="Telefone principal" value={cliente.telefone} />
            <Field name="telefone_secundario" label="Telefone secundário / WhatsApp" value={cliente.telefone_secundario} />
            <Field name="email" label="E-mail" value={cliente.email} />
            <Field name="participante_comercial_id" label="Consultor responsável" value={cliente.participante_comercial_id} select options={[["", "Não atribuído"], ...(consultores ?? []).map((c: any) => [c.id, c.nome_exibicao || c.nome])]} />
          </div>
        </div>

        <div className="space-y-4 border-t pt-5 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Endereço e Status</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="cep" label="CEP" value={cliente.cep} />
            <div className="sm:col-span-2">
              <Field name="endereco" label="Logradouro / Endereço" value={cliente.endereco} />
            </div>
            <Field name="numero" label="Número" value={cliente.numero} />
            <Field name="complemento" label="Complemento" value={cliente.complemento} />
            <Field name="bairro" label="Bairro" value={cliente.bairro} />
            <Field name="cidade" label="Cidade" value={cliente.cidade} />
            <Field name="uf" label="UF" value={cliente.uf} />
            <Field name="status" label="Status do cadastro" value={cliente.status} select options={[["ativo", "Ativo"], ["inativo", "Inativo"]]} />
          </div>
        </div>

        <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          Observações
          <textarea name="observacoes" defaultValue={cliente.observacoes || ""} className="min-h-24 rounded-xl border border-slate-200 p-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
        </label>

        <div className="flex justify-end gap-3 border-t pt-5 dark:border-slate-800">
          <Link href={`/erp/clientes/${id}`} className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300">
            Cancelar
          </Link>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white hover:bg-blue-700">
            <Save size={16} /> Salvar alterações
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  value,
  type = "text",
  select,
  options = [],
}: {
  name: string;
  label: string;
  value: string | null;
  type?: string;
  select?: boolean;
  options?: string[][];
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
      {label}
      {select ? (
        <select name={name} defaultValue={value || ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800">
          {options.map(([key, text]) => (
            <option key={key} value={key}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <input type={type} name={name} defaultValue={value || ""} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
      )}
    </label>
  );
}
