"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireErpRouteAccess } from "@/lib/erp/erp-acesso-server";
import { encryptCredential } from "@/lib/automacoes/robos/cryptoService";

export type FranquiaRoboDTO = {
  id: string;
  empresaId: string;
  nome: string;
  tipoRotina: "FRANQUIA_LANCES_AUTOMATICOS" | "FRANQUIA_DOWNLOAD_BOLETOS";
  portalTipo: string;
  siteUrl: string;
  loginUrl: string;
  usuarioLogin: string;
  temSenha: boolean;
  ativo: boolean;
  modo: "DRY_RUN" | "PRODUCAO";
  ultimaExecucaoEm: string | null;
  ultimoSucessoEm: string | null;
  ultimoErro: string | null;
  configuracaoTarefas: {
    tipo_rotina: string;
    descricao: string;
    ponto_venda?: string;
    frequencias?: Array<{ tipo: string; descricao: string; dia_corte?: number; intervalo_meses?: number }>;
    modulo_erp_alvo?: string;
    rotas_portal?: Record<string, string>;
    etapas_mapeamento?: string[];
    [key: string]: unknown;
  };
};

export type RobosDashboardStats = {
  totalCotasCarteira: number;
  cotasComLanceDefinido: number;
  cotasAguardandoLance: number;
  boletosCompetenciaTotal: number;
  boletosBaixadosSucesso: number;
  boletosPendentes: number;
  ultimaExecucaoLances: string | null;
  ultimaExecucaoBoletos: string | null;
};

export type RoboExecucaoItemDTO = {
  id: string;
  roboConfigId: string;
  roboNome?: string;
  status: "PENDENTE" | "PROCESSANDO" | "SUCESSO" | "JA_IMPORTADO" | "ERRO" | "CANCELADO";
  origem: string;
  iniciadoEm: string;
  finalizadoEm: string | null;
  erroMensagem: string | null;
  detalhes: Record<string, unknown>;
  totalItens?: number;
};

const TEMPLATE_ROBO_LANCES = {
  nome: "Robô Racon — Lances Automáticos (Franquia)",
  portal_tipo: "RACON",
  site_url: "https://nwcweb.randonconsorcios.com.br/",
  login_url: "https://e.randonconsorcios.com.br/",
  usuario_login: "",
  ativo: true,
  modo: "PRODUCAO" as const,
  configuracao_tarefas: {
    tipo_rotina: "FRANQUIA_LANCES_AUTOMATICOS",
    descricao: "Dar lances automáticos a cada nova venda uma vez por mês e atualizar as estratégias e valores de lances a cada 6 meses, sincronizando a tela de Lances do ERP.",
    frequencias: [
      { tipo: "MENSAL", descricao: "Novas vendas no mês", dia_corte: 10 },
      { tipo: "SEMESTRAL", descricao: "Reavaliação e atualização a cada 6 meses", intervalo_meses: 6 },
    ],
    modulo_erp_alvo: "/erp/lances",
    rotas_portal: {
      login_sso: "https://e.randonconsorcios.com.br/",
      newcon_web: "https://nwcweb.randonconsorcios.com.br/frmMain.aspx",
      oferta_lance: "CONCP/frmConCpPrcOfertaLance.aspx",
    },
    etapas_mapeamento: [
      "1. Autenticação SSO Microsoft / Racon",
      "2. Acesso ao Newcon Web e seleção do Ponto de Venda da Franquia",
      "3. Navegação: Contemplação > Oferta de Lance",
      "4. Localização do Grupo e Cota da venda",
      "5. Preenchimento da modalidade de lance (Livre, Fixo 25%, 40% ou Fidelidade)",
      "6. Confirmação da oferta e captura do protocolo / recibo",
      "7. Atualização automática do status da cota na tela /erp/lances",
    ],
  },
};

