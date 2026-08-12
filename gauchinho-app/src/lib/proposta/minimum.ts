export function propostaMinimumValid(input: { nome?: string | null; telefone?: string | null }) {
  const nome = input.nome?.trim() ?? "";
  const telefone = (input.telefone ?? "").replace(/\D/g, "");
  return nome.length > 0 && telefone.length >= 10;
}

export function assertPropostaMinimum(input: { nome?: string | null; telefone?: string | null }) {
  if (!propostaMinimumValid(input)) {
    throw new Error("A proposta exige nome e telefone/WhatsApp válido.");
  }
}
