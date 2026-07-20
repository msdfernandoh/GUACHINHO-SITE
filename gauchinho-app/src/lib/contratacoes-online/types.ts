export type ContratacaoOrigem = "simulador" | "grupos";

export type ContratacaoModo = "cliente_site" | "sdr_link";

export type ContratacaoStatus =
  | "link_gerado"
  | "proposta_aberta"
  | "proposta_confirmada"
  | "dados_preenchidos"
  | "documentos_enviados"
  | "pagamento_escolhido"
  | "aguardando_consultor"
  | "em_emissao_manual"
  | "finalizado"
  | "cancelado";

export type FormaPagamento = "pix" | "boleto" | "cartao";

export type TipoPessoa = "cpf" | "cnpj";

export type TipoDocumentoContratacao =
  | "documento_foto"
  | "cpf"
  | "cartao_cnpj"
  | "documento_responsavel"
  | "cpf_responsavel"
  | "comprovante_endereco"
  | "comprovante_pix"
  | "outro";

export type ContratacaoOnlineRow = {
  id: string;
  public_token: string;
  protocolo: string;
  origem: ContratacaoOrigem;
  status: ContratacaoStatus;
  lead_id: string | null;
  gerado_por_usuario_id: string | null;
  gerado_por_nome: string | null;
  gerado_por_email: string | null;
  nome: string | null;
  telefone: string | null;
  email: string | null;
  tipo_pessoa: TipoPessoa | null;
  cpf: string | null;
  data_nascimento: string | null;
  razao_social: string | null;
  cnpj: string | null;
  responsavel_nome: string | null;
  responsavel_cpf: string | null;
  cep: string | null;
  endereco: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  tipo_bem: string | null;
  credito_selecionado: number | null;
  parcela_estimada: number | null;
  prazo: number | null;
  grupo_id: string | null;
  grupo_nome: string | null;
  administradora: string | null;
  cota_id: string | null;
  dados_simulacao: Record<string, unknown>;
  forma_pagamento: FormaPagamento | null;
  pagamento_observacao: string | null;
  /** Observação livre do cliente (etapa documentos). */
  observacao_cliente?: string | null;
  pix_ativo_na_solicitacao: boolean;
  pix_chave: string | null;
  pix_recebedor: string | null;
  pix_instrucoes: string | null;
  pix_comprovante_url: string | null;
  /** Preenchido na API pública (sanitize); não persiste no banco. */
  pix_comprovante_enviado?: boolean;
  pix_status: string;
  confirmado_em: string | null;
  finalizado_em: string | null;
  primeiro_acesso_em: string | null;
  created_at: string;
  updated_at: string;
};

export type ContratacaoDocumentoRow = {
  id: string;
  contratacao_id: string;
  tipo_documento: TipoDocumentoContratacao;
  arquivo_url: string;
  arquivo_nome: string | null;
  mime_type: string | null;
  tamanho_bytes: number | null;
  created_at: string;
};

export type ContratacaoOnlineConfig = {
  pix_primeira_parcela_ativo: boolean;
  pix_chave: string;
  pix_recebedor: string;
  pix_instrucoes: string;
  comprovante_pix_obrigatorio: boolean;
};

export const STATUS_BLOQUEIA_EDICAO_PUBLICA: ContratacaoStatus[] = [
  "aguardando_consultor",
  "em_emissao_manual",
  "finalizado",
  "cancelado",
];

export type IniciarContratacaoBody = {
  modo: ContratacaoModo;
  origem: ContratacaoOrigem;
  dados_simulacao: Record<string, unknown>;
  cliente_pre_nome?: string;
  cliente_pre_telefone?: string;
  cliente_pre_email?: string;
  /** Consultor responsável pela proposta/lead (obrigatório no fluxo público). */
  consultor_id?: string;
  consultor_nome?: string;
};