const TEMPLATE_ROBO_BOLETOS = {
  nome: "Robô Racon — Boletos Mensais (Download & Armazenamento)",
  portal_tipo: "RACON",
  site_url: "https://nwcweb.randonconsorcios.com.br/",
  login_url: "https://e.randonconsorcios.com.br/",
  usuario_login: "",
  ativo: true,
  modo: "PRODUCAO" as const,
  configuracao_tarefas: {
    tipo_rotina: "FRANQUIA_DOWNLOAD_BOLETOS",
    descricao: "Acessa o Newcon Web pelo ícone de consorciados, localiza cada grupo e cota da franquia, entra em Emissão de Cobrança, emite e baixa o boleto em PDF, extrai a chave Pix Copia e Cola em texto e salva no Supabase Storage vinculado ao ERP.",
    frequencias: [
      { tipo: "MENSAL", descricao: "Download e captura no fechamento de cada competência", dia_corte: 5 },
    ],
    modulo_erp_alvo: "/erp/vendas",
    rotas_portal: {
      login_sso: "https://e.randonconsorcios.com.br/",
      newcon_web: "https://nwcweb.randonconsorcios.com.br/frmMain.aspx",
      localizar_consorciado: "CONAT/frmConAtSrcConsorciado.aspx",
      atendimento_consorciado: "CONAT/frmConAtCnsAtendimento.aspx",
      emissao_cobranca: "CONCO/frmConCoRelBoletoAvulso.aspx",
    },
    etapas_mapeamento: [
      "1. Autenticação SSO Microsoft / Racon",
      "2. Acesso ao Newcon Web (frmMain.aspx) e seleção de empresa 0101 Randon Administradora",
      "3. Clicar no ícone de dois bonequinhos (Consorciado / Atendimento - frmConAtSrcConsorciado.aspx)",
      "4. Preencher Grupo e Cota do consorciado e clicar em Localizar",
      "5. No menu lateral Operações, clicar em 'Emissão de Cobrança'",
      "6. Na tela de Boleto Avulso (frmConCoRelBoletoAvulso.aspx), marcar a cobrança pendente e clicar em [Emitir Cobrança]",
      "7. Realizar o download do arquivo PDF do boleto",
      "8. Extrair o código QR Code Pix (chave Copia e Cola em texto) e linha digitável",
      "9. Fazer o upload do PDF no Supabase Storage (bucket boletos-cotas)",
      "10. Atualizar e vincular na tabela de boletos do ERP em Vendas & Cotas para disparo de WhatsApp",
    ],
  },
};

