"use client";

import { useEffect, useEffectEvent, useRef, useState } from "react";
import { formatCepBrInput, formatUfInput, sanitizeCep } from "@/lib/contratacoes-online/endereco";
import { fetchEnderecoByCep } from "@/lib/contratacoes-online/viacep";

export type EmpresaEnderecoState = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  estado: string;
};

export function EmpresaEnderecoFields({
  values,
  onChange,
}: {
  values: EmpresaEnderecoState;
  onChange: (patch: Partial<EmpresaEnderecoState>) => void;
}) {
  const [buscando, setBuscando] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const ultimoCep = useRef("");
  const notificarMudanca = useEffectEvent(onChange);

  useEffect(() => {
    const digits = sanitizeCep(values.cep);
    if (digits.length !== 8) return;
    if (digits === ultimoCep.current) return;

    let cancelado = false;
    setBuscando(true);
    setAviso(null);
    void (async () => {
      const encontrado = await fetchEnderecoByCep(digits);
      if (cancelado) return;
      ultimoCep.current = digits;
      setBuscando(false);
      if (!encontrado) {
        setAviso("CEP não encontrado. Confira o número ou preencha o endereço manualmente.");
        return;
      }
      notificarMudanca({
        endereco: encontrado.logradouro,
        bairro: encontrado.bairro,
        cidade: encontrado.localidade,
        estado: encontrado.uf,
      });
    })();

    return () => {
      cancelado = true;
    };
  }, [values.cep]);

  function inputClass(extra = "") {
    return `mt-1 w-full rounded-lg border border-slate-300 p-2.5 dark:border-slate-700 dark:bg-slate-800 ${extra}`;
  }

  return (
    <fieldset className="space-y-4 border-t border-slate-200 pt-4 dark:border-slate-800">
      <legend className="px-1 text-sm font-extrabold text-slate-900 dark:text-white">Endereço da Master Franquia</legend>
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300">CEP:</label>
          <input
            name="cep"
            value={values.cep}
            onChange={(event) => {
              const cep = formatCepBrInput(event.target.value);
              if (sanitizeCep(cep) !== ultimoCep.current) ultimoCep.current = "";
              if (sanitizeCep(cep).length !== 8) {
                setBuscando(false);
                setAviso(null);
              }
              onChange({ cep });
            }}
            inputMode="numeric"
            autoComplete="postal-code"
            maxLength={9}
            placeholder="00000-000"
            className={inputClass("font-mono")}
          />
          {buscando ? <p className="mt-1 text-[11px] font-semibold text-cyan-700">Buscando endereço…</p> : null}
          {aviso ? <p className="mt-1 text-[11px] font-semibold text-amber-700">{aviso}</p> : null}
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold text-slate-700 dark:text-slate-300">Endereço / Logradouro:</label>
          <input name="endereco" value={values.endereco} onChange={(event) => onChange({ endereco: event.target.value })} autoComplete="street-address" className={inputClass()} />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300">Número:</label>
          <input name="numero" value={values.numero} onChange={(event) => onChange({ numero: event.target.value })} className={inputClass()} />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300">Complemento:</label>
          <input name="complemento" value={values.complemento} onChange={(event) => onChange({ complemento: event.target.value })} className={inputClass()} />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300">Bairro:</label>
          <input name="bairro" value={values.bairro} onChange={(event) => onChange({ bairro: event.target.value })} className={inputClass()} />
        </div>
        <div className="sm:col-span-2">
          <label className="font-bold text-slate-700 dark:text-slate-300">Cidade:</label>
          <input name="cidade" value={values.cidade} onChange={(event) => onChange({ cidade: event.target.value })} autoComplete="address-level2" className={inputClass()} />
        </div>
        <div>
          <label className="font-bold text-slate-700 dark:text-slate-300">Estado (UF):</label>
          <input name="estado" value={values.estado} onChange={(event) => onChange({ estado: formatUfInput(event.target.value) })} maxLength={2} autoComplete="address-level1" placeholder="MT" className={inputClass("font-bold uppercase")} />
        </div>
      </div>
    </fieldset>
  );
}
