"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Input, Label, Textarea } from "@/components/ui/form-primitives";
import { AdminFormSubmitButton } from "@/components/admin/admin-form-submit-button";
import type { EventoRow } from "@/lib/comercial-eventos/types";
import type { QrCodeUnicoRow, QrCodeVinculoRow } from "@/lib/eventos-sorteio/qr-unico";
import {
  MODELOS_IDENTIDADE_EVENTO,
  detectarModeloAtivo,
  formatarExemploPrefixo,
} from "@/lib/eventos-sorteio/modelos-identidade";
import { EventoImageField } from "./evento-image-field";

function toDatetimeLocalValue(iso: string | null | undefined): string {
  if (!iso?.trim()) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

type ActionResult =
  | { ok: true; id?: string }
  | { ok: false; error: string }
  | void;

type Props = {
  evento?: EventoRow;
  action: (formData: FormData) => Promise<ActionResult>;
  usuariosStaff?: { id: string; nome: string }[];
  leadsUsuariosIds?: string[];
  qrDisponiveis?: QrCodeUnicoRow[];
  qrVinculo?: (QrCodeVinculoRow & { qr: QrCodeUnicoRow }) | null;
  isMaster?: boolean;
};

function FormSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950/40">
      <h2 className="text-sm font-bold uppercase tracking-wide text-zinc-500">{title}</h2>
      {children}
    </section>
  );
}

