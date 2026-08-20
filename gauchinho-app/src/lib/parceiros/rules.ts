import {
  FASE3_PAPEL_PERMISSOES,
  FASE3_PERMISSOES,
  LEAD_STATUS_SIMPLES_PARCEIRO,
  ORGANIZACAO_STATUS,
  ORGANIZACAO_TIPOS,
  PARTICIPANTE_STATUS,
  PARTICIPANTE_TIPOS,
  PROPOSTA_STATUS_EDITAVEL_PARCEIRO,
  type OrganizacaoStatus,
  type OrganizacaoTipo,
  type ParticipanteStatus,
  type ParticipanteTipoCodigo,
} from "./constants";
import { normalizeCnpj, normalizeCpf, normalizeEmail, normalizeSlug } from "./normalize";

export type RuleResult = { ok: true } | { ok: false; error: string };

export function isParticipanteStatus(v: string): v is ParticipanteStatus {
  return (PARTICIPANTE_STATUS as readonly string[]).includes(v);
}

export function isParticipanteTipo(v: string): v is ParticipanteTipoCodigo {
  return (PARTICIPANTE_TIPOS as readonly string[]).includes(v);
}

export function isOrganizacaoTipo(v: string): v is OrganizacaoTipo {
  return (ORGANIZACAO_TIPOS as readonly string[]).includes(v);
}

export function isOrganizacaoStatus(v: string): v is OrganizacaoStatus {
  return (ORGANIZACAO_STATUS as readonly string[]).includes(v);
}

/** Participante pode existir sem login. */
export function validateParticipanteCreateInput(input: {
  empresaId: string;
  nome: string;
  tipos: string[];
  status: string;
  telefone?: string | null;
  whatsapp?: string | null;
  cpf?: string | null;
  email?: string | null;
  usuarioId?: string | null;
}): RuleResult {
  if (!input.empresaId?.trim()) return { ok: false, error: "empresa_id é obrigatório." };
  if (!input.nome?.trim()) return { ok: false, error: "Nome é obrigatório." };
  if (!isParticipanteStatus(input.status)) return { ok: false, error: "Status inválido." };
  if (!input.tipos?.length) return { ok: false, error: "Informe ao menos um tipo." };
  for (const t of input.tipos) {
    if (!isParticipanteTipo(t)) return { ok: false, error: `Tipo inválido: ${t}` };
  }
  const tel = input.telefone?.trim();
  const wa = input.whatsapp?.trim();
  const email = input.email?.trim();
  if (!tel && !wa && !email && !input.usuarioId) {
    return { ok: false, error: "Informe ao menos um meio de contato (WhatsApp, telefone ou e-mail)." };
  }
  if (input.cpf) {
    if (!normalizeCpf(input.cpf)) return { ok: false, error: "CPF inválido." };
  }
  if (input.email) {
    if (!normalizeEmail(input.email)) return { ok: false, error: "E-mail inválido." };
  }
  if (input.status === "ATIVO" && input.usuarioId) {
    // ok — vínculo opcional
  }
  return { ok: true };
}

/**
 * No MVP: no máximo um participante ATIVO por usuario_id na mesma empresa.
 * Em empresas diferentes: permitido.
 */
export function canLinkUsuarioToParticipante(input: {
  usuarioId: string;
  empresaId: string;
  existingActiveLinks: Array<{ participanteId: string; empresaId: string; usuarioId: string }>;
  participanteId?: string;
}): RuleResult {
  const conflict = input.existingActiveLinks.find(
    (l) =>
      l.usuarioId === input.usuarioId &&
      l.empresaId === input.empresaId &&
      l.participanteId !== input.participanteId
  );
  if (conflict) {
    return {
      ok: false,
      error: "Já existe participante ATIVO vinculado a este usuário nesta empresa.",
    };
  }
  return { ok: true };
}

export function validateGestorMesmaEmpresa(input: {
  participanteEmpresaId: string;
  gestorEmpresaId: string | null | undefined;
}): RuleResult {
  if (!input.gestorEmpresaId) return { ok: true };
  if (input.gestorEmpresaId !== input.participanteEmpresaId) {
    return { ok: false, error: "Gestor deve pertencer à mesma empresa." };
  }
  return { ok: true };
}

