"use client";

import { useCallback, useEffect, useState } from "react";
import { calcularPrazoGrupo } from "@/lib/grupos/prazos";

type Props = {
  formId: string;
  initial: {
    prazo_total?: number | null;
    parcelas_realizadas?: number | null;
    prazo_restante?: number | null;
    parcelas_realizadas_base?: number | null;
    data_base_parcelas?: string | null;
    atualizacao_parcelas_automatica?: boolean | null;
  };
};

function readForm(formId: string) {
  const form = document.getElementById(formId) as HTMLFormElement | null;
  if (!form) return null;
  const fd = new FormData(form);
  const num = (name: string) => {
    const v = String(fd.get(name) ?? "").trim();
    if (!v) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  };
  return {
    prazoTotal: num("prazo_total"),
    parcelasRealizadasBase: num("parcelas_realizadas_base"),
    dataBaseParcelas: String(fd.get("data_base_parcelas") ?? "").trim() || null,
    atualizacaoAutomatica: fd.get("atualizacao_parcelas_automatica") === "on",
    parcelasRealizadasManual: num("parcelas_realizadas"),
    prazoRestanteManual: num("prazo_restante"),
  };
}

export function GrupoPrazoAdminPreview({ formId, initial }: Props) {
  const [preview, setPreview] = useState(() =>
    calcularPrazoGrupo({
      prazoTotal: initial.prazo_total,
      parcelasRealizadasBase:
        initial.parcelas_realizadas_base ?? initial.parcelas_realizadas,
      dataBaseParcelas: initial.data_base_parcelas,
      atualizacaoAutomatica: initial.atualizacao_parcelas_automatica,
      parcelasRealizadasManual: initial.parcelas_realizadas,
      prazoRestanteManual: initial.prazo_restante,
    }),
  );

  const refresh = useCallback(() => {
    const values = readForm(formId);
    if (!values) return;
    setPreview(
      calcularPrazoGrupo({
        prazoTotal: values.prazoTotal,
        parcelasRealizadasBase: values.parcelasRealizadasBase,
        dataBaseParcelas: values.dataBaseParcelas,
        atualizacaoAutomatica: values.atualizacaoAutomatica,
        parcelasRealizadasManual: values.parcelasRealizadasManual,
        prazoRestanteManual: values.prazoRestanteManual,
      }),
    );
  }, [formId]);

  useEffect(() => {
    const form = document.getElementById(formId);
    if (!form) return;
    form.addEventListener("input", refresh);
    form.addEventListener("change", refresh);
    return () => {
      form.removeEventListener("input", refresh);
      form.removeEventListener("change", refresh);
    };
  }, [formId, refresh]);

  const semDataBase =
    !!initial.atualizacao_parcelas_automatica === false &&
    !initial.data_base_parcelas &&
    !preview.modoAutomatico;

  return (
    <div className="rounded-lg border border-zinc-200 bg-zinc-50 p-3 text-sm dark:border-zinc-700 dark:bg-zinc-950/50">
      <p className="text-xs font-semibold uppercase tracking-wide text-zinc-500">Prévia (hoje)</p>
      <p className="mt-2 text-zinc-800 dark:text-zinc-100">
        Parcelas realizadas atuais:{" "}
        <strong>{preview.parcelasRealizadasAtuais}</strong>
      </p>
      <p className="text-zinc-800 dark:text-zinc-100">
        Prazo restante atual: <strong>{preview.prazoRestanteAtual}</strong>
      </p>
      <p className="mt-1 font-mono text-xs text-zinc-500">
        {preview.prazoTotal} / {preview.prazoRestanteAtual} / {preview.parcelasRealizadasAtuais}
      </p>
      {preview.modoAutomatico ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400/90">
          Atualização automática ativa
          {preview.dataBaseParcelas ? ` (base ${preview.dataBaseParcelas})` : ""}.
        </p>
      ) : (
        <p className="mt-2 text-xs text-zinc-500">Modo manual — valores fixos do formulário.</p>
      )}
      {semDataBase ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-400/90">
          Este grupo ainda não possui data base para atualização automática. Preencha a data base
          para ativar o cálculo mensal.
        </p>
      ) : null}
    </div>
  );
}
