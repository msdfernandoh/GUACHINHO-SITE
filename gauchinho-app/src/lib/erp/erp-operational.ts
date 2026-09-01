import type { ErpModuleId, ErpSistemaConfig } from "./erp-modulos";

export type ErpOperationalRoute = {
  id: string;
  label: string;
  href: string;
  section: "Comercial" | "Consorcio" | "Comissoes e financeiro" | "Gestao";
  requiresAny: ErpModuleId[];
};

export const ERP_OPERATIONAL_ROUTES: ErpOperationalRoute[] = [
  { id: "clientes", label: "Clientes e carteira", href: "/erp/clientes", section: "Comercial", requiresAny: ["leads", "propostas", "contratacoes", "vendas"] },
  { id: "consultores", label: "Consultores", href: "/erp/consultores", section: "Comercial", requiresAny: ["usuarios", "comissoes"] },
  { id: "lances", label: "Lances e estrategias", href: "/erp/lances", section: "Consorcio", requiresAny: ["grupos"] },
  { id: "assembleias", label: "Assembleias / Pedras", href: "/erp/assembleias", section: "Consorcio", requiresAny: ["grupos"] },
  { id: "regras-comissao", label: "Regras de comissao", href: "/erp/regras-comissao", section: "Comissoes e financeiro", requiresAny: ["comissoes"] },
  { id: "repasse-franquia", label: "Repasse da franquia", href: "/erp/repasse-franquia", section: "Comissoes e financeiro", requiresAny: ["comissoes", "financeiro"] },
  { id: "minhas-comissoes", label: "Minhas comissões", href: "/erp/minhas-comissoes", section: "Comissoes e financeiro", requiresAny: ["comissoes"] },
  { id: "contas-pagar", label: "Contas a pagar", href: "/erp/contas-pagar", section: "Comissoes e financeiro", requiresAny: ["financeiro"] },
];

export function erpOperationalRouteEnabled(config: ErpSistemaConfig, routeId: string) {
  const route = ERP_OPERATIONAL_ROUTES.find((item) => item.id === routeId);
  return Boolean(route && config.habilitado && route.requiresAny.some((id) => config.modulos.includes(id)));
}

export function listEnabledOperationalRoutes(config: ErpSistemaConfig) {
  return ERP_OPERATIONAL_ROUTES.filter((route) => erpOperationalRouteEnabled(config, route.id));
}