export function validateOrganizacaoCreateInput(input: {
  empresaId: string;
  tipo: string;
  nomeFantasia: string;
  status: string;
  telefone?: string | null;
  whatsapp?: string | null;
  cnpj?: string | null;
}): RuleResult {
  if (!input.empresaId?.trim()) return { ok: false, error: "empresa_id é obrigatório." };
  if (!isOrganizacaoTipo(input.tipo)) return { ok: false, error: "Tipo de organização inválido." };
  if (!input.nomeFantasia?.trim()) return { ok: false, error: "Nome fantasia é obrigatório." };
  if (!isOrganizacaoStatus(input.status)) return { ok: false, error: "Status inválido." };
  if (!input.telefone?.trim() && !input.whatsapp?.trim()) {
    return { ok: false, error: "Informe telefone ou WhatsApp." };
  }
  if (input.cnpj && !normalizeCnpj(input.cnpj)) {
    return { ok: false, error: "CNPJ inválido." };
  }
  return { ok: true };
}

/** CNPJ único por tenant quando preenchido; permitido em tenants distintos. */
export function validateCnpjUnicoNoTenant(input: {
  empresaId: string;
  cnpj: string | null | undefined;
  existing: Array<{ id: string; empresaId: string; cnpj: string | null }>;
  organizacaoId?: string;
}): RuleResult {
  const cnpj = input.cnpj ? normalizeCnpj(input.cnpj) : null;
  if (!cnpj) return { ok: true };
  const dup = input.existing.find(
    (o) => o.empresaId === input.empresaId && o.cnpj === cnpj && o.id !== input.organizacaoId
  );
  if (dup) return { ok: false, error: "CNPJ já cadastrado nesta empresa." };
  return { ok: true };
}

export function validateVinculoParticipanteOrganizacao(input: {
  participanteEmpresaId: string;
  organizacaoEmpresaId: string;
}): RuleResult {
  if (input.participanteEmpresaId !== input.organizacaoEmpresaId) {
    return { ok: false, error: "Participante e organização devem ser da mesma empresa." };
  }
  return { ok: true };
}

/** No máximo um responsável principal ativo por organização. */
export function validateResponsavelPrincipalUnico(input: {
  organizacaoId: string;
  settingPrincipal: boolean;
  ativo: boolean;
  existingPrincipals: Array<{ id: string; organizacaoId: string; ativo: boolean }>;
  vinculoId?: string;
}): RuleResult {
  if (!input.settingPrincipal || !input.ativo) return { ok: true };
  const other = input.existingPrincipals.find(
    (p) =>
      p.organizacaoId === input.organizacaoId &&
      p.ativo &&
      p.id !== input.vinculoId
  );
  if (other) {
    return { ok: false, error: "Já existe responsável principal ativo nesta organização." };
  }
  return { ok: true };
}

/** MVP: no máximo um site ativo (não arquivado) por organização. */
export function validateSiteAtivoUnicoPorOrg(input: {
  organizacaoId: string;
  ativo: boolean;
  statusPublicacao: string;
  existingActiveSites: Array<{ id: string; organizacaoId: string }>;
  siteId?: string;
}): RuleResult {
  if (!input.ativo || input.statusPublicacao === "ARQUIVADO") return { ok: true };
  const other = input.existingActiveSites.find(
    (s) => s.organizacaoId === input.organizacaoId && s.id !== input.siteId
  );
  if (other) {
    return { ok: false, error: "Organização já possui um site ativo no MVP." };
  }
  return { ok: true };
}

export function validateSlugUnicoPorEmpresa(input: {
  empresaId: string;
  slug: string;
  existing: Array<{ id: string; empresaId: string; slug: string }>;
  siteId?: string;
}): RuleResult {
  const slug = normalizeSlug(input.slug);
  if (!slug) return { ok: false, error: "Slug inválido." };
  const dup = input.existing.find(
    (s) => s.empresaId === input.empresaId && s.slug === slug && s.id !== input.siteId
  );
  if (dup) return { ok: false, error: "Slug já usado nesta empresa." };
  return { ok: true };
}

export function validateDominioUnico(input: {
  valor: string;
  existingParceiroHosts: string[];
  existingEmpresaHosts: string[];
}): RuleResult {
  const valor = input.valor.trim().toLowerCase();
  if (input.existingParceiroHosts.includes(valor)) {
    return { ok: false, error: "Domínio já cadastrado em site de parceiro." };
  }
  if (input.existingEmpresaHosts.includes(valor)) {
    return { ok: false, error: "Domínio conflita com empresa_dominios (tenant)." };
  }
  return { ok: true };
}

export function papelTemPermissao(papelCodigo: string, permissao: string): boolean {
  const list = FASE3_PAPEL_PERMISSOES[papelCodigo] ?? [];
  return list.includes(permissao);
}

export function parceiroPodeEditarSite(papelCodigo: string): boolean {
  return papelTemPermissao(papelCodigo, FASE3_PERMISSOES.gerenciarSites);
}