export async function fetchFranquiaRobosAction() {
  const { usuario, empresaAtiva } = await requireErpRouteAccess("robos");
  const admin = createAdminClient();

  const empresaId = empresaAtiva.id;

  // 1. Busca robôs configurados especificamente para esta franquia
  const { data: dbConfigs, error: errConfigs } = await admin
    .from("robo_configuracoes")
    .select("id, empresa_id, administradora_id, nome, portal_tipo, site_url, login_url, usuario_login, senha_encrypted, ativo, modo, ultima_execucao_em, ultimo_sucesso_em, ultimo_erro, configuracao_tarefas")
    .eq("empresa_id", empresaId);

  let configs = dbConfigs || [];

  // Se a franquia ainda não tiver os 2 robôs criados, provisiona os templates iniciais
  const temRoboLances = configs.some(
    (c) => c.configuracao_tarefas?.tipo_rotina === "FRANQUIA_LANCES_AUTOMATICOS"
  );
  const temRoboBoletos = configs.some(
    (c) => c.configuracao_tarefas?.tipo_rotina === "FRANQUIA_DOWNLOAD_BOLETOS"
  );

  // Busca credenciais globais da Racon para reaproveitar na franquia caso necessário
  const { data: globalRacon } = await admin
    .from("robo_configuracoes")
    .select("usuario_login, senha_encrypted, administradora_id")
    .ilike("nome", "%Racon%")
    .not("senha_encrypted", "is", null)
    .limit(1)
    .maybeSingle();

  if (!temRoboLances) {
    const { data: newLances } = await admin
      .from("robo_configuracoes")
      .insert({
        empresa_id: empresaId,
        nome: TEMPLATE_ROBO_LANCES.nome,
        portal_tipo: TEMPLATE_ROBO_LANCES.portal_tipo,
        site_url: TEMPLATE_ROBO_LANCES.site_url,
        login_url: TEMPLATE_ROBO_LANCES.login_url,
        usuario_login: globalRacon?.usuario_login || TEMPLATE_ROBO_LANCES.usuario_login,
        senha_encrypted: globalRacon?.senha_encrypted || null,
        administradora_id: globalRacon?.administradora_id || null,
        ativo: TEMPLATE_ROBO_LANCES.ativo,
        modo: TEMPLATE_ROBO_LANCES.modo,
        configuracao_tarefas: TEMPLATE_ROBO_LANCES.configuracao_tarefas,
        created_by: usuario.id,
      })
      .select()
      .single();

    if (newLances) configs.push(newLances);
  }

  if (!temRoboBoletos) {
    const { data: newBoletos } = await admin
      .from("robo_configuracoes")
      .insert({
        empresa_id: empresaId,
        nome: TEMPLATE_ROBO_BOLETOS.nome,
        portal_tipo: TEMPLATE_ROBO_BOLETOS.portal_tipo,
        site_url: TEMPLATE_ROBO_BOLETOS.site_url,
        login_url: TEMPLATE_ROBO_BOLETOS.login_url,
        usuario_login: globalRacon?.usuario_login || TEMPLATE_ROBO_BOLETOS.usuario_login,
        senha_encrypted: globalRacon?.senha_encrypted || null,
        administradora_id: globalRacon?.administradora_id || null,
        ativo: TEMPLATE_ROBO_BOLETOS.ativo,
        modo: TEMPLATE_ROBO_BOLETOS.modo,
        configuracao_tarefas: TEMPLATE_ROBO_BOLETOS.configuracao_tarefas,
        created_by: usuario.id,
      })
      .select()
      .single();

    if (newBoletos) configs.push(newBoletos);
  }

  // Se algum robô da franquia estiver sem senha mas existir a global, preenche automaticamente
  if (globalRacon?.senha_encrypted) {
    for (const c of configs) {
      if (!c.senha_encrypted) {
        await admin
          .from("robo_configuracoes")
          .update({
            senha_encrypted: globalRacon.senha_encrypted,
            usuario_login: c.usuario_login || globalRacon.usuario_login,
            administradora_id: c.administradora_id || globalRacon.administradora_id,
          })
          .eq("id", c.id);
        c.senha_encrypted = globalRacon.senha_encrypted;
        c.usuario_login = c.usuario_login || globalRacon.usuario_login;
      }
    }
  }

  // 2. Transforma para DTO
  const robos: FranquiaRoboDTO[] = configs.map((c) => {
    const tRotina = (c.configuracao_tarefas?.tipo_rotina as any) || "FRANQUIA_LANCES_AUTOMATICOS";
    return {
      id: c.id,
      empresaId: c.empresa_id,
      nome: c.nome,
      tipoRotina: tRotina,
      portalTipo: c.portal_tipo,
      siteUrl: c.site_url,
      loginUrl: c.login_url,
      usuarioLogin: c.usuario_login || "",
      temSenha: Boolean(c.senha_encrypted),
      ativo: c.ativo,
      modo: c.modo as any,
      ultimaExecucaoEm: c.ultima_execucao_em,
      ultimoSucessoEm: c.ultimo_sucesso_em,
      ultimoErro: c.ultimo_erro,
      configuracaoTarefas: c.configuracao_tarefas || {},
    };
  });

  // 3. Estatísticas da carteira de cotas e lances da franquia
  const { count: totalCotas } = await admin
    .from("cotas_definitivas")
    .select("*", { count: "exact", head: true })
    .eq("empresa_id", empresaId);

  const { data: cotasEstrategias } = await admin
    .from("cotas_definitivas")
    .select("id, cotas_lances_estrategias(id, lance_livre_ativo, lance_fixo_ativo, segundo_lance_fixo_ativo)")
    .eq("empresa_id", empresaId);

  let cotasComLance = 0;
  for (const c of cotasEstrategias || []) {
    const est = (c as any).cotas_lances_estrategias?.[0];
    if (est && (est.lance_livre_ativo || est.lance_fixo_ativo || est.segundo_lance_fixo_ativo)) {
      cotasComLance++;
    }
  }

  const cotasPendentesLance = Math.max(0, (totalCotas || 0) - cotasComLance);

  // 4. Histórico recente de execuções
  const roboIds = configs.map((c) => c.id);
  let historico: RoboExecucaoItemDTO[] = [];
  if (roboIds.length > 0) {
    const { data: execs } = await admin
      .from("robo_execucoes")
      .select("id, robo_config_id, status, origem, iniciado_em, finalizado_em, erro_mensagem, detalhes")
      .in("robo_config_id", roboIds)
      .order("iniciado_em", { ascending: false })
      .limit(20);

    const mapNomes = new Map(configs.map((c) => [c.id, c.nome]));
    historico = (execs || []).map((e) => ({
      id: e.id,
      roboConfigId: e.robo_config_id,
      roboNome: mapNomes.get(e.robo_config_id) || "Robô da Franquia",
      status: e.status as any,
      origem: e.origem,
      iniciadoEm: e.iniciado_em,
      finalizadoEm: e.finalizado_em,
      erroMensagem: e.erro_mensagem,
      detalhes: e.detalhes || {},
    }));
  }

  const roboLances = robos.find((r) => r.tipoRotina === "FRANQUIA_LANCES_AUTOMATICOS");
  const roboBoletos = robos.find((r) => r.tipoRotina === "FRANQUIA_DOWNLOAD_BOLETOS");

  const stats: RobosDashboardStats = {
    totalCotasCarteira: totalCotas || 0,
    cotasComLanceDefinido: cotasComLance,
    cotasAguardandoLance: cotasPendentesLance,
    boletosCompetenciaTotal: totalCotas || 0,
    boletosBaixadosSucesso: 0,
    boletosPendentes: totalCotas || 0,
    ultimaExecucaoLances: roboLances?.ultimaExecucaoEm || null,
    ultimaExecucaoBoletos: roboBoletos?.ultimaExecucaoEm || null,
  };

  return {
    empresaId,
    empresaNome: empresaAtiva.nome_fantasia || "Franquia",
    robos,
    stats,
    historico,
  };
}

