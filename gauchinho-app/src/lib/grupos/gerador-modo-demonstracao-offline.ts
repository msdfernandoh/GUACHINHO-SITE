/**
 * Gerador de Arquivo HTML Autônomo para o "Modo Demonstração Offline".
 * Produz um arquivo .html único, sem nenhuma dependência externa de CDN ou servidor,
 * contendo todo o CSS, dados dos grupos do tenant e motor reativo de cálculo.
 */

import type { PublicGrupoAggregate } from "@/lib/types";
import type { TenantBrandValue } from "@/components/tenant/tenant-brand-context";

export type GerarModoDemonstracaoOptions = {
  aggregates: PublicGrupoAggregate[];
  tenantBrand: Partial<TenantBrandValue>;
  timestamp?: string;
};

function escapeHtml(str: string): string {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function safeJsonStringify(obj: unknown): string {
  return JSON.stringify(obj).replace(/</g, "\\u003c");
}

export function generateModoDemonstracaoOfflineHtml({
  aggregates,
  tenantBrand,
  timestamp,
}: GerarModoDemonstracaoOptions): string {
  const nomeEmpresa = tenantBrand.nome?.trim() || "Consórcios";
  const corPrimaria = tenantBrand.corPrimaria || "#0066cc";
  const corSecundaria = tenantBrand.corSecundaria || "#0c2340";
  const corDestaque = tenantBrand.corDestaque || "#f59e0b";
  const dataGeracao =
    timestamp ||
    new Date().toLocaleString("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
    });

  // Coleta modalidades/categorias únicas para as abas de filtro
  const categoriasSet = new Set<string>();
  categoriasSet.add("Todos");
  for (const item of aggregates) {
    if (item.grupo.categorias_publicacao && item.grupo.categorias_publicacao.length > 0) {
      for (const cat of item.grupo.categorias_publicacao) {
        if (cat) categoriasSet.add(cat);
      }
    } else if (item.grupo.modalidade) {
      categoriasSet.add(item.grupo.modalidade);
    }
  }
  const categorias = Array.from(categoriasSet);

  const jsonAggregates = safeJsonStringify(aggregates);
  const jsonTenant = safeJsonStringify({
    nome: nomeEmpresa,
    corPrimaria,
    corSecundaria,
    corDestaque,
    logoUrl: tenantBrand.logoUrl || null,
  });

  return `<!DOCTYPE html>
<html lang="pt-BR" class="dark">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Modo Demonstração Offline — ${escapeHtml(nomeEmpresa)}</title>
  <style>
    :root {
      --brand-primary: ${corPrimaria};
      --brand-secondary: ${corSecundaria};
      --brand-accent: ${corDestaque};
      --bg-main: #09090b;
      --bg-card: #18181b;
      --bg-card-hover: #27272a;
      --border-color: #27272a;
      --text-main: #f4f4f5;
      --text-muted: #a1a1aa;
      --gold: #f59e0b;
      --gold-light: #fbbf24;
      --gold-bg: rgba(245, 158, 11, 0.08);
      --green: #10b981;
    }
    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
    }
    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      padding-bottom: 140px;
    }
    header {
      background: linear-gradient(180deg, var(--brand-secondary) 0%, rgba(9, 9, 11, 0.95) 100%);
      border-bottom: 1px solid var(--border-color);
      padding: 24px 20px;
      position: sticky;
      top: 0;
      z-index: 40;
      backdrop-filter: blur(12px);
    }
    .header-content {
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
    }
    .brand-title {
      font-size: 24px;
      font-weight: 800;
      letter-spacing: -0.02em;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .badge-offline {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.35);
      color: #34d399;
    }
    .badge-dot {
      width: 7px;
      height: 7px;
      border-radius: 50%;
      background-color: #10b981;
      box-shadow: 0 0 8px #10b981;
    }
    .header-meta {
      font-size: 12px;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 8px;
      cursor: pointer;
      border: 1px solid transparent;
      transition: all 0.15s ease;
      text-decoration: none;
    }
    .btn-gold {
      background: var(--gold);
      color: #09090b;
      border-color: var(--gold);
    }
    .btn-gold:hover {
      background: var(--gold-light);
      box-shadow: 0 0 16px rgba(245, 158, 11, 0.3);
    }
    .btn-outline {
      background: #18181b;
      color: #e4e4e7;
      border-color: #3f3f46;
    }
    .btn-outline:hover {
      background: #27272a;
      border-color: #71717a;
    }
    .btn-sm {
      padding: 4px 10px;
      font-size: 11px;
      border-radius: 6px;
    }
    main {
      max-width: 1440px;
      margin: 24px auto;
      padding: 0 20px;
    }
    .filters-bar {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 20px;
    }
    .tabs {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .tab-btn {
      padding: 6px 14px;
      font-size: 13px;
      font-weight: 600;
      border-radius: 9999px;
      border: 1px solid #3f3f46;
      background: #18181b;
      color: #d4d4d8;
      cursor: pointer;
      transition: all 0.15s ease;
    }
    .tab-btn:hover {
      border-color: var(--gold);
      color: #ffffff;
    }
    .tab-btn.active {
      background: var(--gold);
      border-color: var(--gold);
      color: #09090b;
      font-weight: 700;
    }
    .search-input {
      padding: 8px 14px;
      border-radius: 8px;
      background: #18181b;
      border: 1px solid #3f3f46;
      color: #ffffff;
      font-size: 13px;
      width: 240px;
      outline: none;
    }
    .search-input:focus {
      border-color: var(--gold);
    }
    .table-container {
      background: var(--bg-card);
      border: 1px solid var(--border-color);
      border-radius: 12px;
      overflow-x: auto;
      box-shadow: 0 4px 20px rgba(0, 0, 0, 0.4);
    }
    table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
      font-size: 12px;
      min-width: 1150px;
    }
    thead th {
      background-color: var(--brand-secondary);
      color: #ffffff;
      padding: 12px 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      font-size: 11px;
      border-bottom: 2px solid rgba(255, 255, 255, 0.1);
      white-space: nowrap;
      position: sticky;
      top: 0;
      z-index: 10;
    }
    tbody tr {
      border-bottom: 1px solid var(--border-color);
      transition: background-color 0.15s;
    }
    tbody tr:hover {
      background-color: var(--bg-card-hover);
    }
    tbody tr.active-row {
      background-color: var(--gold-bg);
      border-left: 3px solid var(--gold);
    }
    tbody td {
      padding: 10px 8px;
      vertical-align: middle;
      color: #e4e4e7;
    }
    .col-group {
      font-weight: 700;
      color: var(--gold);
      font-size: 13px;
      min-width: 80px;
    }
    .group-tag {
      font-size: 9px;
      padding: 2px 6px;
      border-radius: 4px;
      background: var(--brand-secondary);
      color: #93c5fd;
      display: inline-block;
      margin-top: 3px;
    }
    select, input[type="number"], input[type="text"] {
      background: #09090b;
      border: 1px solid #3f3f46;
      color: #ffffff;
      padding: 6px 8px;
      border-radius: 6px;
      font-size: 12px;
      outline: none;
    }
    select:focus, input:focus {
      border-color: var(--gold);
    }
    .input-qty {
      width: 52px;
      text-align: center;
    }
    .input-pct {
      width: 60px;
      text-align: right;
    }
    .val-currency {
      font-variant-numeric: tabular-nums;
      font-weight: 600;
    }
    .text-gold {
      color: var(--gold);
    }
    .text-emerald {
      color: #34d399;
    }
    .text-muted {
      color: var(--text-muted);
    }
    .btn-toggle-seguro {
      width: 24px;
      height: 24px;
      padding: 0;
      border-radius: 4px;
      font-size: 10px;
      font-weight: 700;
      cursor: pointer;
      border: 1px solid #3f3f46;
      background: #27272a;
      color: #a1a1aa;
    }
    .btn-toggle-seguro.active {
      background: var(--gold);
      color: #09090b;
      border-color: var(--gold);
    }
    .expand-row {
      background: #101014;
      border-bottom: 1px solid #3f3f46;
    }
    .expand-details {
      padding: 14px 20px;
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      font-size: 12px;
      background: rgba(0, 0, 0, 0.25);
      border-radius: 8px;
      margin: 6px 12px 12px 12px;
      border: 1px solid #27272a;
    }
    .detail-card {
      background: #18181b;
      padding: 10px 14px;
      border-radius: 6px;
      border: 1px solid #27272a;
    }
    .detail-card-label {
      font-size: 10px;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin-bottom: 4px;
    }
    .detail-card-value {
      font-size: 14px;
      font-weight: 700;
      color: #f4f4f5;
    }
    /* Fixed Totals Bar */
    .totals-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: rgba(18, 18, 22, 0.95);
      border-top: 1px solid var(--border-color);
      backdrop-filter: blur(16px);
      padding: 14px 24px;
      z-index: 50;
      box-shadow: 0 -4px 30px rgba(0, 0, 0, 0.6);
    }
    .totals-content {
      max-width: 1440px;
      margin: 0 auto;
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      justify-content: space-between;
      gap: 20px;
    }
    .totals-items {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 24px;
    }
    .total-col {
      display: flex;
      flex-direction: column;
    }
    .total-label {
      font-size: 11px;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: var(--text-muted);
    }
    .total-val {
      font-size: 18px;
      font-weight: 800;
      color: #ffffff;
      font-variant-numeric: tabular-nums;
    }
    .total-val-highlight {
      color: var(--gold);
    }
    .badge-contador {
      font-size: 11px;
      font-weight: 700;
      background: #27272a;
      color: #d4d4d8;
      padding: 4px 10px;
      border-radius: 9999px;
      border: 1px solid #3f3f46;
    }

    /* Print styles */
    @media print {
      body {
        background: #ffffff !important;
        color: #000000 !important;
        padding-bottom: 0 !important;
      }
      header, .filters-bar, .totals-bar, .no-print, button, select, input {
        display: none !important;
      }
      .print-only {
        display: block !important;
      }
      .print-header {
        border-bottom: 2px solid #000;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .print-header h1 {
        font-size: 20px;
        color: #000;
      }
      .table-container {
        border: none !important;
        box-shadow: none !important;
        background: transparent !important;
      }
      table {
        min-width: 100% !important;
        border: 1px solid #ccc !important;
      }
      thead th {
        background: #f0f0f0 !important;
        color: #000 !important;
        border-bottom: 1px solid #000 !important;
      }
      tbody td {
        color: #000 !important;
        border-bottom: 1px solid #ddd !important;
        padding: 6px 8px !important;
      }
      tr:not(.active-row) {
        display: none !important;
      }
      .print-summary {
        margin-top: 24px;
        padding: 16px;
        background: #f8f8f8;
        border: 1px solid #ccc;
        border-radius: 8px;
      }
    }
    .print-only {
      display: none;
    }
  </style>
</head>
<body>
  <header>
    <div class="header-content">
      <div>
        <div class="brand-title">
          <span>${escapeHtml(nomeEmpresa)}</span>
          <span class="badge-offline">
            <span class="badge-dot"></span>
            Modo Demonstração Offline
          </span>
        </div>
        <div class="header-meta">
          Simulador Comercial Independente · Dados vigentes em ${escapeHtml(dataGeracao)} · Não necessita internet
        </div>
      </div>
      <div class="header-actions no-print">
        <button type="button" class="btn btn-outline btn-sm" onclick="resetarSimulacao()">
          🔄 Limpar Seleção
        </button>
        <button type="button" class="btn btn-gold btn-sm" onclick="window.print()">
          🖨️ Imprimir / Salvar PDF
        </button>
      </div>
    </div>
  </header>

  <!-- Print Header Only -->
  <div class="print-only" style="padding: 20px;">
    <div class="print-header">
      <h1>${escapeHtml(nomeEmpresa)} — Simulação Comercial de Consórcios</h1>
      <p style="font-size: 12px; color: #555; margin-top: 4px;">
        Proposta Comercial Demonstrativa · Emitido em ${escapeHtml(dataGeracao)}
      </p>
    </div>
  </div>

  <main>
    <div class="filters-bar no-print">
      <div class="tabs">
        ${categorias
          .map(
            (cat, idx) =>
              `<button type="button" class="tab-btn ${idx === 0 ? "active" : ""}" data-category="${escapeHtml(cat)}" onclick="filtrarCategoria('${escapeHtml(cat)}')">${escapeHtml(cat)}</button>`,
          )
          .join("\n        ")}
      </div>
      <div>
        <input
          type="text"
          id="buscaInput"
          class="search-input"
          placeholder="Buscar grupo ou crédito..."
          oninput="filtrarBusca(this.value)"
        />
      </div>
    </div>

    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Cota (Crédito)</th>
            <th>Qtd.</th>
            <th>Soma Cotas</th>
            <th>Saldo Devedor</th>
            <th>Parcela (1ª)</th>
            <th>Lance Embutido</th>
            <th>Recurso Próprio</th>
            <th>Lance Total</th>
            <th>Seguro</th>
            <th>Crédito Líquido</th>
            <th>Saldo Pós-Lance</th>
            <th>Pós-Contemplação</th>
            <th>Prazo</th>
            <th class="no-print">Detalhes</th>
          </tr>
        </thead>
        <tbody id="tabelaCorpo">
          <!-- Renderizado via JavaScript -->
        </tbody>
      </table>
    </div>

    <div class="print-only print-summary" id="printSummary">
      <!-- Resumo impresso montado no print -->
    </div>
  </main>

  <div class="totals-bar no-print">
    <div class="totals-content">
      <div class="totals-items">
        <span class="badge-contador" id="totaisContador">0 cotas ativas</span>
        <div class="total-col">
          <span class="total-label">Crédito Total</span>
          <span class="total-val" id="totaisCredito">R$ 0,00</span>
        </div>
        <div class="total-col">
          <span class="total-label">Lance Total</span>
          <span class="total-val" id="totaisLance">R$ 0,00</span>
        </div>
        <div class="total-col">
          <span class="total-label">1ª Parcela</span>
          <span class="total-val" id="totaisParcela">R$ 0,00</span>
        </div>
        <div class="total-col">
          <span class="total-label">Crédito Líquido</span>
          <span class="total-val total-val-highlight" id="totaisLiquido">R$ 0,00</span>
        </div>
      </div>
      <div>
        <button type="button" class="btn btn-gold" onclick="window.print()">
          🖨️ Imprimir Simulação
        </button>
      </div>
    </div>
  </div>

  <script id="grupos-data" type="application/json">
    ${jsonAggregates}
  </script>
  <script id="tenant-data" type="application/json">
    ${jsonTenant}
  </script>

  <script>
    (function () {
      var aggregates = JSON.parse(document.getElementById('grupos-data').textContent);
      var tenant = JSON.parse(document.getElementById('tenant-data').textContent);
      var configs = {};
      var expandedId = null;
      var filtroAtivo = "Todos";
      var buscaAtiva = "";

      // Inicializa configurações padrão para cada grupo
      aggregates.forEach(function (item) {
        var g = item.grupo;
        var cotas = item.cotas || [];
        var modalidades = item.modalidades || [];

        configs[g.id] = {
          cotaId: null,
          quantidadeCotas: 0,
          modalidadeParcela: g.tem_parcela_reduzida ? "reduzida" : "integral",
          percentualParcelaReduzida: g.percentual_parcela_reduzida || 70,
          percentualParcelaPersonalizada: null,
          usaLanceEmbutido: false,
          modalidadeLanceId: modalidades.length > 0 ? modalidades[0].id : null,
          usaRecursoProprio: false,
          recursoProprioModo: "percentual",
          recursoProprioInput: 0,
          usaSeguro: true
        };
      });

      function num(v, fallback) {
        fallback = fallback !== undefined ? fallback : 0;
        var n = Number(v);
        return isFinite(n) ? n : fallback;
      }

      function formatCurrency(val) {
        return (val || 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
      }

      function calcularLinha(item) {
        var g = item.grupo;
        var cotas = item.cotas || [];
        var modalidades = item.modalidades || [];
        var cfg = configs[g.id];
        if (!cfg || !cfg.cotaId || cfg.quantidadeCotas <= 0) {
          return { ativo: false };
        }

        var cota = cotas.find(function (c) { return c.id === cfg.cotaId; });
        if (!cota) return { ativo: false };

        var qty = Math.max(0, Math.floor(cfg.quantidadeCotas));
        var valorCredito = num(cota.valor_credito);
        var somaCotas = valorCredito * qty;

        var txAdm = num(g.taxa_administrativa_percentual) / 100;
        var fundo = num(g.fundo_reserva_percentual) / 100;
        var saldoDevedorInicial = Math.round(somaCotas * (1 + txAdm + fundo) * 100) / 100;

        // Modalidade de Lance
        var modLance = modalidades.find(function (m) { return m.id === cfg.modalidadeLanceId; }) || null;
        var baseLance = modLance && modLance.base_referencia === "CREDITO" ? somaCotas : saldoDevedorInicial;

        var pctEmbutido = (cfg.usaLanceEmbutido && modLance) ? num(modLance.percentual_lance_embutido) : 0;
        var lanceEmbutido = pctEmbutido > 0 ? Math.round(baseLance * (pctEmbutido / 100) * 100) / 100 : 0;

        var recursoProprio = 0;
        if (cfg.usaRecursoProprio) {
          if (cfg.recursoProprioModo === "percentual") {
            recursoProprio = Math.round(baseLance * (num(cfg.recursoProprioInput) / 100) * 100) / 100;
          } else {
            recursoProprio = Math.max(0, num(cfg.recursoProprioInput));
          }
        }

        var lanceTotal = lanceEmbutido + recursoProprio;
        var saldoPosLance = Math.max(0, Math.round((saldoDevedorInicial - lanceTotal) * 100) / 100);
        var creditoLiquido = Math.max(0, Math.round((somaCotas - lanceEmbutido) * 100) / 100);

        // Parcelas
        var prazoTotal = Math.max(1, num(g.prazo_total, 180));
        var saldoUnit = saldoDevedorInicial / qty;
        var parcelaIntegral = Math.round((saldoUnit / prazoTotal) * 100) / 100;
        var pctRed = num(cfg.percentualParcelaReduzida || g.percentual_parcela_reduzida, 70);
        var parcelaReduzida = g.tem_parcela_reduzida ? Math.round((parcelaIntegral * (pctRed / 100)) * 100) / 100 : parcelaIntegral;

        var parcelaExibidaUnit = parcelaIntegral;
        if (cfg.modalidadeParcela === "reduzida" && g.tem_parcela_reduzida) {
          parcelaExibidaUnit = parcelaReduzida;
        } else if (cfg.modalidadeParcela === "personalizada" && cfg.percentualParcelaPersonalizada) {
          parcelaExibidaUnit = Math.round((parcelaIntegral * (num(cfg.percentualParcelaPersonalizada) / 100)) * 100) / 100;
        }

        // Seguro
        var fatorSeg = num(g.seguro_percentual) / 100;
        var seguroUnit = (fatorSeg > 0 && qty > 0) ? Math.round((saldoDevedorInicial / qty) * fatorSeg * 100) / 100 : 0;
        var primeiraParcela = Math.round((parcelaExibidaUnit + (cfg.usaSeguro ? seguroUnit : 0)) * qty * 100) / 100;

        // Pós-contemplação
        var parcelasRestantes = Math.max(1, num(g.prazo_restante || prazoTotal));
        var divisor = parcelasRestantes - 1;
        var tipoImovel = (g.modalidade || "").toLowerCase().indexOf("imóvel") >= 0 || (g.modalidade || "").toLowerCase().indexOf("imovel") >= 0;
        var taxaMinima = tipoImovel ? 0 : 0.007;
        var basePos = saldoDevedorInicial - lanceTotal - (tipoImovel ? 0 : primeiraParcela);
        var parcelaPos = divisor > 0 ? Math.max(saldoDevedorInicial * taxaMinima, basePos / divisor) : 0;
        var prazoPos = parcelaPos > 0 ? (saldoDevedorInicial - lanceTotal - primeiraParcela) / parcelaPos : 0;

        return {
          ativo: true,
          somaCotas: somaCotas,
          saldoDevedorInicial: saldoDevedorInicial,
          lanceEmbutido: lanceEmbutido,
          recursoProprio: recursoProprio,
          lanceTotal: lanceTotal,
          saldoPosLance: saldoPosLance,
          creditoLiquido: creditoLiquido,
          primeiraParcela: primeiraParcela,
          parcelaPosContemplacao: Math.round(parcelaPos * 100) / 100,
          prazoRestantePos: Math.round(prazoPos),
          prazoRestanteOriginal: parcelasRestantes,
          prazoTotal: prazoTotal,
          seguroUnit: seguroUnit
        };
      }

      function render() {
        var tbody = document.getElementById('tabelaCorpo');
        var html = '';
        var totais = {
          cotas: 0,
          credito: 0,
          lance: 0,
          parcela: 0,
          liquido: 0
        };

        var termo = buscaAtiva.trim().toLowerCase();

        aggregates.forEach(function (item) {
          var g = item.grupo;
          var cotas = item.cotas || [];
          var modalidades = item.modalidades || [];
          var cfg = configs[g.id];

          // Filtro de Categoria
          if (filtroAtivo !== "Todos") {
            var temCat = g.categorias_publicacao && g.categorias_publicacao.indexOf(filtroAtivo) >= 0;
            if (!temCat && g.modalidade !== filtroAtivo) return;
          }

          // Filtro de Busca
          if (termo) {
            var matchGrupo = (g.codigo_grupo || "").toLowerCase().indexOf(termo) >= 0;
            var matchCredito = cotas.some(function (c) {
              return String(c.valor_credito).indexOf(termo) >= 0;
            });
            if (!matchGrupo && !matchCredito) return;
          }

          var calc = calcularLinha(item);
          var isExpanded = expandedId === g.id;

          if (calc.ativo) {
            totais.cotas += cfg.quantidadeCotas;
            totais.credito += calc.somaCotas;
            totais.lance += calc.lanceTotal;
            totais.parcela += calc.primeiraParcela;
            totais.liquido += calc.creditoLiquido;
          }

          var rowClass = calc.ativo ? 'active-row' : '';

          html += '<tr class="' + rowClass + '">';
          // Grupo
          html += '<td class="col-group">' + escapeHtml(g.codigo_grupo);
          if (g.modalidade) {
            html += '<br><span class="group-tag">' + escapeHtml(g.modalidade) + '</span>';
          }
          html += '</td>';

          // Cota
          html += '<td><select onchange="atualizarCota(\\'' + g.id + '\\', this.value)">';
          html += '<option value="">Selecione...</option>';
          cotas.forEach(function (c) {
            var sel = cfg.cotaId === c.id ? 'selected' : '';
            html += '<option value="' + c.id + '" ' + sel + '>' + formatCurrency(c.valor_credito) + '</option>';
          });
          html += '</select></td>';

          // Qtd
          html += '<td><input type="number" min="0" max="99" class="input-qty" value="' + (cfg.quantidadeCotas || 0) + '" onchange="atualizarQtd(\\'' + g.id + '\\', this.value)" /></td>';

          // Soma Cotas
          html += '<td class="val-currency">' + (calc.ativo ? formatCurrency(calc.somaCotas) : '—') + '</td>';

          // Saldo Devedor
          html += '<td class="val-currency text-muted">' + (calc.ativo ? formatCurrency(calc.saldoDevedorInicial) : '—') + '</td>';

          // Parcela 1ª
          html += '<td>' + (calc.ativo ? '<strong class="text-gold">' + formatCurrency(calc.primeiraParcela) + '</strong><br><small class="text-muted">' + (cfg.modalidadeParcela === "reduzida" ? 'Reduzida' : 'Integral') + '</small>' : '—') + '</td>';

          // Lance Embutido
          html += '<td>';
          if (modalidades.length > 0) {
            html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;">';
            html += '<input type="checkbox" ' + (cfg.usaLanceEmbutido ? 'checked' : '') + ' onchange="atualizarLanceEmbutido(\\'' + g.id + '\\', this.checked)" /> ';
            html += '<span>' + (calc.ativo && cfg.usaLanceEmbutido ? formatCurrency(calc.lanceEmbutido) : 'Embutido') + '</span>';
            html += '</label>';
          } else {
            html += '<span class="text-muted">—</span>';
          }
          html += '</td>';

          // Recurso Próprio
          html += '<td>';
          html += '<label style="display:flex;align-items:center;gap:4px;font-size:11px;">';
          html += '<input type="checkbox" ' + (cfg.usaRecursoProprio ? 'checked' : '') + ' onchange="atualizarRecursoProprioCheck(\\'' + g.id + '\\', this.checked)" /> ';
          if (cfg.usaRecursoProprio) {
            html += '<input type="number" min="0" step="1" class="input-pct" value="' + (cfg.recursoProprioInput || 0) + '" onchange="atualizarRecursoProprioValor(\\'' + g.id + '\\', this.value)" placeholder="%" />%';
          } else {
            html += '<span>Próprio</span>';
          }
          html += '</label>';
          html += '</td>';

          // Lance Total
          html += '<td class="val-currency">' + (calc.ativo && calc.lanceTotal > 0 ? '<strong class="text-emerald">' + formatCurrency(calc.lanceTotal) + '</strong>' : '—') + '</td>';

          // Seguro
          html += '<td>';
          html += '<button type="button" class="btn-toggle-seguro ' + (cfg.usaSeguro ? 'active' : '') + '" onclick="toggleSeguro(\\'' + g.id + '\\')" title="Alternar seguro na 1ª parcela">' + (cfg.usaSeguro ? 'C' : 'S') + '</button>';
          html += '</td>';

          // Crédito Líquido
          html += '<td>' + (calc.ativo ? '<strong class="text-gold" style="font-size:13px;">' + formatCurrency(calc.creditoLiquido) + '</strong>' : '—') + '</td>';

          // Saldo Pós-Lance
          html += '<td class="val-currency text-muted">' + (calc.ativo ? formatCurrency(calc.saldoPosLance) : '—') + '</td>';

          // Pós-Contemplação
          html += '<td>' + (calc.ativo ? formatCurrency(calc.parcelaPosContemplacao) + '<br><small class="text-muted">em ' + calc.prazoRestantePos + 'x</small>' : '—') + '</td>';

          // Prazo
          html += '<td style="font-family:monospace;font-size:11px;">' + num(g.prazo_total, 180) + ' / ' + num(g.prazo_restante || g.prazo_total, 180) + '</td>';

          // Ações
          html += '<td class="no-print">';
          html += '<button type="button" class="btn btn-outline btn-sm" onclick="toggleExpand(\\'' + g.id + '\\')">' + (isExpanded ? '▲ Fechar' : '⚙️ Ajustes') + '</button>';
          html += '</td>';
          html += '</tr>';

          // Painel de detalhes expandido
          if (isExpanded) {
            html += '<tr class="expand-row no-print"><td colspan="15">';
            html += '<div class="expand-details">';
            html += '<div class="detail-card">';
            html += '<div class="detail-card-label">Modalidade de Parcela</div>';
            html += '<select onchange="atualizarModalidadeParcela(\\'' + g.id + '\\', this.value)" style="width:100%;margin-top:4px;">';
            html += '<option value="reduzida" ' + (cfg.modalidadeParcela === 'reduzida' ? 'selected' : '') + '>Parcela Reduzida</option>';
            html += '<option value="integral" ' + (cfg.modalidadeParcela === 'integral' ? 'selected' : '') + '>Parcela Integral</option>';
            html += '</select>';
            html += '</div>';

            if (modalidades.length > 0) {
              html += '<div class="detail-card">';
              html += '<div class="detail-card-label">Estratégia de Lance Embutido</div>';
              html += '<select onchange="atualizarModalidadeLance(\\'' + g.id + '\\', this.value)" style="width:100%;margin-top:4px;">';
              modalidades.forEach(function (m) {
                var selM = cfg.modalidadeLanceId === m.id ? 'selected' : '';
                html += '<option value="' + m.id + '" ' + selM + '>' + escapeHtml(m.nome) + ' (' + m.percentual_lance_embutido + '%)</option>';
              });
              html += '</select>';
              html += '</div>';
            }

            html += '<div class="detail-card">';
            html += '<div class="detail-card-label">Saldo Devedor Inicial</div>';
            html += '<div class="detail-card-value">' + (calc.ativo ? formatCurrency(calc.saldoDevedorInicial) : 'R$ 0,00') + '</div>';
            html += '</div>';

            html += '<div class="detail-card">';
            html += '<div class="detail-card-label">Saldo Após Lance</div>';
            html += '<div class="detail-card-value">' + (calc.ativo ? formatCurrency(calc.saldoPosLance) : 'R$ 0,00') + '</div>';
            html += '</div>';

            html += '</div>';
            html += '</td></tr>';
          }
        });

        tbody.innerHTML = html || '<tr><td colspan="15" style="text-align:center;padding:40px;color:#71717a;">Nenhum grupo encontrado com os filtros selecionados.</td></tr>';

        // Atualiza barra de totais
        document.getElementById('totaisContador').textContent = totais.cotas + (totais.cotas === 1 ? ' cota ativa' : ' cotas ativas');
        document.getElementById('totaisCredito').textContent = formatCurrency(totais.credito);
        document.getElementById('totaisLance').textContent = formatCurrency(totais.lance);
        document.getElementById('totaisParcela').textContent = formatCurrency(totais.parcela);
        document.getElementById('totaisLiquido').textContent = formatCurrency(totais.liquido);

        // Atualiza resumo para impressão
        var printEl = document.getElementById('printSummary');
        if (printEl) {
          printEl.innerHTML = '<h3>Resumo Consolidado da Simulação:</h3>' +
            '<p style="margin-top:8px;font-size:14px;"><strong>Total de Cotas:</strong> ' + totais.cotas + ' | ' +
            '<strong>Crédito Total:</strong> ' + formatCurrency(totais.credito) + ' | ' +
            '<strong>Lance Total:</strong> ' + formatCurrency(totais.lance) + ' | ' +
            '<strong>1ª Parcela:</strong> ' + formatCurrency(totais.parcela) + ' | ' +
            '<strong>Crédito Líquido:</strong> ' + formatCurrency(totais.liquido) + '</p>';
        }
      }

      window.atualizarCota = function (id, cotaId) {
        configs[id].cotaId = cotaId || null;
        if (cotaId && configs[id].quantidadeCotas === 0) {
          configs[id].quantidadeCotas = 1;
        }
        render();
      };

      window.atualizarQtd = function (id, qtd) {
        configs[id].quantidadeCotas = Math.max(0, parseInt(qtd, 10) || 0);
        render();
      };

      window.atualizarLanceEmbutido = function (id, checked) {
        configs[id].usaLanceEmbutido = checked;
        render();
      };

      window.atualizarRecursoProprioCheck = function (id, checked) {
        configs[id].usaRecursoProprio = checked;
        render();
      };

      window.atualizarRecursoProprioValor = function (id, val) {
        configs[id].recursoProprioInput = num(val);
        render();
      };

      window.toggleSeguro = function (id) {
        configs[id].usaSeguro = !configs[id].usaSeguro;
        render();
      };

      window.atualizarModalidadeParcela = function (id, modalidade) {
        configs[id].modalidadeParcela = modalidade;
        render();
      };

      window.atualizarModalidadeLance = function (id, modId) {
        configs[id].modalidadeLanceId = modId;
        render();
      };

      window.toggleExpand = function (id) {
        expandedId = expandedId === id ? null : id;
        render();
      };

      window.filtrarCategoria = function (cat) {
        filtroAtivo = cat;
        var btns = document.querySelectorAll('.tab-btn');
        btns.forEach(function (b) {
          if (b.getAttribute('data-category') === cat) b.classList.add('active');
          else b.classList.remove('active');
        });
        render();
      };

      window.filtrarBusca = function (termo) {
        buscaAtiva = termo || "";
        render();
      };

      window.resetarSimulacao = function () {
        aggregates.forEach(function (item) {
          var g = item.grupo;
          configs[g.id].cotaId = null;
          configs[g.id].quantidadeCotas = 0;
          configs[g.id].usaLanceEmbutido = false;
          configs[g.id].usaRecursoProprio = false;
        });
        expandedId = null;
        render();
      };

      // Inicializa renderização
      render();
    })();
  </script>
</body>
</html>`;
}
