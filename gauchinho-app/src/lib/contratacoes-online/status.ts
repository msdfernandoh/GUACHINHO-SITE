import type { ContratacaoStatus } from "./types";

export function statusPermiteEdicaoPublica(status: ContratacaoStatus): boolean {
  return ![
    "aguardando_consultor",
    "em_emissao_manual",
    "finalizado",
    "cancelado",
  ].includes(status);
}

export function statusLabel(status: ContratacaoStatus): string {
  const map: Record<ContratacaoStatus, string> = {
    link_gerado: "Link gerado",
    proposta_aberta: "Proposta aberta",
    proposta_confirmada: "Proposta confirmada",
    dados_preenchidos: "Dados preenchidos",
    documentos_enviados: "Documentos enviados",
    pagamento_escolhido: "Pagamento escolhido",
    aguardando_consultor: "Aguardando consultor",
    em_emissao_manual: "Em emissão manual",
    finalizado: "Finalizado",
    cancelado: "Cancelado",
  };
  return map[status] ?? status;
}
