import type { Administradora } from "@/lib/administradoras/types";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import { Input, Label, Select, Textarea } from "@/components/ui/form-primitives";

type Props = {
  action: (formData: FormData) => void | Promise<void>;
  administradora?: Administradora;
};

export function AdministradoraForm({ action, administradora }: Props) {
  const isEdit = Boolean(administradora);

  return (
    <form
      action={action}
      className="max-w-2xl space-y-4 rounded-xl border bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
    >
      <p className="text-sm text-zinc-500">
        Catálogo <strong className="font-medium text-zinc-700 dark:text-zinc-300">global</strong> de
        administradoras da plataforma. Empresas/franqueadas (ex.: Gauchinho) são gerenciadas em
        Empresas (SaaS) — concessões na E4.
      </p>

      <div>
        <Label>Nome *</Label>
        <Input name="nome" defaultValue={administradora?.nome ?? ""} required />
      </div>
      <div>
        <Label>Nome fantasia</Label>
        <Input name="nome_fantasia" defaultValue={administradora?.nome_fantasia ?? ""} />
      </div>
      <div>
        <Label>Razão social</Label>
        <Input name="razao_social" defaultValue={administradora?.razao_social ?? ""} />
      </div>
      <div>
        <Label>Slug * (único global)</Label>
        <Input
          name="slug"
          defaultValue={administradora?.slug ?? ""}
          placeholder={isEdit ? undefined : "auto a partir do nome se vazio"}
        />
        {isEdit ? (
          <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
            Alterar o slug é permitido e auditado; considere impacto em referências futuras.
          </p>
        ) : null}
      </div>
      <div>
        <Label>CNPJ (opcional)</Label>
        <Input name="cnpj" defaultValue={administradora?.cnpj ?? ""} placeholder="somente se conhecido" />
      </div>
      <div>
        <Label>Status</Label>
        <Select name="status" defaultValue={administradora?.status ?? "ATIVA"}>
          <option value="ATIVA">ATIVA</option>
          <option value="INATIVA">INATIVA</option>
        </Select>
      </div>
      <div>
        <Label>Logo URL</Label>
        <Input name="logo_url" defaultValue={administradora?.logo_url ?? ""} placeholder="https://..." />
      </div>
      <div>
        <Label>Site URL</Label>
        <Input name="site_url" defaultValue={administradora?.site_url ?? ""} placeholder="https://..." />
      </div>
      <div>
        <Label>Capabilities / integração (JSON não sensível)</Label>
        <Textarea
          name="recursos_integracao_json"
          rows={3}
          defaultValue={JSON.stringify(administradora?.recursos_integracao ?? {}, null, 2)}
          placeholder="{}"
        />
        <p className="mt-1 text-xs text-zinc-500">
          Não informe API keys, tokens ou senhas. Credenciais ficam no vínculo empresa ×
          administradora (futuro).
        </p>
      </div>

      <AdminFormSubmitButton>{isEdit ? "Salvar" : "Criar administradora"}</AdminFormSubmitButton>
    </form>
  );
}
