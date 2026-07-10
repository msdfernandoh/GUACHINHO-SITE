import type { EnderecoViaCep } from "./endereco";
import { sanitizeCep } from "./endereco";

type ViaCepJson = {
  logradouro?: string;
  bairro?: string;
  localidade?: string;
  uf?: string;
  erro?: boolean;
};

/** Busca endereço na API pública ViaCEP. Retorna null se CEP inválido, não encontrado ou falha de rede. */
export async function fetchEnderecoByCep(cep: string): Promise<EnderecoViaCep | null> {
  const digits = sanitizeCep(cep);
  if (digits.length !== 8) return null;

  try {
    const res = await fetch(`https://viacep.com.br/ws/${digits}/json/`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const json = (await res.json()) as ViaCepJson;
    if (json.erro || !json.localidade || !json.uf) return null;
    return {
      logradouro: json.logradouro?.trim() ?? "",
      bairro: json.bairro?.trim() ?? "",
      localidade: json.localidade.trim(),
      uf: json.uf.trim().toUpperCase(),
    };
  } catch {
    return null;
  }
}