export async function salvarConfiguracaoRoboFranquiaAction(input: {
  id: string;
  usuarioLogin: string;
  senha?: string;
  ativo: boolean;
  modo: "DRY_RUN" | "PRODUCAO";
  pontoVenda?: string;
  diaCorte?: number;
}) {
  const { usuario, empresaAtiva } = await requireErpRouteAccess("robos");
  const admin = createAdminClient();

  const updateData: Record<string, unknown> = {
    usuario_login: input.usuarioLogin.trim(),
    ativo: input.ativo,
    modo: input.modo,
    updated_by: usuario.id,
    updated_at: new Date().toISOString(),
  };

  if (input.senha && input.senha.trim().length > 0) {
    updateData.senha_encrypted = encryptCredential(input.senha.trim());
    updateData.senha_updated_at = new Date().toISOString();
  }

  // Atualiza tarefas / ponto de venda
  const { data: current } = await admin
    .from("robo_configuracoes")
    .select("configuracao_tarefas")
    .eq("id", input.id)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  const cfgTarefas = { ...(current?.configuracao_tarefas || {}) };
  if (input.pontoVenda) cfgTarefas.ponto_venda = input.pontoVenda.trim();
  if (input.diaCorte) cfgTarefas.dia_corte = input.diaCorte;
  updateData.configuracao_tarefas = cfgTarefas;

  const { error } = await admin
    .from("robo_configuracoes")
    .update(updateData)
    .eq("id", input.id)
    .eq("empresa_id", empresaAtiva.id);

  if (error) {
    throw new Error(`Falha ao salvar configuração do robô: ${error.message}`);
  }

  revalidatePath("/erp/robos");
  return { success: true };
}

export async function executarRoboFranquiaAction(roboConfigId: string) {
  const { usuario, empresaAtiva } = await requireErpRouteAccess("robos");
  const admin = createAdminClient();

  // Valida pertencimento
  const { data: robo, error: errRobo } = await admin
    .from("robo_configuracoes")
    .select("id, empresa_id, portal_tipo, modo, configuracao_tarefas")
    .eq("id", roboConfigId)
    .eq("empresa_id", empresaAtiva.id)
    .single();

  if (errRobo || !robo) {
    throw new Error("Robô não encontrado ou sem permissão para esta franquia.");
  }

  // Cria registro na fila de execuções
  const { data: novaExecucao, error: errExec } = await admin
    .from("robo_execucoes")
    .insert({
      empresa_id: empresaAtiva.id,
      robo_config_id: robo.id,
      portal_tipo: robo.portal_tipo,
      status: "PENDENTE",
      origem: "UI_MANUAL",
      dry_run: robo.modo === "DRY_RUN",
      parametros: {
        tipo_rotina: robo.configuracao_tarefas?.tipo_rotina,
        solicitado_em: new Date().toISOString(),
      },
      iniciado_por: usuario.id,
      iniciado_em: new Date().toISOString(),
    })
    .select()
    .single();

  if (errExec || !novaExecucao) {
    throw new Error(`Erro ao enfileirar execução: ${errExec?.message}`);
  }

  revalidatePath("/erp/robos");
  return { success: true, execucaoId: novaExecucao.id };
}
