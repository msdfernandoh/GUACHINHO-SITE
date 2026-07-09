"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import QRCode from "react-qr-code";
import Link from "next/link";
import { Button, Input, Label } from "@/components/ui/form-primitives";
import { sectionCardClass, simuladorShell } from "@/components/simulador/simulador-ui";
import { formatCurrency, formatWhatsappBrInput } from "@/lib/utils/format";
import { digitsOnlyPhone } from "@/lib/utils/format";
import type { ContratacaoOnlineRow, FormaPagamento, TipoPessoa } from "@/lib/contratacoes-online/types";
import { cn } from "@/lib/utils/cn";

type ResumoFinanceiro = Record<string, number | string | null>;

type ApiPayload = {
  contratacao: ContratacaoOnlineRow;
  resumoFinanceiro: ResumoFinanceiro;
  formasPagamento: FormaPagamento[];
  pixConfig: {
    chave: string;
    recebedor: string;
    instrucoes: string;
    comprovanteObrigatorio: boolean;
  } | null;
};

type Step =
  | "confirm"
  | "dados"
  | "pessoa"
  | "docs"
  | "pagamento"
  | "pix"
  | "boleto"
  | "cartao"
  | "success";

function Row({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex justify-between gap-4 border-b border-slate-800 py-2 text-sm last:border-0">
      <span className="text-slate-400">{label}</span>
      <span className="text-right font-medium text-slate-100">{value}</span>
    </div>
  );
}

function money(v: number | null | undefined) {
  return v != null && Number.isFinite(v) ? formatCurrency(v) : null;
}

