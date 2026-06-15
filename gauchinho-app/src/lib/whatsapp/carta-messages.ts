export type WhatsappOrigemRow = {
  origem: string;
  ativo: boolean;
  exibir_botao_apos_lead: boolean;
  nome_atendimento: string | null;
  whatsapp_destino: string | null;
  mensagem_padrao: string | null;
  usar_whatsapp_principal_fallback: boolean;
};

export function buildCartaInteresseMensagem(params: {
  tipoLabel: string;
  credito: number | null;
  nome: string;
  mensagemPadrao?: string | null;
}): string {
  if (params.mensagemPadrao?.trim()) return params.mensagemPadrao.trim();
  const creditoFmt =
    params.credito != null
      ? new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(params.credito)
      : "—";
  return `Olá, tenho interesse na carta contemplada de ${params.tipoLabel} com crédito de ${creditoFmt}. Meu nome é ${params.nome}.`;
}
