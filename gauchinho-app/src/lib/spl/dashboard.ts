import { calcularPlano } from "@/lib/parceiros/plano-recebimento";
import type { ModeloParceiroId } from "@/lib/parceiros/modelos-programa";
import { PERCENTUAL_PARCERIA, PERCENTUAL_VENDEDOR, type ClienteSpl, type ModeloParceria, type VendedorSpl } from "./types";

export const MODELO_RECEBIMENTO_SPL: Record<ModeloParceria, ModeloParceiroId | null> = {
  GERADOR_OPORTUNIDADES: "GERADOR_POSSIBILIDADES",
  GERADOR_NEGOCIOS: "GERADOR_NEGOCIOS",
  MICROFRANQUIA: "MICROFRANQUEADO",
  SOMENTE_LIBERAR_CARTEIRA: null,
};

export function resumirDashboardSpl(
  clientes: ClienteSpl[],
  vendedores: VendedorSpl[],
  modelo: ModeloParceria | null,
) {
  const modeloRecebimento = modelo ? MODELO_RECEBIMENTO_SPL[modelo] : null;
  const vendedoresPorId = new Map(vendedores.map((vendedor) => [vendedor.id, vendedor]));
  const porVendedor = new Map(vendedores.map((vendedor) => [vendedor.id, {
    id: vendedor.id,
    nome: vendedor.nome,
    indicacoes: 0,
    comissao: null as number | null,
  }]));
  let previsto = 0;
  let fechado = 0;
  let previstosComValor = 0;
  let fechadosComValor = 0;
  let comissaoImobiliaria: number | null = null;
  let comissaoVendedores: number | null = null;

  const indicacoes = clientes.map((cliente) => {
    const vendedor = cliente.vendedor_id ? vendedoresPorId.get(cliente.vendedor_id) : undefined;
    const resumoVendedor = vendedor ? porVendedor.get(vendedor.id) : undefined;
    if (resumoVendedor) resumoVendedor.indicacoes += 1;
    const valor = Number(cliente.valor_chaves);
    const centavos = Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) : null;
    const aberto = cliente.status !== "FECHADO" && cliente.status !== "PERDIDO";
    if (centavos !== null) {
      if (aberto) {
        previsto += centavos;
        previstosComValor += 1;
      }
      if (cliente.status === "FECHADO") {
        fechado += centavos;
        fechadosComValor += 1;
      }
      const consorcio = cliente.solucao === "CONSORCIO_SPL" || cliente.solucao === "CONSORCIO_ECONOMICO";
      if (consorcio && cliente.status !== "PERDIDO" && modelo && modeloRecebimento && valor <= 1e12 && (!cliente.vendedor_id || vendedor)) {
        const total = Math.round(calcularPlano(modeloRecebimento, "IMOVEIS", "INTEGRAL", centavos / 100).total * 100);
        const percentualImob = PERCENTUAL_PARCERIA[modelo];
        const percentualVendedor = vendedor ? PERCENTUAL_VENDEDOR[vendedor.modelo] : 0;
        if (percentualVendedor <= percentualImob) {
          const parteVendedor = Math.round(total * percentualVendedor / percentualImob);
          comissaoImobiliaria = (comissaoImobiliaria ?? 0) + total - parteVendedor;
          comissaoVendedores = (comissaoVendedores ?? 0) + parteVendedor;
          if (resumoVendedor) resumoVendedor.comissao = (resumoVendedor.comissao ?? 0) + parteVendedor;
        }
      }
    }
    return {
      id: cliente.id,
      nome: cliente.nome,
      vendedor: vendedor?.nome ?? (cliente.vendedor_id ? "Vendedor indisponível" : "Sem vendedor"),
      status: cliente.status,
      valor: centavos === null ? null : centavos / 100,
    };
  });

  return {
    indicacoes,
    previsto: previstosComValor ? previsto / 100 : null,
    fechado: fechadosComValor ? fechado / 100 : null,
    comissaoImobiliaria: comissaoImobiliaria === null ? null : comissaoImobiliaria / 100,
    comissaoVendedores: comissaoVendedores === null ? null : comissaoVendedores / 100,
    vendedores: Array.from(porVendedor.values(), (item) => ({
      ...item,
      comissao: item.comissao === null ? null : item.comissao / 100,
    })),
  };
}