export function ContratacaoWizard({ publicToken }: { publicToken: string }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<ApiPayload | null>(null);
  const [step, setStep] = useState<Step>("confirm");
  const [submitting, setSubmitting] = useState(false);

  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [tipoPessoa, setTipoPessoa] = useState<TipoPessoa>("cpf");
  const [cpf, setCpf] = useState("");
  const [dataNascimento, setDataNascimento] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [respNome, setRespNome] = useState("");
  const [respCpf, setRespCpf] = useState("");
  const [formaPagamento, setFormaPagamento] = useState<FormaPagamento | null>(null);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/contratacoes/${publicToken}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Erro ao carregar");
      setData(json as ApiPayload);
      const c = json.contratacao as ContratacaoOnlineRow;
      setNome(c.nome ?? "");
      setTelefone(c.telefone ? formatWhatsappBrInput(c.telefone) : "");
      setEmail(c.email ?? "");
      if (c.tipo_pessoa) setTipoPessoa(c.tipo_pessoa);
      if (c.status === "aguardando_consultor" || c.status === "finalizado") {
        setStep("success");
      } else if (c.status === "pagamento_escolhido" && c.forma_pagamento === "pix") {
        setStep("pix");
        setFormaPagamento("pix");
      } else if (c.status === "pagamento_escolhido" && c.forma_pagamento === "boleto") {
        setStep("boleto");
      } else if (c.status === "pagamento_escolhido" && c.forma_pagamento === "cartao") {
        setStep("cartao");
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setLoading(false);
    }
  }, [publicToken]);

  useEffect(() => {
    void load();
  }, [load]);

  const c = data?.contratacao;
  const fin = data?.resumoFinanceiro ?? {};

  const origemLabel = c?.origem === "grupos" ? "Grupo" : "Simulador";

  async function patch(body: Record<string, unknown>) {
    const res = await fetch(`/api/public/contratacoes/${publicToken}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Falha ao salvar");
    setData((prev) => (prev ? { ...prev, contratacao: json.contratacao } : prev));
    return json.contratacao as ContratacaoOnlineRow;
  }

  async function confirmar() {
    setSubmitting(true);
    try {
      await patch({ acao: "confirmar" });
      setStep("dados");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function salvarDados(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await patch({
        etapa: "dados",
        nome,
        telefone: digitsOnlyPhone(telefone),
        email,
      });
      setStep("pessoa");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function salvarPessoa(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await patch({
        etapa: "pessoa",
        tipo_pessoa: tipoPessoa,
        cpf: tipoPessoa === "cpf" ? cpf : undefined,
        data_nascimento: dataNascimento || undefined,
        razao_social: tipoPessoa === "cnpj" ? razaoSocial : undefined,
        cnpj: tipoPessoa === "cnpj" ? cnpj : undefined,
        responsavel_nome: tipoPessoa === "cnpj" ? respNome : undefined,
        responsavel_cpf: tipoPessoa === "cnpj" ? respCpf : undefined,
      });
      setStep("docs");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function uploadDoc(tipo: string, file: File | null) {
    if (!file) return;
    setUploadMsg(null);
    const fd = new FormData();
    fd.set("tipo_documento", tipo);
    fd.set("arquivo", file);
    const res = await fetch(`/api/public/contratacoes/${publicToken}/documentos`, {
      method: "POST",
      body: fd,
    });
    const json = await res.json();
    if (!res.ok) throw new Error(json.error ?? "Falha no upload");
    setUploadMsg(`Arquivo ${file.name} enviado.`);
    await load();
  }

  async function continuarDocs() {
    setSubmitting(true);
    try {
      await patch({ etapa: "documentos" });
      setStep("pagamento");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function escolherPagamento(forma: FormaPagamento) {
    setSubmitting(true);
    setError(null);
    try {
      await patch({ etapa: "pagamento", forma_pagamento: forma });
      setFormaPagamento(forma);
      if (forma === "pix") setStep("pix");
      else if (forma === "boleto") setStep("boleto");
      else setStep("cartao");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  async function finalizar() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch(`/api/public/contratacoes/${publicToken}/finalizar`, {
        method: "POST",
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Falha ao finalizar");
      setStep("success");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  const pixChave = c?.pix_chave || data?.pixConfig?.chave || "";
  const comprovanteObrigatorio =
    data?.pixConfig?.comprovanteObrigatorio ?? false;

  const successExtra = useMemo(() => {
    if (formaPagamento === "boleto" || c?.forma_pagamento === "boleto") {
      return "Você escolheu boleto bancário. O boleto em PDF será enviado junto com o link de aceite do contrato.";
    }
    if (formaPagamento === "cartao" || c?.forma_pagamento === "cartao") {
      return "Você escolheu cartão de crédito. O link para pagamento no cartão será enviado junto com o link de aceite do contrato.";
    }
    if (formaPagamento === "pix" || c?.forma_pagamento === "pix") {
      return "Você escolheu Pix. Caso tenha enviado o comprovante, nossa equipe irá validar e seguir com a emissão manual da proposta.";
    }
    return "";
  }, [formaPagamento, c?.forma_pagamento]);

  if (loading) {
    return (
      <div className={cn(simuladorShell, "flex min-h-screen items-center justify-center p-8")}>
        <p className="text-slate-400">Carregando proposta…</p>
      </div>
    );
  }

  if (error && !c) {
    return (
      <div className={cn(simuladorShell, "flex min-h-screen flex-col items-center justify-center gap-4 p-8")}>
        <p className="text-red-400">{error}</p>
        <Link href="/" className="text-amber-400 underline">
          Voltar ao site
        </Link>
      </div>
    );
  }

  if (!c) return null;

  return (
    <div className={cn(simuladorShell, "min-h-screen px-4 py-10")}>
      <div className="mx-auto max-w-2xl space-y-6">
        <header className="text-center">
          <p className="text-xs font-semibold uppercase tracking-widest text-amber-400/90">
            Gauchinho Consórcios
          </p>
          <h1 className="mt-2 text-2xl font-bold text-white sm:text-3xl">FECHAMENTO DA PROPOSTA</h1>
          {step === "confirm" ? (
            <p className="mt-2 text-sm text-slate-400">
              Confira os dados da sua proposta antes de continuar.
            </p>
          ) : null}
          <p className="mt-1 text-xs text-slate-500">Protocolo {c.protocolo}</p>
        </header>

        {error ? <p className="text-center text-sm text-red-400">{error}</p> : null}

        {step === "confirm" ? (
          <>
            <div className={sectionCardClass()}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400/90">
                Resumo da proposta
              </h2>
              <Row label="Tipo do bem" value={c.tipo_bem} />
              <Row label="Crédito selecionado" value={money(c.credito_selecionado)} />
              <Row label="Parcela estimada" value={money(c.parcela_estimada)} />
              <Row label="Prazo" value={c.prazo ? `${c.prazo} meses` : null} />
              <Row label="Origem" value={origemLabel} />
              <Row label="Administradora" value={c.administradora} />
              <Row label="Grupo" value={c.grupo_nome} />
            </div>
            <div className={sectionCardClass()}>
              <h2 className="mb-3 text-sm font-semibold uppercase tracking-wide text-amber-400/90">
                Detalhes financeiros
              </h2>
              <Row label="Parcela reduzida" value={money(fin.parcelaReduzida as number)} />
              <Row label="Parcela integral" value={money(fin.parcelaIntegral as number)} />
              <Row label="Lance embutido" value={money(fin.lanceEmbutido as number)} />
              <Row label="Recurso próprio" value={money(fin.recursoProprio as number)} />
              <Row label="Lance total" value={money(fin.lanceTotal as number)} />
              <Row label="Crédito líquido" value={money(fin.creditoLiquido as number)} />
              <Row label="Saldo pós-lance" value={money(fin.saldoPosLance as number)} />
              <Row label="Seguro" value={money(fin.seguro as number)} />
            </div>
            <p className="text-sm text-slate-400">
              Ao continuar, você confirma que deseja avançar com esta proposta para análise e emissão
              manual do contrato pela equipe Gauchinho.
            </p>
            <Button
              type="button"
              variant="gold"
              className="min-h-12 w-full text-base font-bold"
              disabled={submitting}
              onClick={confirmar}
            >
              Confirmar proposta e continuar
            </Button>
          </>
        ) : null}

        {step === "dados" ? (
          <form onSubmit={salvarDados} className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Dados do interessado</h2>
            <div>
              <Label>Nome completo</Label>
              <Input required value={nome} onChange={(e) => setNome(e.target.value)} className="mt-1" />
            </div>
            <div>
              <Label>Telefone / WhatsApp</Label>
              <Input
                required
                value={telefone}
                onChange={(e) => setTelefone(formatWhatsappBrInput(e.target.value))}
                className="mt-1"
              />
            </div>
            <div>
              <Label>E-mail</Label>
              <Input required type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="mt-1" />
            </div>
            <Button type="submit" variant="gold" className="w-full" disabled={submitting}>
              Continuar
            </Button>
          </form>
        ) : null}

        {step === "pessoa" ? (
          <form onSubmit={salvarPessoa} className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">A contratação será em CPF ou CNPJ?</h2>
            <div className="grid gap-2 sm:grid-cols-2">
              {(["cpf", "cnpj"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  className={cn(
                    "rounded-xl border px-4 py-3 text-left text-sm font-medium",
                    tipoPessoa === t
                      ? "border-amber-400 bg-amber-400/10 text-amber-200"
                      : "border-slate-700 text-slate-300",
                  )}
                  onClick={() => setTipoPessoa(t)}
                >
                  {t === "cpf" ? "Pessoa Física — CPF" : "Pessoa Jurídica — CNPJ"}
                </button>
              ))}
            </div>
            {tipoPessoa === "cpf" ? (
              <>
                <div>
                  <Label>CPF</Label>
                  <Input required value={cpf} onChange={(e) => setCpf(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Data de nascimento (opcional)</Label>
                  <Input type="date" value={dataNascimento} onChange={(e) => setDataNascimento(e.target.value)} className="mt-1" />
                </div>
              </>
            ) : (
              <>
                <div>
                  <Label>Razão social</Label>
                  <Input required value={razaoSocial} onChange={(e) => setRazaoSocial(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>CNPJ</Label>
                  <Input required value={cnpj} onChange={(e) => setCnpj(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>Nome do responsável</Label>
                  <Input required value={respNome} onChange={(e) => setRespNome(e.target.value)} className="mt-1" />
                </div>
                <div>
                  <Label>CPF do responsável</Label>
                  <Input required value={respCpf} onChange={(e) => setRespCpf(e.target.value)} className="mt-1" />
                </div>
              </>
            )}
            <Button type="submit" variant="gold" className="w-full" disabled={submitting}>
              Continuar
            </Button>
          </form>
        ) : null}

        {step === "docs" ? (
          <div className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Envio de documentos</h2>
            <p className="text-sm text-slate-400">
              Envie os documentos para agilizar a emissão da proposta e do contrato pela nossa equipe.
            </p>
            {tipoPessoa === "cpf" ? (
              <>
                <DocUpload label="CNH ou RG" tipo="documento_foto" onUpload={uploadDoc} />
                <DocUpload label="CPF (se separado)" tipo="cpf" onUpload={uploadDoc} />
                <DocUpload label="Comprovante de endereço (opcional)" tipo="comprovante_endereco" onUpload={uploadDoc} />
              </>
            ) : (
              <>
                <DocUpload label="Cartão CNPJ" tipo="cartao_cnpj" onUpload={uploadDoc} />
                <DocUpload label="Documento do responsável — CNH ou RG" tipo="documento_responsavel" onUpload={uploadDoc} />
                <DocUpload label="CPF do responsável (se separado)" tipo="cpf_responsavel" onUpload={uploadDoc} />
                <DocUpload label="Comprovante de endereço da empresa (opcional)" tipo="comprovante_endereco" onUpload={uploadDoc} />
              </>
            )}
            <p className="text-xs text-slate-500">
              Seus documentos serão utilizados apenas para análise e formalização da proposta, conforme
              nossa política de privacidade.
            </p>
            {uploadMsg ? <p className="text-sm text-emerald-400">{uploadMsg}</p> : null}
            <Button type="button" variant="gold" className="w-full" disabled={submitting} onClick={continuarDocs}>
              Continuar para pagamento
            </Button>
          </div>
        ) : null}

        {step === "pagamento" ? (
          <div className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Escolha a forma de pagamento</h2>
            <p className="text-sm text-slate-400">
              Selecione como deseja receber ou realizar o pagamento inicial da contratação.
            </p>
            <div className="grid gap-3 sm:grid-cols-3">
              {(data?.formasPagamento ?? []).map((f) => (
                <Button
                  key={f}
                  type="button"
                  variant="outlineGold"
                  className="min-h-20 border-slate-600 bg-slate-900 capitalize"
                  disabled={submitting}
                  onClick={() => escolherPagamento(f)}
                >
                  {f === "pix" ? "Pix" : f === "boleto" ? "Boleto bancário" : "Cartão de crédito"}
                </Button>
              ))}
            </div>
          </div>
        ) : null}

        {step === "pix" ? (
          <div className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Pagamento via Pix</h2>
            <p className="text-sm text-slate-400">
              Para agilizar sua contratação, realize o pagamento via Pix e envie o comprovante. Nossa equipe
              irá validar o pagamento e seguir com a emissão manual do contrato.
            </p>
            {pixChave ? (
              <div className="flex flex-col items-center gap-3 rounded-xl bg-white p-4">
                <QRCode value={pixChave} size={160} />
              </div>
            ) : null}
            <Row label="Chave Pix" value={pixChave} />
            <Row label="Recebedor" value={c.pix_recebedor || data?.pixConfig?.recebedor} />
            <p className="text-sm text-slate-300">{c.pix_instrucoes || data?.pixConfig?.instrucoes}</p>
            <Button
              type="button"
              variant="outlineGold"
              className="w-full border-slate-600"
              onClick={() => navigator.clipboard.writeText(pixChave)}
            >
              Copiar chave Pix
            </Button>
            <DocUpload label="Comprovante Pix" tipo="comprovante_pix" onUpload={uploadDoc} />
            <Button type="button" variant="gold" className="w-full" disabled={submitting} onClick={finalizar}>
              Finalizar solicitação
            </Button>
            {comprovanteObrigatorio && !c.pix_comprovante_url ? (
              <p className="text-xs text-amber-300">Comprovante obrigatório para finalizar.</p>
            ) : null}
          </div>
        ) : null}

        {step === "boleto" ? (
          <div className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Boleto bancário selecionado</h2>
            <p className="text-sm text-slate-400">
              Sua solicitação foi registrada com a opção de pagamento por boleto bancário.
            </p>
            <p className="text-sm text-slate-300">
              Nossa equipe irá finalizar a proposta no sistema da administradora e enviar para você o link
              de aceite do contrato junto com o boleto em PDF pelo WhatsApp ou e-mail.
            </p>
            <Button type="button" variant="gold" className="w-full" disabled={submitting} onClick={finalizar}>
              Finalizar solicitação
            </Button>
          </div>
        ) : null}

        {step === "cartao" ? (
          <div className={cn(sectionCardClass(), "space-y-4")}>
            <h2 className="text-lg font-semibold text-white">Cartão de crédito selecionado</h2>
            <p className="text-sm text-slate-400">
              Sua solicitação foi registrada com a opção de pagamento por cartão de crédito.
            </p>
            <p className="text-sm text-slate-300">
              Nossa equipe irá finalizar a proposta no sistema da administradora e enviar para você o link
              de aceite do contrato junto com o link de pagamento no cartão.
            </p>
            <Button type="button" variant="gold" className="w-full" disabled={submitting} onClick={finalizar}>
              Finalizar solicitação
            </Button>
          </div>
        ) : null}

        {step === "success" ? (
          <div className={cn(sectionCardClass(), "space-y-3 text-center")}>
            <h2 className="text-xl font-bold text-emerald-400">Solicitação enviada com sucesso!</h2>
            <p className="text-sm text-slate-300">
              Recebemos seus dados, documentos e a forma de pagamento escolhida. Nossa equipe irá finalizar
              sua proposta no sistema da administradora.
            </p>
            <p className="text-sm text-slate-300">
              Em breve, você receberá pelo WhatsApp ou e-mail o link de aceite do contrato junto com as
              orientações de pagamento da opção escolhida.
            </p>
            {successExtra ? <p className="text-sm text-amber-200/90">{successExtra}</p> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function DocUpload({
  label,
  tipo,
  onUpload,
}: {
  label: string;
  tipo: string;
  onUpload: (tipo: string, file: File | null) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);
  return (
    <div>
      <Label>{label}</Label>
      <Input
        type="file"
        accept=".pdf,.jpg,.jpeg,.png,.webp,application/pdf,image/*"
        className="mt-1 text-sm"
        disabled={busy}
        onChange={async (e) => {
          const file = e.target.files?.[0] ?? null;
          setBusy(true);
          try {
            await onUpload(tipo, file);
          } finally {
            setBusy(false);
            e.target.value = "";
          }
        }}
      />
      <p className="mt-0.5 text-xs text-slate-500">PDF, JPG, PNG ou WEBP — máx. 5 MB</p>
    </div>
  );
}
