export function buildWhatsappPropostaMessage(publicUrl: string): string {
  return `Olá! Conforme conversamos, segue o link para você conferir e confirmar sua proposta com o Gauchinho:

${publicUrl}

Ao acessar, você poderá confirmar os dados, preencher seu cadastro, enviar os documentos e escolher a forma de pagamento.`;
}

export function buildWhatsappLink(phoneDigits: string, message: string): string {
  const phone = phoneDigits.replace(/\D/g, "");
  if (!phone) return "";
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}
