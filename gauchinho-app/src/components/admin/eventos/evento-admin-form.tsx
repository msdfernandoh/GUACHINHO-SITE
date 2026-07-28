"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { isNextRouterError } from "next/dist/client/components/is-next-router-error";
import { Input, Label, Textarea } from "@/components/ui/form-primitives";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import type { EventoRow } from "@/lib/comercial-eventos/types";
import type { QrCodeUnicoRow, QrCodeVinculoRow } from "@/lib/eventos-sorteio/qr-unico";
import { EventoImageField } from "./evento-image-field";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ActionResult = { ok: true } | { ok: false; error: string } | void;

type Props = {
  evento?: EventoRow;
  action: (formData: FormData) => Promise<ActionResult>;
  usuariosStaff?: { id: string; nome: string }[];
  leadsUsuariosIds?: string[];
  qrDisponiveis?: QrCodeUnicoRow[];
  qrVinculo?: (QrCodeVinculoRow & { qr: QrCodeUnicoRow }) | null;
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

function shouldRethrowNavigation(error: unknown): boolean {
  if (isRedirectError(error) || isNextRouterError(error)) return true;
  if (typeof error === "object" && error && "digest" in error) {
    const digest = String((error as { digest?: string }).digest ?? "");
    if (digest.startsWith("NEXT_REDIRECT") || digest.startsWith("NEXT_HTTP_ERROR_FALLBACK")) return true;
  }
  return error instanceof Error && error.message === "NEXT_REDIRECT";
}

export function EventoAdminForm({
  evento,
  action,
  usuariosStaff = [],
  leadsUsuariosIds = [],
  qrDisponiveis = [],
  qrVinculo = null,
}: Props) {
  const router = useRouter();
  const dataLocal = toDatetimeLocalValue(evento?.data_evento);

  const [nome, setNome] = useState(evento?.nome ?? "");
  const [slug, setSlug] = useState(evento?.slug ?? "");
  const [inscricaoTipo, setInscricaoTipo] = useState<"interno" | "externo">(
    evento?.inscricao_tipo === "externo" ? "externo" : "interno",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);
  // Novo evento: por padrão restringe aos consultores marcados.
  // Edição: preserva o valor salvo no banco.
  const [leadsAcessoTodos, setLeadsAcessoTodos] = useState(
    evento ? evento.leads_acesso_todos !== false : false,
  );
  const [usarQrUnico, setUsarQrUnico] = useState(Boolean(qrVinculo?.ativo));

  // Após salvar + router.refresh(), alinha o checkbox com o valor persistido no banco
  useEffect(() => {
    if (evento) setLeadsAcessoTodos(evento.leads_acesso_todos !== false);
  }, [evento?.id, evento?.leads_acesso_todos]);

  useEffect(() => {
    setUsarQrUnico(Boolean(qrVinculo?.ativo));
  }, [qrVinculo?.id, qrVinculo?.ativo]);

  const slugHint = slug.trim() || nome.trim() || "evento";
  const isEdit = Boolean(evento?.id);

  async function onSubmit(formData: FormData) {
    setFormError(null);
    setFormOk(false);
    try {
      const result = await action(formData);
      if (result && typeof result === "object" && "ok" in result) {
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        setFormOk(true);
        router.refresh();
        return;
      }
      // create com redirect: se chegou aqui sem throw, também atualiza
      setFormOk(true);
      router.refresh();
    } catch (e) {
      if (shouldRethrowNavigation(e)) throw e;
      const msg = e instanceof Error ? e.message : "Não foi possível salvar o evento.";
      // Mensagem genérica de produção do Next — costuma mascarar falha de re-render após redirect
      if (/Server Components render/i.test(msg)) {
        setFormError(
          "Falha ao atualizar a página após salvar. Recarregue e confira se o nome foi gravado. Se não gravou, tente de novo.",
        );
        return;
      }
      setFormError(msg);
    }
  }

  return (
    <form action={onSubmit} className="max-w-2xl space-y-6">
      {evento?.id ? <input type="hidden" name="evento_id" value={evento.id} /> : null}

      {formError ? (
        <div className="rounded-lg border border-red-500/40 bg-red-500/10 px-4 py-3 text-sm text-red-700 dark:text-red-300">
          {formError}
        </div>
      ) : null}
      {formOk ? (
        <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-800 dark:text-emerald-200">
          Evento salvo com sucesso.
        </div>
      ) : null}

      <FormSection title="Informações básicas">
        <div>
          <Label>Nome do evento *</Label>
          <Input
            name="nome"
            value={nome}
            onChange={(e) => setNome(e.target.value)}
            required
          />
          <p className="mt-1 text-xs text-zinc-500">
            Pode alterar o nome quando quiser — isso não muda o link nem o QR Code.
          </p>
        </div>
        <div>
          <Label>Link permanente (slug)</Label>
          <Input
            name="slug"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={isEdit ? "mantem-o-link-atual" : "ex-sinop"}
          />
          <p className="mt-1 text-xs text-zinc-500">
            URL pública: /eventos/{slugHint || "…"}. Independente do nome. Só altere se quiser mudar o
            link do evento.
          </p>
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

      <FormSection title="QR Code único">
        <p className="text-sm text-zinc-500">
          Cadastre QR Codes em{" "}
          <Link href="/admin/configuracoes/qr-codes" className="font-medium text-amber-600 hover:underline">
            Configurações → QR Codes únicos
          </Link>
          . O link impresso (/qr/slug) continua o mesmo mesmo se você mudar o nome do evento.
        </p>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            name="usar_qr_unico"
            value="on"
            checked={usarQrUnico}
            onChange={(e) => setUsarQrUnico(e.target.checked)}
          />
          Usar QR Code único neste evento
        </label>
        {usarQrUnico ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Selecionar QR Code cadastrado</Label>
              <select
                name="qr_code_unico_id"
                defaultValue={qrVinculo?.qr_code_id ?? ""}
                required={usarQrUnico}
                className="mt-1 w-full rounded-lg border px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-950"
              >
                <option value="">Selecione…</option>
                {qrDisponiveis.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.nome} (/qr/{q.slug})
                  </option>
                ))}
              </select>
              {qrDisponiveis.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Nenhum QR disponível.{" "}
                  <Link href="/admin/configuracoes/qr-codes" className="underline">
                    Cadastre um QR Code único
                  </Link>{" "}
                  ou desative o vínculo ativo em outro evento.
                </p>
              ) : null}
            </div>
            <div>
              <Label>Início do período de uso</Label>
              <Input
                name="qr_periodo_inicio"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(qrVinculo?.periodo_inicio)}
                required={usarQrUnico}
              />
            </div>
            <div>
              <Label>Fim do período de uso</Label>
              <Input
                name="qr_periodo_fim"
                type="datetime-local"
                defaultValue={toDatetimeLocalValue(qrVinculo?.periodo_fim)}
                required={usarQrUnico}
              />
            </div>
          </div>
        ) : null}
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

      <FormSection title="Consultores com acesso aos leads">
        <p className="text-sm text-zinc-500">
          Selecione o(s) consultor(es) responsável(is) que poderão ver os leads deste evento e do
          sorteio. Com acesso restrito ao evento, usuários com visão completa só enxergam esses leads
          se estiverem marcados aqui. Usuários com &quot;só leads próprios&quot; continuam vendo
          apenas os leads em que forem o consultor responsável.
        </p>
        {/* Valor explícito: checkbox controlado sem name evita FormData ambíguo */}
        <input type="hidden" name="leads_acesso_todos" value={leadsAcessoTodos ? "on" : "off"} />
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={leadsAcessoTodos}
            onChange={(e) => setLeadsAcessoTodos(e.target.checked)}
          />
          Todos os usuários com visão completa podem ver leads deste evento
        </label>
        {!leadsAcessoTodos ? (
          <>
            <p className="text-xs text-zinc-500">
              Marque pelo menos um consultor responsável pelos leads do evento/sorteio:
            </p>
            <div className="grid max-h-48 gap-2 overflow-y-auto sm:grid-cols-2">
              {usuariosStaff.map((u) => (
                <label key={u.id} className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    name="leads_usuario_id"
                    value={u.id}
                    defaultChecked={leadsUsuariosIds.includes(u.id)}
                  />
                  {u.nome}
                </label>
              ))}
            </div>
            {usuariosStaff.length === 0 ? (
              <p className="text-xs text-amber-700 dark:text-amber-400">
                Nenhum usuário staff ativo. Cadastre consultores em Usuários.
              </p>
            ) : null}
          </>
        ) : null}
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
