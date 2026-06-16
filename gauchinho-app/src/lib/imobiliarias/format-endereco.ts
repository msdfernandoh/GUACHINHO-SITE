export type EnderecoImobiliariaInput = {
  endereco?: string | null;
  numero?: string | null;
  bairro?: string | null;
  complemento?: string | null;
  cidade?: string | null;
  estado?: string | null;
};

/** Monta endereço legível só com campos preenchidos. */
export function formatEnderecoImobiliaria(e: EnderecoImobiliariaInput): string | null {
  const rua = [e.endereco?.trim(), e.numero?.trim()].filter(Boolean).join(", ");
  const bairro = e.bairro?.trim() || null;
  const cidadeUf = [e.cidade?.trim(), e.estado?.trim()].filter(Boolean).join("/");
  const partes: string[] = [];
  if (rua) partes.push(rua);
  if (bairro) partes.push(bairro);
  if (cidadeUf) partes.push(cidadeUf);
  if (e.complemento?.trim()) partes.push(e.complemento.trim());
  if (!partes.length) return null;
  return partes.join(" - ");
}

export function temEnderecoVisivel(e: EnderecoImobiliariaInput): boolean {
  return !!(
    e.endereco?.trim() ||
    e.numero?.trim() ||
    e.bairro?.trim() ||
    e.cidade?.trim() ||
    e.estado?.trim()
  );
}
