"use client";

import { useState } from "react";
import { Input, Label, Textarea } from "@/components/ui/form-primitives";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import type { EventoRow } from "@/lib/comercial-eventos/types";
import { EventoImageField } from "./evento-image-field";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toISOString().slice(0, 16);
}

type Props = {
  evento?: EventoRow;
  action: (formData: FormData) => Promise<void>;
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}


export function EventoAdminForm({ evento, action }: Props) {
  const dataLocal = toDatetimeLocalValue(evento?.data_evento);

  const [nome, setNome] = useState(evento?.nome ?? "");
  const [slug, setSlug] = useState(evento?.slug ?? "");
  const [inscricaoTipo, setInscricaoTipo] = useState<"interno" | "externo">(
    evento?.inscricao_tipo === "externo" ? "externo" : "interno",
  );
  const [formError, setFormError] = useState<string | null>(null);

  const slugHint = slug.trim() || nome.trim() || "evento";

  async function onSubmit(formData: FormData) {
    setFormError(null);
    try {
      await action(formData);
    } catch (e) {
      const digest = typeof e === "object" && e && "digest" in e ? String((e as { digest?: string }).digest) : "";
      if (digest.startsWith("NEXT_REDIRECT")) throw e;
      const msg = e instanceof Error ? e.message : "Não foi possível salvar o evento.";
      setFormError(msg);
    }
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-6">
      {formError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {formError}
        </div>
      ) : null}

      <FormSection title="Informações básicas">
        <div>
          <Label>Nome *</Label>
          <Input
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
        </div>
        <div>
          <Label>Slug</Label>
          <Input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="gerado-do-nome"
          />
        </div>
        <div>
          <Label>Data do evento</Label>
          <Input name="data_evento" type="datetime-local" defaultValue={dataLocal} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Local</Label>
            <Input name="local" defaultValue={evento?.local ?? ""} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input name="cidade" defaultValue={evento?.cidade ?? ""} />
          </div>
        </div>
        <div>
          <Label>Endereço</Label>
          <Input name="endereco" defaultValue={evento?.endereco ?? ""} />
        </div>
        <div>
          <Label>Estado (UF)</Label>
          <Input name="estado" maxLength={2} defaultValue={evento?.estado ?? ""} />
        </div>
      </FormSection>

      <FormSection title="Textos do evento">
        <div>
          <Label>Descrição curta</Label>
          <Input name="descricao_curta" defaultValue={evento?.descricao_curta ?? ""} />
        </div>
        <div>
          <Label>Descrição</Label>
          <Textarea name="descricao" rows={5} defaultValue={evento?.descricao ?? ""} />
        </div>
        <div>
          <Label>Mensagem de confirmação</Label>
          <Textarea name="mensagem_confirmacao" rows={2} defaultValue={evento?.mensagem_confirmacao ?? ""} />
        </div>
        <div>
          <Label>Observações internas</Label>
          <Textarea name="observacoes_internas" rows={2} defaultValue={evento?.observacoes_internas ?? ""} />
        </div>
      </FormSection>

      <FormSection title="Imagens">
        <EventoImageField
          kind="capa"
          name="imagem_capa_url"
          label="Imagem de capa"
          defaultUrl={evento?.imagem_capa_url}
          slugHint={slugHint}
        />
        <EventoImageField
          kind="banner"
          name="banner_url"
          label="Banner do evento"
          defaultUrl={evento?.banner_url}
          slugHint={slugHint}
        />
      </FormSection>

      <FormSection title="Inscrição">
        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-zinc-800 dark:text-zinc-200">
            Onde será feita a inscrição?
          </legend>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="inscricao_tipo"
              value="interno"
              checked={inscricaoTipo === "interno"}
              onChange={() => setInscricaoTipo("interno")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Pela plataforma Gauchinho</span>
              <span className="mt-0.5 block text-xs text-zinc-500">Formulário de inscrição neste site.</span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-2 text-sm">
            <input
              type="radio"
              name="inscricao_tipo"
              value="externo"
              checked={inscricaoTipo === "externo"}
              onChange={() => setInscricaoTipo("externo")}
              className="mt-1"
            />
            <span>
              <span className="font-medium">Em site externo / parceiro</span>
              <span className="mt-0.5 block text-xs text-zinc-500">Redireciona para o link do parceiro.</span>
            </span>
          </label>
        </fieldset>
        {inscricaoTipo === "externo" ? (
          <div>
            <Label>URL externa de inscrição *</Label>
            <Input
              name="inscricao_url_externa"
              type="url"
              placeholder="https://…"
              defaultValue={evento?.inscricao_url_externa ?? ""}
              required
            />
          </div>
        ) : (
          <input type="hidden" name="inscricao_url_externa" value="" />
        )}
        <div>
          <Label>Limite de participantes (vagas)</Label>
          <Input
            name="limite_participantes"
            type="number"
            min={1}
            defaultValue={evento?.limite_participantes ?? ""}
          />
        </div>
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="permitir_acompanhante" defaultChecked={!!evento?.permitir_acompanhante} />{" "}
            Permitir acompanhante
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="exigir_convidou" defaultChecked={!!evento?.exigir_convidou} /> Exigir quem
            convidou
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="mostrar_vagas" defaultChecked={evento?.mostrar_vagas !== false} /> Mostrar
            vagas
          </label>
        </div>
      </FormSection>

      <FormSection title="Publicação">
        <div className="flex flex-wrap gap-4 text-sm">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="ativo" defaultChecked={evento?.ativo !== false} /> Ativo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="publicado" defaultChecked={!!evento?.publicado} /> Publicado
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="somente_por_link" defaultChecked={evento?.somente_por_link !== false} />{" "}
            Somente por link
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="evento_destaque" defaultChecked={!!evento?.evento_destaque} /> Destaque
            (Especialista)
          </label>
        </div>
      </FormSection>

      <AdminFormSubmitButton
        creating={!evento}
        label="Salvar evento"
        createLabel="Criar evento"
        className="min-h-11 min-w-[10rem]"
      />
    </form>
  );
}
