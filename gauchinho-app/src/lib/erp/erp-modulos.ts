export const ERP_MODULES = [
  { id: "painel", label: "Painel", href: "/erp" },
  { id: "leads", label: "Leads / CRM", href: "/erp/leads" },
  { id: "propostas", label: "Propostas", href: "/erp/propostas" },
  { id: "contratacoes", label: "Contratações", href: "/erp/contratacoes" },
  { id: "vendas", label: "Vendas e Cotas", href: "/erp/vendas" },
  { id: "grupos", label: "Grupos", href: "/erp/grupos" },
  { id: "comissoes", label: "Comissões", href: "/erp/comissoes" },
  { id: "financeiro", label: "Financeiro e Caixa", href: "/erp/financeiro" },
  { id: "relatorios", label: "Relatórios", href: "/erp/relatorios" },
  { id: "metas", label: "Metas", href: "/erp/metas" },
  { id: "tarefas", label: "Tarefas", href: "/erp/tarefas" },
  { id: "usuarios", label: "Usuários", href: "/erp/usuarios" },
] as const;

export type ErpModuleId = (typeof ERP_MODULES)[number]["id"];

export type ErpSistemaConfig = {
  habilitado: boolean;
  modulos: ErpModuleId[];
};

const MODULE_IDS = new Set<string>(ERP_MODULES.map((module) => module.id));

export const ERP_SISTEMA_DISABLED: ErpSistemaConfig = { habilitado: false, modulos: [] };

export function normalizeErpSistemaConfig(raw: unknown): ErpSistemaConfig {
  const value = raw as Partial<ErpSistemaConfig> | null | undefined;
  const modulos = Array.isArray(value?.modulos)
    ? value.modulos.filter((module): module is ErpModuleId =>
        typeof module === "string" && MODULE_IDS.has(module),
      )
    : [];
  return { habilitado: value?.habilitado === true, modulos: [...new Set(modulos)] };
}

export function getErpSistemaConfig(configuracoes: Record<string, unknown> | null | undefined) {
  return normalizeErpSistemaConfig(configuracoes?.erp_sistema);
}

export function erpModuleEnabled(config: ErpSistemaConfig, module: string): module is ErpModuleId {
  return config.habilitado && config.modulos.includes(module as ErpModuleId);
}
