type ParticipanteRef = { id: string; usuario_id?: string | null };
type VinculoPerfilRef = { participante_id: string; perfil_id: string; papel_tipo: string };
type ModalidadeRef = { id: string; codigo: string };
type ModalidadeRegraRef = { id: string; isCadastradaNoBanco: boolean; percentualReferencia: number };

export function resolverModalidadeRegraId(params: {
  modalidadeAtualId?: string | null;
  modalidadePropostaId?: string | null;
  modalidadeGrupoId?: string | null;
  modalidades: ModalidadeRegraRef[];
}): string {
  const disponiveis = params.modalidades.filter(
    (item) => item.isCadastradaNoBanco && item.percentualReferencia > 0,
  );
  return disponiveis.find((item) => item.id === params.modalidadeAtualId)?.id
    ?? disponiveis.find((item) => item.id === params.modalidadePropostaId)?.id
    ?? disponiveis.find((item) => item.id === params.modalidadeGrupoId)?.id
    ?? (disponiveis.length === 1 ? disponiveis[0]?.id : undefined)
    ?? "";
}

export function resolverParticipantePrincipalId(params: {
  participantePersistidoId?: string | null;
  consultorUsuarioId?: string | null;
  participantes: ParticipanteRef[];
}): string {
  const persistido = params.participantePersistidoId?.trim();
  if (persistido && params.participantes.some((item) => item.id === persistido)) return persistido;

  const usuarioId = params.consultorUsuarioId?.trim();
  if (!usuarioId) return "";
  return params.participantes.find((item) => item.usuario_id === usuarioId)?.id ?? "";
}

export function resolverPerfilPrincipalId(params: {
  perfilPersistidoId?: string | null;
  participanteId: string;
  vinculos: VinculoPerfilRef[];
}): string {
  const vinculados = params.vinculos.filter((item) => item.participante_id === params.participanteId);
  const persistido = params.perfilPersistidoId?.trim();
  if (persistido && vinculados.some((item) => item.perfil_id === persistido)) return persistido;

  const perfisConsultor = vinculados.filter((item) => item.papel_tipo.toUpperCase() === "CONSULTOR");
  return perfisConsultor.length === 1 ? perfisConsultor[0]!.perfil_id : "";
}

export function resolverModalidadeComissaoId(params: {
  modalidadePersistidaId?: string | null;
  modalidades: ModalidadeRef[];
  dadosSimulacao?: Record<string, unknown> | null;
}): string {
  const persistida = params.modalidadePersistidaId?.trim();
  if (persistida && params.modalidades.some((item) => item.id === persistida)) return persistida;

  const selecoes = Array.isArray(params.dadosSimulacao?.selecoes) ? params.dadosSimulacao.selecoes : [];
  const primeira = (selecoes[0] ?? {}) as Record<string, unknown>;
  const config = (primeira.config ?? {}) as Record<string, unknown>;
  const modo = String(config.modalidadeParcela ?? "").toLowerCase();
  let codigo = "";
  if (modo === "integral") {
    codigo = "INTEGRAL";
  } else if (modo === "reduzida") {
    const percentual = Number(config.percentualParcelaReduzida ?? 60);
    codigo = percentual < 60 ? "REDUZIDA_ABAIXO_59" : "REDUZIDA_60_99";
  } else if (modo === "personalizada") {
    const percentual = Number(config.percentualParcelaPersonalizada);
    if (Number.isFinite(percentual) && percentual > 0) {
      codigo = percentual < 60 ? "REDUZIDA_ABAIXO_59" : percentual < 100 ? "REDUZIDA_60_99" : "INTEGRAL";
    }
  }
  return params.modalidades.find((item) => item.codigo.toUpperCase() === codigo)?.id ?? "";
}
