"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  salvarModeloSitePlatformAction,
  statusModeloSitePlatformAction,
  duplicarModeloSitePlatformAction,
  type PlatformFormState,
} from "@/app/platform/templates-actions";
import { sanitizeTemplateCode } from "@/lib/platform/html-sanitizer";
import { RaconInspiredHome } from "@/components/public/templates/racon-inspired-home";

export type MenuItem = {
  id: string;
  label: string;
  rota: string;
  ativo_padrao: boolean;
  obrigatorio?: boolean;
};

export type SecaoHomeItem = {
  id: string;
  tipo: string;
  titulo: string;
  ordem: number;
  habilitada: boolean;
};

export type ImagensBanners = {
  hero_banner_url?: string;
  card_veiculos_url?: string;
  card_imoveis_url?: string;
  card_patrimonio_url?: string;
  banner_filiais_url?: string;
  embaixador_stats_url?: string;
};

export type IdentidadeVisual = {
  cor_primaria: string;
  cor_secundaria: string;
  cor_destaque: string;
  cor_fundo: string;
  cor_texto: string;
  fonte_familia: string;
  border_radius: string;
  estilo_botoes: string;
  estilo_cards: string;
  imagens_banners?: ImagensBanners;
};

export type TemplateDetail = {
  id: string;
  codigo: string;
  nome: string;
  descricao: string | null;
  status: string;
  versao: number;
  identidade_visual: IdentidadeVisual;
  catalogo_menus: MenuItem[];
  secoes_home: SecaoHomeItem[];
  configuracao_footer: {
    copyright?: string;
    links_uteis?: { label: string; url: string }[];
  };
  codigo_customizado: {
    html_customizado?: string;
    css_customizado?: string;
    sanitizado?: boolean;
    bloqueios?: string[];
  };
  permite_logo_propria: boolean;
  logo_padrao_url: string | null;
  modelo_origem_id: string | null;
  updated_at: string;
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

const RACON_PRESET_IDENTIDADE: IdentidadeVisual = {
  cor_primaria: "#0099dd",
  cor_secundaria: "#0c2340",
  cor_destaque: "#ffb800",
  cor_fundo: "#ffffff",
  cor_texto: "#0f172a",
  fonte_familia: "Inter, system-ui, sans-serif",
  border_radius: "16px",
  estilo_botoes: "rounded-full",
  estilo_cards: "rounded-2xl shadow-lg border border-slate-100",
  imagens_banners: {
    hero_banner_url: "/racon/racon-rubinho-hero.png",
    card_veiculos_url: "/racon/racon-card-veiculo.png",
    card_imoveis_url: "/racon/racon-card-imovel.png",
    card_patrimonio_url: "/racon/racon-card-patrimonio.png",
    banner_filiais_url: "/racon/racon-rubinho-conquiste.png",
    embaixador_stats_url: "/racon/racon-rubinho-apontando.png",
  },
};

const GAUCHINHO_PRESET_IDENTIDADE: IdentidadeVisual = {
  cor_primaria: "#0284c7",
  cor_secundaria: "#0f172a",
  cor_destaque: "#f59e0b",
  cor_fundo: "#f8fafc",
  cor_texto: "#1e293b",
  fonte_familia: "Inter, system-ui, sans-serif",
  border_radius: "16px",
  estilo_botoes: "rounded-full",
  estilo_cards: "rounded-2xl shadow-md border border-slate-100",
  imagens_banners: {
    hero_banner_url: "/media/gauchinho-campanha.jpeg",
    card_veiculos_url: "/foto/Carros.png",
    card_imoveis_url: "/foto/Casa.png",
    card_patrimonio_url: "/foto/Caminhoes-e-Frota.png",
    banner_filiais_url: "/media/gauchinho-logo.png",
    embaixador_stats_url: "/media/gauchinho-logo.png",
  },
};

export function TemplateWorkspace({
  template,
  empresas = [],
  historico = [],
}: {
  template: TemplateDetail;
  empresas?: { id: string; nome_fantasia: string }[];
  historico?: { id: string; acao: string; created_at: string; campos_alterados: unknown }[];
}) {
  const [tab, setTab] = useState<
    "geral" | "identidade" | "banners" | "menus" | "secoes" | "footer" | "codigo" | "preview" | "historico"
  >("geral");


  const [stateSave, actionSave, isPendingSave] = useActionState(salvarModeloSitePlatformAction, initial);
  const [stateStatus, actionStatus, isPendingStatus] = useActionState(statusModeloSitePlatformAction, initial);
  const [stateDuplicar, actionDuplicar, isPendingDuplicar] = useActionState(duplicarModeloSitePlatformAction, initial);

  // States do Formulário
  const [nome, setNome] = useState(template.nome);
  const [descricao, setDescricao] = useState(template.descricao ?? "");
  const [permiteLogoPropria, setPermiteLogoPropria] = useState(template.permite_logo_propria);
  const [logoPadraoUrl, setLogoPadraoUrl] = useState(template.logo_padrao_url ?? "");

  // Identidade Visual
  const [identidade, setIdentidade] = useState<IdentidadeVisual>(template.identidade_visual || RACON_PRESET_IDENTIDADE);

  // Menus
  const [menus, setMenus] = useState<MenuItem[]>(
    template.catalogo_menus?.length > 0
      ? template.catalogo_menus
      : [
          { id: "home", label: "Início", rota: "/", ativo_padrao: true, obrigatorio: true },
          { id: "simulador", label: "Simulador", rota: "/simulador", ativo_padrao: true },
          { id: "consorcio", label: "Consórcios", rota: "/consorcio", ativo_padrao: true },
          { id: "veiculos", label: "Veículos", rota: "/consorcio/veiculos", ativo_padrao: true },
          { id: "imoveis", label: "Imóveis", rota: "/consorcio/imoveis", ativo_padrao: true },
          { id: "grupos", label: "Grupos e Modalidades", rota: "/grupos", ativo_padrao: true },
          { id: "como_funciona", label: "Como Funciona", rota: "/#como-funciona", ativo_padrao: true },
          { id: "sobre", label: "Sobre Nós", rota: "/#sobre", ativo_padrao: true },
          { id: "contato", label: "Contato", rota: "/#contato", ativo_padrao: true },
          { id: "unidades", label: "Unidades", rota: "/#unidades", ativo_padrao: true },
          { id: "login", label: "Login", rota: "/login", ativo_padrao: true },
        ],
  );

  // Seções da Home
  const [secoes, setSecoes] = useState<SecaoHomeItem[]>(
    (template.secoes_home?.length > 0
      ? template.secoes_home
      : [
          { id: "topbar", tipo: "topbar", titulo: "Barra Superior de Atendimento", ordem: 1, habilitada: true },
          { id: "header", tipo: "header", titulo: "Header Principal", ordem: 2, habilitada: true },
          { id: "hero", tipo: "hero", titulo: "Hero em Destaque", ordem: 3, habilitada: true },
          { id: "simulador", tipo: "simulador", titulo: "Simulador em Card", ordem: 4, habilitada: true },
          { id: "produtos", tipo: "produtos", titulo: "Cards Comerciais", ordem: 5, habilitada: true },
          { id: "beneficios", tipo: "beneficios", titulo: "Benefícios do Consórcio", ordem: 6, habilitada: true },
          { id: "como_funciona", tipo: "como_funciona", titulo: "Como Funciona", ordem: 7, habilitada: true },
          { id: "estatisticas", tipo: "estatisticas", titulo: "Estatísticas da Franqueadora", ordem: 8, habilitada: true },
          { id: "depoimentos", tipo: "depoimentos", titulo: "Depoimentos de Clientes", ordem: 9, habilitada: true },
          { id: "cta", tipo: "cta", titulo: "Chamada para Ação (CTA)", ordem: 10, habilitada: true },
          { id: "newsletter", tipo: "newsletter", titulo: "Newsletter & Oportunidades", ordem: 11, habilitada: true },
          { id: "footer", tipo: "footer", titulo: "Rodapé Estruturado", ordem: 12, habilitada: true },
        ]
    ).sort((a, b) => a.ordem - b.ordem),
  );

  // Footer
  const [copyright, setCopyright] = useState(
    template.configuracao_footer?.copyright ??
      "Todos os direitos reservados. Administradora autorizada pelo Banco Central do Brasil.",
  );

  // Código Customizado
  const [htmlCustom, setHtmlCustom] = useState(template.codigo_customizado?.html_customizado ?? "");
  const [cssCustom, setCssCustom] = useState(template.codigo_customizado?.css_customizado ?? "");
  const sanitizationLive = sanitizeTemplateCode(htmlCustom, cssCustom);

  // Preview Mode
  const [previewViewport, setPreviewViewport] = useState<"desktop" | "tablet" | "mobile">("desktop");
  const [previewEmpresaNome, setPreviewEmpresaNome] = useState("Franqueadora Demonstração");

  // Ações de Ordenação de Seções
  const moveSection = (index: number, direction: "up" | "down") => {
    const newIndex = direction === "up" ? index - 1 : index + 1;
    if (newIndex < 0 || newIndex >= secoes.length) return;
    const items = [...secoes];
    const temp = items[index];
    items[index] = items[newIndex];
    items[newIndex] = temp;
    // Reordenar índices
    items.forEach((item, idx) => {
      item.ordem = idx + 1;
    });
    setSecoes(items);
  };

  const toggleSection = (id: string) => {
    setSecoes((prev) =>
      prev.map((s) => (s.id === id ? { ...s, habilitada: !s.habilitada } : s)),
    );
  };

  const isRascunho = template.status === "RASCUNHO";
  const isPublicado = template.status === "PUBLICADO";

  return (
    <div className="space-y-6">
      {/* Header Executivo */}
      <header className="flex flex-wrap items-start justify-between gap-4 border-b border-slate-200 pb-5 dark:border-slate-800">
        <div>
          <Link
            href="/platform/templates"
            className="text-xs font-bold uppercase tracking-wider text-cyan-700 hover:underline dark:text-cyan-400"
          >
            ← Modelos de Site
          </Link>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-extrabold text-slate-900 dark:text-white">{template.nome}</h1>
            <span className="rounded-md bg-cyan-100 px-2.5 py-0.5 text-xs font-bold text-cyan-800 dark:bg-cyan-950 dark:text-cyan-300">
              v{template.versao}
            </span>
            <span
              className={`rounded-full px-3 py-1 text-xs font-bold ${
                isPublicado
                  ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                  : isRascunho
                    ? "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300"
                    : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-400"
              }`}
            >
              {template.status}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500 font-mono">Código: {template.codigo}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {/* Duplicar */}
          <form action={actionDuplicar}>
            <input type="hidden" name="modelo_id" value={template.id} />
            <input type="hidden" name="novo_nome" value={`${template.nome} (Cópia)`} />
            <button
              type="submit"
              disabled={isPendingDuplicar}
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-xs font-bold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
            >
              {isPendingDuplicar ? "Duplicando..." : "📋 Duplicar Modelo"}
            </button>
          </form>

          {/* Publicar / Inativar */}
          {isRascunho && (
            <form action={actionStatus}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="status" value="PUBLICADO" />
              <button
                type="submit"
                disabled={isPendingStatus}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-xs font-bold text-white shadow hover:bg-emerald-700"
              >
                {isPendingStatus ? "Publicando..." : "✓ Publicar Modelo"}
              </button>
            </form>
          )}

          {isPublicado && (
            <form action={actionStatus}>
              <input type="hidden" name="id" value={template.id} />
              <input type="hidden" name="status" value="INATIVO" />
              <button
                type="submit"
                disabled={isPendingStatus}
                className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 dark:border-red-900 dark:bg-red-950 dark:text-red-300"
              >
                {isPendingStatus ? "Inativando..." : "Inativar"}
              </button>
            </form>
          )}
        </div>
      </header>

      {/* Feedback de Status */}
      {stateSave.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateSave.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateSave.message}
        </p>
      )}
      {stateStatus.message && (
        <p
          role="status"
          className={`rounded-lg p-3 text-xs font-bold ${
            stateStatus.status === "SUCCESS" ? "bg-emerald-50 text-emerald-800" : "bg-red-50 text-red-800"
          }`}
        >
          {stateStatus.message}
        </p>
      )}

      {/* Navegação de Abas */}
      <div className="flex flex-wrap gap-2 border-b border-slate-200 pb-2 dark:border-slate-800">
        {[
          ["geral", "1. Geral & Logomarca"],
          ["identidade", "2. Cores & Tipografia"],
          ["banners", "3. Banners & Propaganda"],
          ["menus", "4. Header & Menus"],
          ["secoes", "5. Home & Seções"],
          ["footer", "6. Footer"],
          ["codigo", "7. HTML Avançado (Seguro)"],
          ["preview", "8. Preview Dinâmico"],
          ["historico", "9. Histórico"],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setTab(key as never)}
            className={`rounded-lg px-3 py-2 text-xs font-bold transition-colors ${
              tab === key
                ? "bg-cyan-700 text-white shadow-sm"
                : "bg-white text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Formulário Principal de Edição */}
      <form
        action={actionSave}
        className="space-y-6"
      >
        <input type="hidden" name="id" value={template.id} />
        <input type="hidden" name="nome" value={nome} />
        <input type="hidden" name="descricao" value={descricao} />
        <input type="hidden" name="permite_logo_propria" value={String(permiteLogoPropria)} />
        <input type="hidden" name="logo_padrao_url" value={logoPadraoUrl} />
        <input type="hidden" name="identidade_visual_json" value={JSON.stringify(identidade)} />
        <input type="hidden" name="catalogo_menus_json" value={JSON.stringify(menus)} />
        <input type="hidden" name="secoes_home_json" value={JSON.stringify(secoes)} />
        <input
          type="hidden"
          name="configuracao_footer_json"
          value={JSON.stringify({ copyright, links_uteis: template.configuracao_footer?.links_uteis ?? [] })}
        />
        <input type="hidden" name="html_customizado" value={htmlCustom} />
        <input type="hidden" name="css_customizado" value={cssCustom} />

        {/* ABA 1: GERAL & LOGOMARCA */}
        {tab === "geral" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Dados Gerais e Logomarca do Modelo</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Modelo:</label>
                <input
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Código Técnico:</label>
                <input
                  value={template.codigo}
                  disabled
                  className="mt-1 w-full rounded-lg border border-slate-200 bg-slate-100 p-2.5 text-xs font-mono text-slate-500 dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Descrição Visual e Comercial:</label>
                <textarea
                  rows={3}
                  value={descricao}
                  onChange={(e) => setDescricao(e.target.value)}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Permitir Logomarca Própria da Franquia:</label>
                <select
                  value={String(permiteLogoPropria)}
                  onChange={(e) => setPermiteLogoPropria(e.target.value === "true")}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="true">Sim (Franquia pode fazer upload de logo próprio)</option>
                  <option value="false">Não (Usa exclusivamente a logomarca do Modelo)</option>
                </select>
              </div>

              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL do Logo Padrão do Modelo:</label>
                <input
                  value={logoPadraoUrl}
                  onChange={(e) => setLogoPadraoUrl(e.target.value)}
                  placeholder="Ex: /media/gauchinho-logo.png ou URL externa"
                  className="w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5 pt-1">
                  <span className="text-[10px] font-bold text-slate-500">Presets:</span>
                  <button
                    type="button"
                    onClick={() => setLogoPadraoUrl("/media/gauchinho-logo.png")}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold hover:bg-slate-200 dark:bg-slate-800"
                  >
                    Gauchinho Logo
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoPadraoUrl("/media/gauchinho-sem-fundo.svg")}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold hover:bg-slate-200 dark:bg-slate-800"
                  >
                    Sem Fundo SVG
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogoPadraoUrl("")}
                    className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold hover:bg-slate-200 dark:bg-slate-800"
                  >
                    Logo Racon (Tipográfico)
                  </button>
                </div>
              </div>

              {/* Preview do Logo */}
              <div className="sm:col-span-2 rounded-xl border border-slate-100 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-950 flex items-center gap-4">
                <span className="text-xs font-bold text-slate-600 dark:text-slate-400">Pré-visualização do Logo:</span>
                {logoPadraoUrl ? (
                  <div className="relative h-12 w-48 rounded bg-white p-1 border shadow-xs">
                    <img src={logoPadraoUrl} alt="Preview Logo" className="h-full w-full object-contain" />
                  </div>
                ) : (
                  <span className="text-xs font-semibold text-slate-400 italic">
                    Nenhum arquivo de imagem informado (será renderizado o logotipo tipográfico dinâmico com o nome da empresa).
                  </span>
                )}
              </div>
            </div>
          </section>
        )}

        {/* ABA 2: IDENTIDADE VISUAL */}
        {tab === "identidade" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Cores Padrão e Tipografia</h2>
                <p className="text-xs text-slate-500">Altere as cores padrão deste modelo ou carregue presets prontos.</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIdentidade({ ...identidade, ...RACON_PRESET_IDENTIDADE })}
                  className="rounded-lg border border-sky-300 bg-sky-50 px-3 py-1.5 text-xs font-bold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-300"
                >
                  ⚡ Preset "Racon Inspired"
                </button>
                <button
                  type="button"
                  onClick={() => setIdentidade({ ...identidade, ...GAUCHINHO_PRESET_IDENTIDADE })}
                  className="rounded-lg border border-cyan-300 bg-cyan-50 px-3 py-1.5 text-xs font-bold text-cyan-800 hover:bg-cyan-100 dark:border-cyan-800 dark:bg-cyan-950 dark:text-cyan-300"
                >
                  ⚡ Preset "Gauchinho Default"
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cor Primária (Principal):</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={identidade.cor_primaria}
                    onChange={(e) => setIdentidade({ ...identidade, cor_primaria: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <input
                    value={identidade.cor_primaria}
                    onChange={(e) => setIdentidade({ ...identidade, cor_primaria: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cor Secundária (Navy/Escuro):</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={identidade.cor_secundaria}
                    onChange={(e) => setIdentidade({ ...identidade, cor_secundaria: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <input
                    value={identidade.cor_secundaria}
                    onChange={(e) => setIdentidade({ ...identidade, cor_secundaria: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cor de Destaque / CTA (Amarelo):</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={identidade.cor_destaque}
                    onChange={(e) => setIdentidade({ ...identidade, cor_destaque: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <input
                    value={identidade.cor_destaque}
                    onChange={(e) => setIdentidade({ ...identidade, cor_destaque: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cor de Fundo da Página:</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={identidade.cor_fundo}
                    onChange={(e) => setIdentidade({ ...identidade, cor_fundo: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <input
                    value={identidade.cor_fundo}
                    onChange={(e) => setIdentidade({ ...identidade, cor_fundo: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cor do Texto:</label>
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="color"
                    value={identidade.cor_texto}
                    onChange={(e) => setIdentidade({ ...identidade, cor_texto: e.target.value })}
                    className="h-9 w-12 cursor-pointer rounded border"
                  />
                  <input
                    value={identidade.cor_texto}
                    onChange={(e) => setIdentidade({ ...identidade, cor_texto: e.target.value })}
                    className="w-full rounded-lg border border-slate-300 p-2 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Border Radius dos Elementos:</label>
                <select
                  value={identidade.border_radius}
                  onChange={(e) => setIdentidade({ ...identidade, border_radius: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="8px">Discreto (8px)</option>
                  <option value="16px">Arredondado Moderno (16px)</option>
                  <option value="24px">Extra Arredondado (24px)</option>
                  <option value="9999px">Pill / Circular (9999px)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Estilo dos Botões:</label>
                <select
                  value={identidade.estilo_botoes}
                  onChange={(e) => setIdentidade({ ...identidade, estilo_botoes: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="rounded-full">Arredondado Total (Pill)</option>
                  <option value="rounded-xl">Arredondado Médio</option>
                  <option value="rounded-none">Retangular Reto</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Tipografia:</label>
                <input
                  value={identidade.fonte_familia}
                  onChange={(e) => setIdentidade({ ...identidade, fonte_familia: e.target.value })}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </section>
        )}

        {/* ABA 3: BANNERS & PROPAGANDA */}
        {tab === "banners" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
            <div className="border-b border-slate-100 pb-4 dark:border-slate-800">
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Banners e Imagens Publicitárias</h2>
              <p className="text-xs text-slate-500">
                Personalize ou troque as imagens dos banners, garoto-propaganda/embaixador e cards comerciais.
              </p>
            </div>

            <div className="grid gap-6 sm:grid-cols-2">
              {/* 1. Hero Principal */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white">1. Banner Hero Principal (Com Garoto Propaganda)</h4>
                </div>
                <input
                  value={identidade.imagens_banners?.hero_banner_url || ""}
                  placeholder="/racon/racon-rubinho-hero.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        hero_banner_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          hero_banner_url: "/racon/racon-rubinho-hero.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Rubinho Conquiste
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          hero_banner_url: "/media/gauchinho-campanha.jpeg",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Gauchinho Campanha
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          hero_banner_url: "/foto/Casa.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Casa de Luxo
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900">
                  <img
                    src={identidade.imagens_banners?.hero_banner_url || "/racon/racon-rubinho-hero.png"}
                    alt="Preview Hero"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 2. Card Veículos */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">2. Card de Veículos</h4>
                <input
                  value={identidade.imagens_banners?.card_veiculos_url || ""}
                  placeholder="/racon/racon-card-veiculo.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        card_veiculos_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_veiculos_url: "/racon/racon-card-veiculo.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Racon Motorista
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_veiculos_url: "/foto/Carros.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Foto Carros Novos
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_veiculos_url: "/foto/caminhonetes.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Caminhonetes
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900">
                  <img
                    src={identidade.imagens_banners?.card_veiculos_url || "/racon/racon-card-veiculo.png"}
                    alt="Preview Veículo"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 3. Card Imóveis */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">3. Card de Imóveis (Casa Própria)</h4>
                <input
                  value={identidade.imagens_banners?.card_imoveis_url || ""}
                  placeholder="/racon/racon-card-imovel.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        card_imoveis_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_imoveis_url: "/racon/racon-card-imovel.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Racon Família
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_imoveis_url: "/foto/Casa.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Foto Casa
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_imoveis_url: "/foto/apartamento.jpg",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Apartamento
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900">
                  <img
                    src={identidade.imagens_banners?.card_imoveis_url || "/racon/racon-card-imovel.png"}
                    alt="Preview Imóveis"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 4. Card Patrimônio / Pesados */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">4. Card Patrimônio / Pesados / Agro</h4>
                <input
                  value={identidade.imagens_banners?.card_patrimonio_url || ""}
                  placeholder="/racon/racon-card-patrimonio.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        card_patrimonio_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_patrimonio_url: "/racon/racon-card-patrimonio.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Racon Investimento
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_patrimonio_url: "/foto/Caminhoes-e-Frota.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Caminhões & Frotas
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          card_patrimonio_url: "/foto/Maquinas-Agricolas.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Máquinas Agro
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900">
                  <img
                    src={identidade.imagens_banners?.card_patrimonio_url || "/racon/racon-card-patrimonio.png"}
                    alt="Preview Patrimônio"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 5. Banner Filiais / Unidades */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">5. Banner de Filiais / Unidades</h4>
                <input
                  value={identidade.imagens_banners?.banner_filiais_url || ""}
                  placeholder="/racon/racon-rubinho-conquiste.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        banner_filiais_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          banner_filiais_url: "/racon/racon-rubinho-conquiste.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Rubinho Fachada Racon
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          banner_filiais_url: "/media/gauchinho-logo.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Logo Institucional
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900">
                  <img
                    src={identidade.imagens_banners?.banner_filiais_url || "/racon/racon-rubinho-conquiste.png"}
                    alt="Preview Filiais"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>

              {/* 6. Embaixador na Seção de Credibilidade */}
              <div className="rounded-xl border border-slate-200 p-4 space-y-3 bg-slate-50/50 dark:border-slate-800 dark:bg-slate-800/40">
                <h4 className="text-xs font-bold text-slate-900 dark:text-white">6. Foto do Garoto Propaganda (Estatísticas)</h4>
                <input
                  value={identidade.imagens_banners?.embaixador_stats_url || ""}
                  placeholder="/racon/racon-rubinho-apontando.png"
                  onChange={(e) =>
                    setIdentidade({
                      ...identidade,
                      imagens_banners: {
                        ...identidade.imagens_banners,
                        embaixador_stats_url: e.target.value,
                      },
                    })
                  }
                  className="w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          embaixador_stats_url: "/racon/racon-rubinho-apontando.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Rubinho Apontando
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setIdentidade({
                        ...identidade,
                        imagens_banners: {
                          ...identidade.imagens_banners,
                          embaixador_stats_url: "/media/gauchinho-logo.png",
                        },
                      })
                    }
                    className="rounded bg-white px-2 py-0.5 text-[10px] font-bold border shadow-2xs hover:bg-slate-50 dark:bg-slate-900"
                  >
                    Mascote Gaúchinho
                  </button>
                </div>
                <div className="relative h-24 w-full rounded-lg overflow-hidden border bg-slate-200 dark:bg-slate-900 flex justify-center">
                  <img
                    src={identidade.imagens_banners?.embaixador_stats_url || "/racon/racon-rubinho-apontando.png"}
                    alt="Preview Embaixador"
                    className="h-full object-contain"
                  />
                </div>
              </div>
            </div>
          </section>
        )}

        {/* ABA 4: HEADER & MENUS */}
        {tab === "menus" && (

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Catálogo de Áreas e Menus Disponíveis</h2>
              <p className="text-xs text-slate-500">
                Menus que este Modelo disponibiliza. A Master Franquia poderá escolher quais habilitar no seu onboarding.
              </p>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="border-b bg-slate-50 text-left uppercase text-slate-500 dark:bg-slate-800">
                  <tr>
                    <th className="p-2.5">ID Técnico</th>
                    <th className="p-2.5">Nome de Exibição</th>
                    <th className="p-2.5">Rota / Destino</th>
                    <th className="p-2.5 text-center">Ativo Padrão</th>
                    <th className="p-2.5 text-center">Obrigatório</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                  {menus.map((item, idx) => (
                    <tr key={item.id}>
                      <td className="p-2.5 font-mono text-slate-500">{item.id}</td>
                      <td className="p-2.5">
                        <input
                          value={item.label}
                          onChange={(e) => {
                            const updated = [...menus];
                            updated[idx].label = e.target.value;
                            setMenus(updated);
                          }}
                          className="w-full rounded border border-slate-200 p-1.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-2.5">
                        <input
                          value={item.rota}
                          onChange={(e) => {
                            const updated = [...menus];
                            updated[idx].rota = e.target.value;
                            setMenus(updated);
                          }}
                          className="w-full rounded border border-slate-200 p-1.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                        />
                      </td>
                      <td className="p-2.5 text-center">
                        <input
                          type="checkbox"
                          checked={item.ativo_padrao}
                          onChange={(e) => {
                            const updated = [...menus];
                            updated[idx].ativo_padrao = e.target.checked;
                            setMenus(updated);
                          }}
                          className="h-4 w-4 rounded text-cyan-600"
                        />
                      </td>
                      <td className="p-2.5 text-center font-bold text-slate-600">
                        {item.obrigatorio ? "Sim" : "Opcional"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {/* ABA 4: HOME & SEÇÕES */}
        {tab === "secoes" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Ordem e Disponibilidade das Seções da Home</h2>
              <p className="text-xs text-slate-500">
                Ordene as seções da página inicial usando os botões ↑ e ↓ e ative/desative conforme necessário.
              </p>
            </div>

            <div className="space-y-2">
              {secoes.map((secao, idx) => (
                <div
                  key={secao.id}
                  className={`flex items-center justify-between rounded-xl border p-3 transition-colors ${
                    secao.habilitada
                      ? "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800"
                      : "border-slate-100 bg-slate-50 opacity-60 dark:border-slate-800 dark:bg-slate-900"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    <span className="flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-700 dark:bg-slate-700 dark:text-slate-200">
                      {secao.ordem}
                    </span>
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{secao.titulo}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">Tipo: {secao.tipo}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={idx === 0}
                      onClick={() => moveSection(idx, "up")}
                      className="rounded border p-1 text-xs hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700"
                      title="Subir seção"
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      disabled={idx === secoes.length - 1}
                      onClick={() => moveSection(idx, "down")}
                      className="rounded border p-1 text-xs hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700"
                      title="Descer seção"
                    >
                      ↓
                    </button>
                    <button
                      type="button"
                      onClick={() => toggleSection(secao.id)}
                      className={`rounded px-2.5 py-1 text-xs font-bold ${
                        secao.habilitada
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-400"
                      }`}
                    >
                      {secao.habilitada ? "Ativa" : "Oculta"}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ABA 5: FOOTER */}
        {tab === "footer" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Estrutura do Rodapé</h2>
            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Texto de Copyright / Regulatório:</label>
              <textarea
                rows={3}
                value={copyright}
                onChange={(e) => setCopyright(e.target.value)}
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </section>
        )}

        {/* ABA 6: CÓDIGO / HTML AVANÇADO (SEGURO) */}
        {tab === "codigo" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <div className="rounded-xl border border-cyan-200 bg-cyan-50 p-4 text-xs text-slate-700 dark:border-cyan-900 dark:bg-cyan-950 dark:text-slate-300">
              <strong className="font-bold text-cyan-900 dark:text-cyan-300">Proteção de Execução Sanitizada:</strong>
              <p className="mt-1">
                Tags <code>&lt;script&gt;</code>, iframes arbitrários, handlers inline (ex: <code>onclick</code>) e protocolos executáveis são bloqueados automaticamente pelo motor de segurança.
              </p>
              {sanitizationLive.warnings.length > 0 && (
                <ul className="mt-2 list-disc pl-5 font-semibold text-amber-900 dark:text-amber-300">
                  {sanitizationLive.warnings.map((w, idx) => (
                    <li key={idx}>⚠ {w}</li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">HTML Customizado:</label>
              <textarea
                rows={6}
                value={htmlCustom}
                onChange={(e) => setHtmlCustom(e.target.value)}
                placeholder="<!-- Blocos HTML seguros adicionais -->"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>

            <div>
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">CSS Customizado:</label>
              <textarea
                rows={6}
                value={cssCustom}
                onChange={(e) => setCssCustom(e.target.value)}
                placeholder="/* Regras CSS complementares */"
                className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-800"
              />
            </div>
          </section>
        )}

        {/* ABA 7: PREVIEW DINÂMICO */}
        {tab === "preview" && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-3 dark:border-slate-800 dark:bg-slate-900">
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Dispositivo:</span>
                {(["desktop", "tablet", "mobile"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPreviewViewport(mode)}
                    className={`rounded-lg px-3 py-1 text-xs font-bold capitalize ${
                      previewViewport === mode
                        ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                        : "border bg-slate-50 text-slate-700 hover:bg-slate-100 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {mode}
                  </button>
                ))}
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-slate-700 dark:text-slate-300">Dados do Tenant:</span>
                <select
                  value={previewEmpresaNome}
                  onChange={(e) => setPreviewEmpresaNome(e.target.value)}
                  className="rounded-lg border border-slate-200 p-1.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value="Franqueadora Demonstração">Franqueadora Demonstração</option>
                  {empresas.map((emp) => (
                    <option key={emp.id} value={emp.nome_fantasia}>
                      {emp.nome_fantasia}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Container do Preview */}
            <div className="flex justify-center rounded-2xl border border-slate-200 bg-slate-100 p-4 dark:border-slate-800 dark:bg-slate-950 overflow-x-auto">
              <div
                style={{
                  width: previewViewport === "desktop" ? "100%" : previewViewport === "tablet" ? "768px" : "375px",
                  maxWidth: "1280px",
                }}
                className="overflow-hidden shadow-2xl transition-all border border-slate-200 dark:border-slate-800 rounded-2xl bg-white"
              >
                <RaconInspiredHome
                  empresaNome={previewEmpresaNome}
                  logoUrl={template.permite_logo_propria ? logoPadraoUrl : null}
                  identidade={identidade}
                  menus={menus}
                  secoes={secoes}
                  footerCopyright={copyright}
                  isInteractive={false}
                />
              </div>
            </div>
          </section>
        )}


        {/* ABA 8: HISTÓRICO */}
        {tab === "historico" && (
          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Histórico de Alterações do Modelo</h2>
            {historico.length === 0 ? (
              <p className="text-xs text-slate-500">Nenhum evento registrado ainda.</p>
            ) : (
              <div className="divide-y divide-slate-100 text-xs">
                {historico.map((h) => (
                  <div key={h.id} className="py-2.5 flex items-center justify-between">
                    <div>
                      <strong className="text-slate-800 dark:text-slate-200">{h.acao}</strong>
                      <p className="text-[11px] text-slate-400">{new Date(h.created_at).toLocaleString("pt-BR")}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Botão de Salvar Global */}
        {tab !== "preview" && tab !== "historico" && (
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <button
              type="submit"
              disabled={isPendingSave}
              className="rounded-lg bg-cyan-700 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50"
            >
              {isPendingSave ? "Salvando Alterações..." : "💾 Salvar Configurações do Modelo"}
            </button>
          </div>
        )}
      </form>
    </div>
  );
}
