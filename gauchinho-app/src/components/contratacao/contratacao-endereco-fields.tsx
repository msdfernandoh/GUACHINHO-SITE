"use client";

import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/form-primitives";
import {
  formatCepBrInput,
  formatUfInput,
  sanitizeCep,
} from "@/lib/contratacoes-online/endereco";
import { fetchEnderecoByCep } from "@/lib/contratacoes-online/viacep";
import { wizardFieldLabelClass } from "@/components/contratacao/contratacao-doc-upload-field";
import { Label } from "@/components/ui/form-primitives";

function EnderecoLabel(props: React.LabelHTMLAttributes<HTMLLabelElement>) {
  return <Label className={wizardFieldLabelClass()} {...props} />;
}

export type EnderecoFormState = {
  cep: string;
  endereco: string;
  numero: string;
  complemento: string;
  bairro: string;
  cidade: string;
  uf: string;
};

type Props = {
  values: EnderecoFormState;
  onChange: (patch: Partial<EnderecoFormState>) => void;
};

export function ContratacaoEnderecoFields({ values, onChange }: Props) {
  const [cepAviso, setCepAviso] = useState<string | null>(null);
  const [cepBuscando, setCepBuscando] = useState(false);
  const lastFetchedCep = useRef<string>("");

  useEffect(() => {
    const digits = sanitizeCep(values.cep);
    if (digits.length !== 8) {
      setCepAviso(null);
      setCepBuscando(false);
      return;
    }
    if (digits === lastFetchedCep.current) return;

    let cancelled = false;
    setCepBuscando(true);
    setCepAviso(null);

    void (async () => {
      const found = await fetchEnderecoByCep(digits);
      if (cancelled) return;
      lastFetchedCep.current = digits;
      setCepBuscando(false);
      if (!found) {
        setCepAviso("Não encontramos o endereço pelo CEP. Preencha manualmente.");
        return;
      }
      onChange({
        endereco: found.logradouro || undefined,
        bairro: found.bairro || undefined,
        cidade: found.localidade,
        uf: found.uf,
      });
    })();

    return () => {
      cancelled = true;
    };
  }, [values.cep, onChange]);

  function onCepChange(raw: string) {
    const formatted = formatCepBrInput(raw);
    if (sanitizeCep(formatted) !== lastFetchedCep.current) {
      lastFetchedCep.current = "";
    }
    onChange({ cep: formatted });
  }

  return (
    <div className="space-y-4 border-t border-slate-800 pt-4">
      <h3 className="text-sm font-semibold uppercase tracking-wide text-amber-400/90">Endereço</h3>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <EnderecoLabel htmlFor="contratacao-cep">CEP</EnderecoLabel>
          <Input
            id="contratacao-cep"
            required
            value={values.cep}
            onChange={(e) => onCepChange(e.target.value)}
            className="mt-1"
            inputMode="numeric"
            placeholder="00000-000"
            autoComplete="postal-code"
          />
          {cepBuscando ? (
            <p className="mt-1 text-xs text-slate-500">Buscando endereço…</p>
          ) : null}
          {cepAviso ? <p className="mt-1 text-xs text-amber-300">{cepAviso}</p> : null}
        </div>
        <div>
          <EnderecoLabel htmlFor="contratacao-uf">UF</EnderecoLabel>
          <Input
            id="contratacao-uf"
            required
            value={values.uf}
            onChange={(e) => onChange({ uf: formatUfInput(e.target.value) })}
            className="mt-1 uppercase"
            maxLength={2}
            placeholder="MT"
            autoComplete="address-level1"
          />
        </div>
      </div>

      <div>
        <EnderecoLabel htmlFor="contratacao-endereco">Endereço / Rua / Avenida</EnderecoLabel>
        <Input
          id="contratacao-endereco"
          required
          value={values.endereco}
          onChange={(e) => onChange({ endereco: e.target.value })}
          className="mt-1"
          autoComplete="street-address"
        />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <EnderecoLabel htmlFor="contratacao-numero">Número</EnderecoLabel>
          <Input
            id="contratacao-numero"
            required
            value={values.numero}
            onChange={(e) => onChange({ numero: e.target.value })}
            className="mt-1"
          />
        </div>
        <div>
          <EnderecoLabel htmlFor="contratacao-complemento">Complemento (opcional)</EnderecoLabel>
          <Input
            id="contratacao-complemento"
            value={values.complemento}
            onChange={(e) => onChange({ complemento: e.target.value })}
            className="mt-1"
          />
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <div>
          <EnderecoLabel htmlFor="contratacao-bairro">Bairro</EnderecoLabel>
          <Input
            id="contratacao-bairro"
            required
            value={values.bairro}
            onChange={(e) => onChange({ bairro: e.target.value })}
            className="mt-1"
            autoComplete="address-level2"
          />
        </div>
        <div>
          <EnderecoLabel htmlFor="contratacao-cidade">Cidade</EnderecoLabel>
          <Input
            id="contratacao-cidade"
            required
            value={values.cidade}
            onChange={(e) => onChange({ cidade: e.target.value })}
            className="mt-1"
            autoComplete="address-level2"
          />
        </div>
      </div>
    </div>
  );
}
