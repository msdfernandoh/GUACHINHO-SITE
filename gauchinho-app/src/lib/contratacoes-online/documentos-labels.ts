export function formatTamanhoArquivo(bytes: number | null | undefined): string {
  if (bytes == null || !Number.isFinite(bytes)) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function labelTipoDocumento(tipo: string): string {
  const map: Record<string, string> = {
    documento_foto: "CNH ou RG",
    cpf: "CPF",
    cartao_cnpj: "Cartão CNPJ",
    documento_responsavel: "Documento do responsável",
    cpf_responsavel: "CPF do responsável",
    comprovante_endereco: "Comprovante de endereço",
    comprovante_pix: "Comprovante Pix",
    outro: "Outro",
  };
  return map[tipo] ?? tipo;
}
