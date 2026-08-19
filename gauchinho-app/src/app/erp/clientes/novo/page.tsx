import Link from "next/link";
import { ArrowLeft, Save } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getCurrentTenantContext } from "@/lib/tenant/context";
import { saveClienteAction } from "../actions";

export default async function NovoClientePage() {
  const { empresaAtiva } = await getCurrentTenantContext();
  const supabase = await createClient();
  const { data: consultores } = empresaAtiva
    ? await supabase.from("participantes_comerciais").select("id,nome,nome_exibicao").eq("empresa_id", empresaAtiva.id).eq("status", "ativo").order("nome")
    : { data: [] };

  return (
    <main className="mx-auto max-w-4xl space-y-6 pb-12">
      <Link href="/erp/clientes" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-blue-700">
        <ArrowLeft size={17} /> Voltar para clientes
      </Link>

      <section className="rounded-3xl bg-slate-950 p-7 text-white">
        <p className="text-xs font-bold uppercase tracking-widest text-cyan-300">ERP operacional</p>
        <h1 className="mt-2 text-3xl font-black">Novo cliente</h1>
        <p className="mt-2 text-xs text-slate-300">
          Crie um cadastro independente no ERP. CPF/CNPJ evita duplicidade dentro desta empresa.
        </p>
      </section>

      <form action={saveClienteAction} className="space-y-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="space-y-4">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Dados Pessoais & Identificação</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="tipo_pessoa" label="Tipo de cliente" required select options={[["PF", "Pessoa física (PF)"], ["PJ", "Pessoa jurídica (PJ)"]]} />
            <Field name="nome" label="Nome / Razão social" required />
            <Field name="nome_fantasia" label="Nome fantasia" />
            <Field name="cpf_cnpj" label="CPF / CNPJ" />
            <Field name="rg" label="RG / Documento de identidade" />
            <Field name="orgao_emissor" label="Órgão emissor" />
            <Field name="data_nascimento" label="Data de nascimento" type="date" />
            <Field name="estado_civil" label="Estado civil" select options={[["", "Não informado"], ["Solteiro(a)", "Solteiro(a)"], ["Casado(a)", "Casado(a)"], ["Divorciado(a)", "Divorciado(a)"], ["Viúvo(a)", "Viúvo(a)"], ["União Estável", "União Estável"]]} />
            <Field name="profissao" label="Profissão" />
            <Field name="representante_nome" label="Responsável / representante" />
            <Field name="telefone" label="Telefone principal" />
            <Field name="telefone_secundario" label="Telefone secundário / WhatsApp" />
            <Field name="email" label="E-mail" />
            <Field name="participante_comercial_id" label="Consultor responsável" select options={[["", "Não atribuído"], ...(consultores ?? []).map((c: any) => [c.id, c.nome_exibicao || c.nome])]} />
          </div>
        </div>

        <div className="space-y-4 border-t pt-5 dark:border-slate-800">
          <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-wider">Endereço</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field name="cep" label="CEP" />
            <div className="sm:col-span-2">
              <Field name="endereco" label="Logradouro / Endereço" />
            </div>
            <Field name="numero" label="Número" />
            <Field name="complemento" label="Complemento" />
            <Field name="bairro" label="Bairro" />
            <Field name="cidade" label="Cidade" />
            <Field name="uf" label="UF" />
          </div>
        </div>

        <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
          Observações
          <textarea name="observacoes" className="min-h-24 rounded-xl border border-slate-200 p-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
        </label>

        <div className="flex justify-end gap-3 border-t pt-5 dark:border-slate-800">
          <Link href="/erp/clientes" className="rounded-xl px-4 py-2.5 text-xs font-bold text-slate-600 hover:bg-slate-100 dark:text-slate-300">
            Cancelar
          </Link>
          <button className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-blue-600 px-5 text-xs font-black text-white shadow-lg shadow-blue-200 hover:bg-blue-700 dark:shadow-none">
            <Save size={16} /> Salvar cliente
          </button>
        </div>
      </form>
    </main>
  );
}

function Field({
  name,
  label,
  required,
  type = "text",
  select,
  options = [],
}: {
  name: string;
  label: string;
  required?: boolean;
  type?: string;
  select?: boolean;
  options?: string[][];
}) {
  return (
    <label className="grid gap-1.5 text-xs font-bold text-slate-700 dark:text-slate-300">
      {label}
      {select ? (
        <select name={name} required={required} defaultValue={name === "tipo_pessoa" ? "PF" : ""} className="h-10 rounded-xl border border-slate-200 bg-white px-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800">
          {options.map(([value, text]) => (
            <option key={value} value={value}>
              {text}
            </option>
          ))}
        </select>
      ) : (
        <input type={type} name={name} required={required} className="h-10 rounded-xl border border-slate-200 px-3 text-xs font-medium outline-none focus:border-blue-500 dark:border-slate-700 dark:bg-slate-800" />
      )}
    </label>
  );
}