/**
 * Visibilidade de leads/propostas na área comercial (regra de app; RLS partner adiada).
 * - responsável principal: toda a org
 * - demais: só vínculos próprios, salvo visão ampliada
 */
export function podeVerRegistroComercial(input: {
  isResponsavelPrincipal: boolean;
  temVisaoAmpliada: boolean;
  /** Tipo RESPONSAVEL_PARCEIRO no participante (além de responsavel_principal no vínculo). */
  isResponsavelParceiroTipo?: boolean;
  registroOrganizacaoId: string | null;
  registroParticipantId: string | null;
  orgsDoUsuario: string[];
  participantIdAtual: string | null;
}): boolean {
  if (!input.registroOrganizacaoId) return false;
  if (!input.orgsDoUsuario.includes(input.registroOrganizacaoId)) return false;
  if (
    input.isResponsavelPrincipal ||
    input.isResponsavelParceiroTipo ||
    input.temVisaoAmpliada
  ) {
    return true;
  }
  if (!input.participantIdAtual || !input.registroParticipantId) return false;
  return input.registroParticipantId === input.participantIdAtual;
}

export function propostaStatusEditavelParceiro(status: string | null | undefined): boolean {
  return (PROPOSTA_STATUS_EDITAVEL_PARCEIRO as readonly string[]).includes(status ?? "");
}

export function leadStatusSimplesParceiro(status: string): boolean {
  return (LEAD_STATUS_SIMPLES_PARCEIRO as readonly string[]).includes(status);
}

/** Campos seguros de UPDATE na área parceiro — never trust client empresa/org. */
export function sanitizeLeadUpdateParceiro(input: {
  nome?: string | null;
  whatsapp?: string | null;
  email?: string | null;
  observacoes?: string | null;
  status?: string | null;
  empresa_id?: string | null;
  organizacao_parceira_id?: string | null;
  participant_id?: string | null;
}): { ok: true; data: Record<string, unknown> } | { ok: false; error: string } {
  if (input.empresa_id !== undefined) {
    return { ok: false, error: "empresa_id não pode ser alterado." };
  }
  if (input.organizacao_parceira_id !== undefined) {
    return { ok: false, error: "organizacao_parceira_id não pode ser alterado." };
  }
  const data: Record<string, unknown> = {};
  if (input.nome !== undefined) {
    const nome = String(input.nome ?? "").trim();
    if (!nome) return { ok: false, error: "Nome é obrigatório." };
    data.nome = nome;
  }
  if (input.whatsapp !== undefined) {
    data.whatsapp = String(input.whatsapp ?? "").trim() || null;
  }
  if (input.email !== undefined) {
    const email = String(input.email ?? "").trim() || null;
    if (email && !normalizeEmail(email)) return { ok: false, error: "E-mail inválido." };
    data.email = email;
  }
  if (input.observacoes !== undefined) {
    data.observacoes = String(input.observacoes ?? "").trim() || null;
  }
  if (input.status !== undefined) {
    const status = String(input.status ?? "").trim();
    if (!leadStatusSimplesParceiro(status)) {
      return { ok: false, error: "Status comercial não permitido na área parceiro." };
    }
    data.status = status;
  }
  if (input.participant_id !== undefined) {
    // Troca de responsável só via action dedicada com validação de org.
    return { ok: false, error: "participant_id deve ser alterado por fluxo validado." };
  }
  return { ok: true, data };
}

export function assertOrgNoContextoArea(input: {
  orgId: string;
  orgsDoUsuario: string[];
}): RuleResult {
  if (!input.orgsDoUsuario.includes(input.orgId)) {
    return { ok: false, error: "Organização fora do contexto." };
  }
  return { ok: true };
}

export function podePublicarSite(input: {
  organizacaoStatus: string;
  brandingMinimoOk: boolean;
  menusValidos: boolean;
  canalPrincipal: "ROTA" | "SUBDOMINIO" | "DOMINIO";
  dominioPrincipalVerificado: boolean;
  sslReady: boolean;
  empresaAutorizou: boolean;
}): RuleResult {
  if (input.organizacaoStatus !== "ATIVA") {
    return { ok: false, error: "Organização precisa estar ATIVA." };
  }
  if (!input.brandingMinimoOk) return { ok: false, error: "Branding mínimo incompleto." };
  if (!input.menusValidos) return { ok: false, error: "Menus inválidos." };
  if (!input.empresaAutorizou) return { ok: false, error: "Empresa não autorizou publicação." };
  if (input.canalPrincipal !== "ROTA") {
    if (!input.dominioPrincipalVerificado) {
      return { ok: false, error: "Domínio principal não verificado." };
    }
    if (!input.sslReady) return { ok: false, error: "SSL não está READY." };
  }
  return { ok: true };
}