export function EventoAdminForm({
  evento,
  action,
  usuariosStaff = [],
  leadsUsuariosIds = [],
  qrDisponiveis = [],
  qrVinculo = null,
  isMaster = false,
}: Props) {
  const router = useRouter();
  const dataLocal = toDatetimeLocalValue(evento?.data_evento);

  const [nome, setNome] = useState(evento?.nome ?? "");
  const [slug, setSlug] = useState(evento?.slug ?? "");
  const [local, setLocal] = useState(evento?.local ?? "");
  const [cidade, setCidade] = useState(evento?.cidade ?? "");
  const [endereco, setEndereco] = useState(evento?.endereco ?? "");
  const [estado, setEstado] = useState(evento?.estado ?? "");
  const [inscricaoTipo, setInscricaoTipo] = useState<"interno" | "externo">(
    evento?.inscricao_tipo === "externo" ? "externo" : "interno",
  );
  const [formError, setFormError] = useState<string | null>(null);
  const [formOk, setFormOk] = useState(false);

  // Estados de Identidade Visual e Prefixo do Sorteio
  const modeloInicial = detectarModeloAtivo(evento?.logo_personalizado_url, evento?.cor_primaria);
  const [modeloSelecionado, setModeloSelecionado] = useState<"racon" | "gauchinho" | "personalizado" | null>(modeloInicial);
  const [corPrimaria, setCorPrimaria] = useState(evento?.cor_primaria ?? "");
  const [corSecundaria, setCorSecundaria] = useState(evento?.cor_secundaria ?? "");
  const [logoPersonalizadoUrl, setLogoPersonalizadoUrl] = useState(evento?.logo_personalizado_url ?? "");
  const [prefixoSorteio, setPrefixoSorteio] = useState(evento?.prefixo_codigo_sorteio ?? "");

  function selecionarModelo(id: "racon" | "gauchinho") {
    setModeloSelecionado(id);
    const m = MODELOS_IDENTIDADE_EVENTO[id];
    setCorPrimaria(m.corPrimaria);
    setCorSecundaria(m.corSecundaria);
    setLogoPersonalizadoUrl(m.logoUrl);
  }

  // Novo evento: por padrão restringe aos consultores marcados.
  // Edição: preserva o valor salvo no banco.
  const [leadsAcessoTodos, setLeadsAcessoTodos] = useState(
    evento ? evento.leads_acesso_todos !== false : false,
  );
  const [usarQrUnico, setUsarQrUnico] = useState(Boolean(qrVinculo?.ativo));
  const [qrCodeId, setQrCodeId] = useState(qrVinculo?.qr_code_id ?? "");

  // Após salvar + router.refresh(), alinha o checkbox com o valor persistido no banco
  useEffect(() => {
    if (evento) setLeadsAcessoTodos(evento.leads_acesso_todos !== false);
  }, [evento?.id, evento?.leads_acesso_todos]);

  useEffect(() => {
    setUsarQrUnico(Boolean(qrVinculo?.ativo));
    setQrCodeId(qrVinculo?.qr_code_id ?? "");
  }, [qrVinculo?.id, qrVinculo?.ativo, qrVinculo?.qr_code_id]);

  const qrSelecionado = qrDisponiveis.find((q) => q.id === qrCodeId) ?? null;
  const slugHint = (usarQrUnico && qrSelecionado?.slug ? qrSelecionado.slug : slug.trim() || nome.trim()) || "evento";
  const isEdit = Boolean(evento?.id);

  function applyQrToEvento(qr: QrCodeUnicoRow) {
    setSlug(qr.slug);
    // Nome do QR = local/cidade do material impresso (ex.: Genova, Sinop)
    setLocal(qr.nome);
    setCidade(qr.nome);
  }

  function onToggleUsarQr(checked: boolean) {
    setUsarQrUnico(checked);
    if (!checked) return;
    const qr = qrDisponiveis.find((q) => q.id === qrCodeId) ?? qrDisponiveis[0] ?? null;
    if (qr) {
      setQrCodeId(qr.id);
      applyQrToEvento(qr);
    }
  }

  function onSelectQr(id: string) {
    setQrCodeId(id);
    const qr = qrDisponiveis.find((q) => q.id === id);
    if (qr) applyQrToEvento(qr);
  }

  async function onSubmit(formData: FormData) {
    setFormError(null);
    setFormOk(false);
    try {
      // Garante slug do QR no FormData mesmo se o input estiver readonly/desabilitado
      if (usarQrUnico && qrSelecionado?.slug) {
        formData.set("slug", qrSelecionado.slug);
        formData.set("usar_qr_unico", "on");
        formData.set("qr_code_unico_id", qrSelecionado.id);
      }
      // Garante que campos visuais e de sorteio sejam persistidos
      formData.set("cor_primaria", corPrimaria);
      formData.set("cor_secundaria", corSecundaria);
      formData.set("logo_personalizado_url", logoPersonalizadoUrl);
      formData.set("prefixo_codigo_sorteio", prefixoSorteio);

      const result = await action(formData);
      if (result && typeof result === "object" && "ok" in result) {
        if (!result.ok) {
          setFormError(result.error);
          return;
        }
        if ("id" in result && result.id) {
          router.push(`/admin/eventos/${result.id}`);
          return;
        }
        setFormOk(true);
        router.refresh();
        return;
      }
      setFormOk(true);
      router.refresh();
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Não foi possível salvar o evento.";
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

      {evento?.slug ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 dark:border-emerald-500/20 dark:bg-emerald-950/20">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 dark:text-emerald-300">
              Testar Fluxo do Evento
            </h3>
            <p className="mt-0.5 text-xs text-zinc-600 dark:text-zinc-400">
              Abra o check-in ou telão exatamente como o participante ou operador verá.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={`/eventos/${encodeURIComponent(evento.slug)}/sorteio`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-1.5 text-xs font-bold text-white shadow-sm hover:bg-emerald-700 transition"
              title="Abrir check-in real em nova aba"
            >
              <span>Ver check-in</span>
              <span className="text-[10px]">↗</span>
            </a>
            <a
              href={`/eventos/${encodeURIComponent(evento.slug)}/sorteio?preview=1`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-emerald-600/40 bg-white px-3 py-1.5 text-xs font-bold text-emerald-800 hover:bg-emerald-50 dark:bg-zinc-900 dark:text-emerald-200 dark:hover:bg-zinc-800 transition"
              title="Testar check-in em modo seguro sem salvar leads ou queimar números"
            >
              <span>Testar (Preview)</span>
              <span className="text-[10px]">↗</span>
            </a>
            <a
              href={`/eventos/${encodeURIComponent(evento.slug)}/telao`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-xl border border-purple-500/30 bg-purple-500/10 px-3 py-1.5 text-xs font-bold text-purple-700 hover:bg-purple-500/20 dark:text-purple-300 transition"
              title="Abrir tela cheia do telão de palco"
            >
              <span>Telão</span>
              <span className="text-[10px]">↗</span>
            </a>
          </div>
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
            Pode alterar o nome quando quiser — com QR único o link impresso (/qr/…) não muda.
          </p>
        </div>
        <div>
          <Label>Link permanente (slug)</Label>
          <Input
            name="slug"
            value={usarQrUnico && qrSelecionado ? qrSelecionado.slug : slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder={isEdit ? "mantem-o-link-atual" : "ex-sinop"}
            readOnly={usarQrUnico && Boolean(qrSelecionado)}
            className={usarQrUnico && qrSelecionado ? "bg-zinc-100 dark:bg-zinc-900" : undefined}
          />
          <p className="mt-1 text-xs text-zinc-500">
            {usarQrUnico && qrSelecionado ? (
              <>
                Com QR único, o slug do evento é o do QR: <strong>/eventos/{qrSelecionado.slug}</strong> e{" "}
                <strong>/qr/{qrSelecionado.slug}</strong>.
              </>
            ) : (
              <>
                URL pública: /eventos/{slugHint || "…"}. Independente do nome. Só altere se quiser mudar o
                link do evento.
              </>
            )}
          </p>
        </div>
        <div>
          <Label>Data do evento</Label>
          <Input name="data_evento" type="datetime-local" defaultValue={dataLocal} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>Local</Label>
            <Input name="local" value={local} onChange={(e) => setLocal(e.target.value)} />
          </div>
          <div>
            <Label>Cidade</Label>
            <Input name="cidade" value={cidade} onChange={(e) => setCidade(e.target.value)} />
          </div>
        </div>
        <div>
          <Label>Endereço</Label>
          <Input name="endereco" value={endereco} onChange={(e) => setEndereco(e.target.value)} />
        </div>
        <div>
          <Label>Estado (UF)</Label>
          <Input name="estado" maxLength={2} value={estado} onChange={(e) => setEstado(e.target.value)} />
        </div>
      </FormSection>

      <FormSection title="Experiência do Evento">
        <div className="space-y-5">
          {/* Check-in Interativo */}
          <div className="rounded-xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="checkbox"
                name="checkin_interativo_ativo"
                defaultChecked={Boolean(evento?.checkin_interativo_ativo)}
                className="mt-1 h-4 w-4 rounded border-zinc-700 text-amber-500 focus:ring-amber-500"
              />
              <div>
                <span className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                  CHECK-IN INTERATIVO NO CELULAR
                </span>
                <span className="mt-1 block text-xs text-zinc-600 dark:text-zinc-400">
                  Mostra uma pergunta por vez e, ao final, confirma a presença e entrega o número da sorte.
                </span>
              </div>
            </label>
          </div>

          {/* Identidade Visual do Evento */}
          <div className="space-y-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-zinc-700 dark:text-zinc-300">
                IDENTIDADE VISUAL DO EVENTO
              </h3>
              <p className="mt-0.5 text-xs text-zinc-500">
                Escolha a marca que será usada no check-in, número da sorte e telão.
              </p>
            </div>

            {/* Campos ocultos persistidos no FormData */}
            <input type="hidden" name="logo_personalizado_url" value={logoPersonalizadoUrl} />
            <input type="hidden" name="cor_primaria" value={corPrimaria} />
            <input type="hidden" name="cor_secundaria" value={corSecundaria} />

            {/* Cards de Marcas Oficiais Pré-aprovadas */}
            <div className="grid gap-3 sm:grid-cols-2">
              {/* Card RACON */}
              <button
                type="button"
                onClick={() => selecionarModelo("racon")}
                className={`flex flex-col items-start rounded-2xl border-2 p-4 text-left transition ${
                  modeloSelecionado === "racon"
                    ? "border-blue-600 bg-blue-50/50 shadow-sm dark:border-blue-500 dark:bg-blue-950/30"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="relative h-8 w-28">
                    <Image
                      src={MODELOS_IDENTIDADE_EVENTO.racon.logoUrl}
                      alt="Racon Consórcios"
                      fill
                      className="object-contain object-left"
                    />
                  </div>
                  {modeloSelecionado === "racon" ? (
                    <span className="rounded-full bg-blue-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                      ✓ Racon selecionado
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Racon Consórcios</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Paleta oficial azul e marinho para franquias e encontros</p>
                </div>
                <div className="mt-3 flex w-full items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full bg-[#0066cc]" title="Azul Royal (#0066cc)" />
                    <span className="h-4 w-4 rounded-full bg-[#0c2340]" title="Azul Marinho (#0c2340)" />
                    <span className="h-4 w-4 rounded-full bg-[#0099dd]" title="Cyan Destaque (#0099dd)" />
                  </div>
                  <span className="rounded-lg bg-[#0066cc] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    Botão Modelo
                  </span>
                </div>
              </button>

              {/* Card GAUCHINHO */}
              <button
                type="button"
                onClick={() => selecionarModelo("gauchinho")}
                className={`flex flex-col items-start rounded-2xl border-2 p-4 text-left transition ${
                  modeloSelecionado === "gauchinho"
                    ? "border-amber-500 bg-amber-50/50 shadow-sm dark:border-amber-500 dark:bg-amber-950/30"
                    : "border-zinc-200 bg-white hover:border-zinc-300 dark:border-zinc-800 dark:bg-zinc-900"
                }`}
              >
                <div className="flex w-full items-center justify-between">
                  <div className="relative h-8 w-28">
                    <Image
                      src={MODELOS_IDENTIDADE_EVENTO.gauchinho.logoUrl}
                      alt="Gauchinho Consórcios"
                      fill
                      className="object-contain object-left"
                    />
                  </div>
                  {modeloSelecionado === "gauchinho" ? (
                    <span className="rounded-full bg-amber-600 px-2.5 py-0.5 text-[11px] font-bold text-white">
                      ✓ Gauchinho selecionado
                    </span>
                  ) : null}
                </div>
                <div className="mt-3">
                  <p className="text-sm font-bold text-zinc-900 dark:text-zinc-100">Gauchinho Consórcios</p>
                  <p className="text-xs text-zinc-500 mt-0.5">Paleta dourada e marinho tradicional da plataforma</p>
                </div>
                <div className="mt-3 flex w-full items-center justify-between gap-2 border-t border-zinc-100 pt-2.5 dark:border-zinc-800">
                  <div className="flex items-center gap-1.5">
                    <span className="h-4 w-4 rounded-full bg-[#c9a84c]" title="Dourado (#c9a84c)" />
                    <span className="h-4 w-4 rounded-full bg-[#0a1628]" title="Azul Marinho (#0a1628)" />
                  </div>
                  <span className="rounded-lg bg-[#c9a84c] px-2.5 py-1 text-[11px] font-bold text-white shadow-sm">
                    Botão Modelo
                  </span>
                </div>
              </button>
            </div>

            {/* Prévia Visual em Tempo Real */}
            <div className="mt-4 rounded-2xl border border-zinc-200 bg-zinc-50/70 p-4 dark:border-zinc-800 dark:bg-zinc-900/50">
              <p className="text-[11px] font-bold uppercase tracking-wider text-zinc-500">
                PRÉVIA VISUAL DO EVENTO (Celular / Telão)
              </p>
              <div className="mt-3 mx-auto max-w-sm rounded-2xl border border-zinc-200 bg-white p-5 shadow-sm dark:border-zinc-800 dark:bg-zinc-950">
                <div className="flex flex-col items-center text-center space-y-3">
                  {logoPersonalizadoUrl ? (
                    <div className="relative h-10 w-36">
                      <Image
                        src={logoPersonalizadoUrl}
                        alt="Logo do evento"
                        fill
                        className="object-contain"
                      />
                    </div>
                  ) : (
                    <div className="text-sm font-black text-zinc-800 dark:text-zinc-200">
                      {nome || "Nome do Evento"}
                    </div>
                  )}
                  <p className="text-xs text-zinc-500">Bem-vindo ao evento</p>
                  <button
                    type="button"
                    tabIndex={-1}
                    style={{
                      backgroundColor: corPrimaria || "#0066cc",
                      color: "#ffffff",
                    }}
                    className="w-full rounded-xl py-2.5 text-xs font-bold shadow transition cursor-default pointer-events-none"
                  >
                    CONFIRMAR PRESENÇA
                  </button>
                  <div className="w-full rounded-xl border border-dashed border-zinc-300 bg-zinc-50/80 py-2.5 dark:border-zinc-700 dark:bg-zinc-900">
                    <p className="text-[10px] text-zinc-400 uppercase font-semibold">Número da Sorte</p>
                    <p
                      style={{ color: corPrimaria || "#0066cc" }}
                      className="font-mono text-lg font-black"
                    >
                      {formatarExemploPrefixo(prefixoSorteio, 27)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Prefixo do Número da Sorte */}
            <div className="pt-2">
              <Label>Prefixo do Número da Sorte</Label>
              <Input
                name="prefixo_codigo_sorteio"
                value={prefixoSorteio}
                onChange={(e) => setPrefixoSorteio(e.target.value)}
                placeholder="Ex: ING, RCN ou deixe vazio para 001, 002..."
              />
              <div className="mt-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <p className="text-zinc-600 dark:text-zinc-400">
                  Exemplo:{" "}
                  <strong className="font-mono text-amber-600 dark:text-amber-400">
                    {formatarExemploPrefixo(prefixoSorteio, 1)}
                  </strong>
                  ,{" "}
                  <span className="font-mono text-zinc-500">
                    {formatarExemploPrefixo(prefixoSorteio, 2)}
                  </span>
                  ...
                </p>
                <span className="text-zinc-400">
                  O sistema cuida automaticamente do hífen/separador.
                </span>
              </div>
            </div>

            {/* Configurações Avançadas (Somente Master) */}
            {isMaster ? (
              <details className="mt-3 rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-xs dark:border-zinc-800 dark:bg-zinc-900/60">
                <summary className="cursor-pointer font-bold text-zinc-700 hover:underline dark:text-zinc-300">
                  ⚙️ Configurações Avançadas (Master): Personalizar cores HEX e logotipo manualmente
                </summary>
                <div className="mt-3 space-y-3 border-t border-zinc-200 pt-3 dark:border-zinc-700">
                  <p className="text-zinc-500">
                    Insira cores HEX customizadas caso este evento específico demande ajustes manuais fora dos modelos padrão.
                  </p>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div>
                      <Label>Cor Primária (HEX)</Label>
                      <Input
                        value={corPrimaria}
                        onChange={(e) => {
                          setCorPrimaria(e.target.value);
                          setModeloSelecionado("personalizado");
                        }}
                        placeholder="#0066cc ou #c9a84c"
                      />
                    </div>
                    <div>
                      <Label>Cor Secundária (HEX)</Label>
                      <Input
                        value={corSecundaria}
                        onChange={(e) => {
                          setCorSecundaria(e.target.value);
                          setModeloSelecionado("personalizado");
                        }}
                        placeholder="#0c2340 ou #0a1628"
                      />
                    </div>
                  </div>
                  <div>
                    <Label>URL do Logotipo Personalizado</Label>
                    <Input
                      value={logoPersonalizadoUrl}
                      onChange={(e) => {
                        setLogoPersonalizadoUrl(e.target.value);
                        setModeloSelecionado("personalizado");
                      }}
                      placeholder="/racon/logoracon.jpg ou https://..."
                    />
                  </div>
                </div>
              </details>
            ) : null}
          </div>
        </div>
      </FormSection>

      <FormSection title="QR Permanente do Local">
        <p className="text-sm text-zinc-500">
          Use um QR permanente em totens, mesas, recepção ou materiais impressos. Você poderá trocar o evento vinculado sem precisar imprimir outro QR.
        </p>

        {qrVinculo?.ativo ? (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3 text-xs text-emerald-900 dark:text-emerald-200">
            <p className="font-semibold">
              ✓ QR permanente do local vinculado atualmente: <strong>{qrVinculo.qr.nome}</strong> (
              <code className="font-mono font-bold">/qr/{qrVinculo.qr.slug}</code>)
            </p>
            <p className="mt-1 text-emerald-700 dark:text-emerald-300">
              O material físico com este QR já está direcionando para este evento durante o período definido.
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-3 text-xs text-zinc-600 dark:border-zinc-800 dark:bg-zinc-900/60 dark:text-zinc-400">
            Nenhum QR permanente vinculado a este evento no momento.
          </div>
        )}

        <label className="flex items-center gap-2 text-sm pt-1">
          <input
            type="checkbox"
            name="usar_qr_unico"
            value="on"
            checked={usarQrUnico}
            onChange={(e) => onToggleUsarQr(e.target.checked)}
          />
          Vincular QR Code permanente a este evento
        </label>
        {usarQrUnico ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label>Selecionar QR Code cadastrado</Label>
              <select
                name="qr_code_unico_id"
                value={qrCodeId}
                onChange={(e) => onSelectQr(e.target.value)}
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
              {qrSelecionado ? (
                <p className="mt-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-100">
                  QR selecionado: <strong>{qrSelecionado.nome}</strong> — link impresso{" "}
                  <code className="font-mono">/qr/{qrSelecionado.slug}</code>
                </p>
              ) : null}
              {qrDisponiveis.length === 0 ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-400">
                  Nenhum QR disponível.{" "}
                  <Link href="/admin/configuracoes/qr-codes" className="underline">
                    Cadastre um QR Code permanente
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
              <span className="font-medium">Pela plataforma</span>
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
