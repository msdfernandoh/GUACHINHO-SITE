export function senhaInicialIndicador(cpf: string) {
  const digitos = cpf.replace(/\D/g, "");
  if (!/^\d{11}$/.test(digitos)) {
    throw new Error("CPF inválido para gerar a senha inicial.");
  }
  return digitos.slice(-6);
}
