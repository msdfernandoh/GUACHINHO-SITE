"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  onboardingMasterFranquiaAction,
  type PlatformFormState,
} from "@/app/platform/empresas/actions";
import { EmpresaEnderecoFields, type EmpresaEnderecoState } from "@/components/platform/empresa-endereco-fields";
import { formatCnpjBrInput, formatWhatsappBrInput } from "@/lib/utils/format";

type ModeloOption = {
  id: string;
  codigo: string;
  nome: string;
  status: string;
  identidade_visual?: {
    cor_primaria?: string;
    cor_secundaria?: string;
    cor_destaque?: string;
  };
  catalogo_menus?: { id: string; label: string; rota: string; ativo_padrao: boolean }[];
  permite_logo_propria?: boolean;
};

type ModuloOption = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  ordem_padrao?: number;
};

type AdminOption = {
  id: string;
  nome: string;
  nome_fantasia?: string | null;
  status: string;
};

type PlanoOption = {
  id: string;
  codigo: string;
  nome: string;
  descricao?: string | null;
  valor_mensal?: number | null;
  taxa_implantacao?: number | null;
  limite_usuarios?: number | null;
  erp_incluido?: boolean;
  site_principal_incluido?: boolean;
  permite_sites_parceiros?: boolean;
  max_parceiros?: number;
  max_sites_parceiros?: number;
  max_sites_dominio_proprio?: number;
  valor_site_parceiro?: number;
  valor_site_dominio_proprio?: number;
  modulos_habilitados?: string[];
};

const initial: PlatformFormState = { status: "IDLE", message: "" };

const ETAPAS = [
  "1. Empresa",
  "2. Site & Logo",
  "3. Menus do Site",
  "4. ERP & Módulos",
  "5. Usuários",
  "6. Administradoras",
  "7. Plano SaaS",
  "8. Revisão Final",
];

export function OnboardingFranquiaClient({
  modelos,
  modulos,
  administradoras,
  planos,
}: {
  modelos: ModeloOption[];
  modulos: ModuloOption[];
  administradoras: AdminOption[];
  planos: PlanoOption[];
}) {
  const [currentStep, setCurrentStep] = useState(1);
  const [state, formAction, isPending] = useActionState(onboardingMasterFranquiaAction, initial);

  // ETAPA 1: Empresa
  const [nomeFantasia, setNomeFantasia] = useState("");
  const [razaoSocial, setRazaoSocial] = useState("");
  const [slug, setSlug] = useState("");
  const [cnpj, setCnpj] = useState("");
  const [email, setEmail] = useState("");
  const [telefone, setTelefone] = useState("");
  const [whatsapp, setWhatsapp] = useState("");
  const [enderecoEmpresa, setEnderecoEmpresa] = useState<EmpresaEnderecoState>({
    cep: "",
    endereco: "",
    numero: "",
    complemento: "",
    bairro: "",
    cidade: "",
    estado: "",
  });

  function autoSlug(str: string) {
    return str
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  // ETAPA 2: Site & Logo
  const [modeloSiteId, setModeloSiteId] = useState(modelos[0]?.id ?? "");
  const [usarLogoPropria, setUsarLogoPropria] = useState(false);
  const [logoUrl, setLogoUrl] = useState("");

  // Modelo Selecionado
  const selectedModelo = modelos.find((m) => m.id === modeloSiteId) ?? modelos[0];

  // ETAPA 3: Menus
  const [menusHabilitados, setMenusHabilitados] = useState<string[]>(
    (selectedModelo?.catalogo_menus ?? []).filter((m) => m.ativo_padrao).map((m) => m.id),
  );

  const toggleMenu = (menuId: string) => {
    setMenusHabilitados((prev) =>
      prev.includes(menuId) ? prev.filter((id) => id !== menuId) : [...prev, menuId],
    );
  };

  const handleModeloChange = (id: string) => {
    setModeloSiteId(id);
    const mod = modelos.find((m) => m.id === id);
    if (mod?.catalogo_menus) {
      setMenusHabilitados(mod.catalogo_menus.filter((m) => m.ativo_padrao).map((m) => m.id));
    }
  };

  // ETAPA 4: ERP
  const [erpHabilitado, setErpHabilitado] = useState(true);
  const [modulosSelecionados, setModulosSelecionados] = useState<string[]>(
    modulos.map((m) => m.codigo),
  );

  const toggleModulo = (codigo: string) => {
    setModulosSelecionados((prev) =>
      prev.includes(codigo) ? prev.filter((c) => c !== codigo) : [...prev, codigo],
    );
  };

  // ETAPA 5: Usuários
  const [limiteUsuarios, setLimiteUsuarios] = useState(10);
  const [responsavelNome, setResponsavelNome] = useState("");
  const [responsavelEmail, setResponsavelEmail] = useState("");
  const [responsavelTelefone, setResponsavelTelefone] = useState("");

  // ETAPA 6: Administradoras
  const [administradorasSelecionadas, setAdministradorasSelecionadas] = useState<string[]>(
    administradoras.slice(0, 1).map((a) => a.id),
  );

  const toggleAdmin = (id: string) => {
    setAdministradorasSelecionadas((prev) =>
      prev.includes(id) ? prev.filter((a) => a !== id) : [...prev, id],
    );
  };

  // ETAPA 7: Plano SaaS e Quotas Contratadas
  const [planoId, setPlanoId] = useState(planos[0]?.id ?? "");
  const [sitesParceirosContratados, setSitesParceirosContratados] = useState(0);
  const [sitesDominioProprioContratados, setSitesDominioProprioContratados] = useState(0);

  const selectedPlano = planos.find((p) => p.id === planoId);

  // Sincronizar herança ao selecionar plano
  const handleSelectPlano = (pId: string) => {
    setPlanoId(pId);
    const p = planos.find((item) => item.id === pId);
    if (p) {
      if (p.erp_incluido === false) {
        setErpHabilitado(false);
      } else {
        setErpHabilitado(true);
        if (p.modulos_habilitados && p.modulos_habilitados.length > 0) {
          setModulosSelecionados(p.modulos_habilitados);
        }
      }
      if (p.limite_usuarios) {
        setLimiteUsuarios(p.limite_usuarios);
      }
      // Ajustar quotas se excederem o limite do novo plano
      if (p.max_sites_parceiros != null && sitesParceirosContratados > p.max_sites_parceiros) {
        setSitesParceirosContratados(p.max_sites_parceiros);
      }
      if (p.max_sites_dominio_proprio != null && sitesDominioProprioContratados > p.max_sites_dominio_proprio) {
        setSitesDominioProprioContratados(p.max_sites_dominio_proprio);
      }
    }
  };

  // Cálculos financeiros informativos
  const valorPlanoBase = selectedPlano?.valor_mensal || 0;
  const valorSitesParceiros = sitesParceirosContratados * (selectedPlano?.valor_site_parceiro || 0);
  const valorDominiosProprios = sitesDominioProprioContratados * (selectedPlano?.valor_site_dominio_proprio || 0);
  const totalMensalEstimado = valorPlanoBase + valorSitesParceiros + valorDominiosProprios;

  // Validação para avançar
  const canAdvance = () => {
    if (currentStep === 1) {
      return nomeFantasia.trim().length > 0 && razaoSocial.trim().length > 0 && slug.trim().length > 0;
    }
    return true;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <div>
        <Link
          href="/platform/empresas"
          className="text-xs font-bold uppercase tracking-wider text-cyan-700 hover:underline dark:text-cyan-400"
        >
          ← Master Franquias
        </Link>
        <h1 className="mt-2 text-3xl font-extrabold text-slate-900 dark:text-white">
          Onboarding de Nova Master Franquia
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Cadastro guiado com governança completa: Site, Menus, ERP, Usuários, Administradoras e Plano.
        </p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <div className="flex min-w-[700px] items-center justify-between">
          {ETAPAS.map((label, idx) => {
            const stepNum = idx + 1;
            const isDone = currentStep > stepNum;
            const isCurrent = currentStep === stepNum;

            return (
              <button
                key={label}
                type="button"
                onClick={() => isDone && setCurrentStep(stepNum)}
                className={`flex items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs font-bold transition-colors ${
                  isCurrent
                    ? "bg-cyan-700 text-white"
                    : isDone
                      ? "bg-cyan-50 text-cyan-800 hover:bg-cyan-100 dark:bg-cyan-950 dark:text-cyan-300"
                      : "text-slate-400 opacity-60"
                }`}
              >
                <span
                  className={`flex h-5 w-5 items-center justify-center rounded-full text-[10px] ${
                    isCurrent
                      ? "bg-white text-cyan-800"
                      : isDone
                        ? "bg-cyan-700 text-white"
                        : "bg-slate-200 text-slate-600 dark:bg-slate-700 dark:text-slate-300"
                  }`}
                >
                  {isDone ? "✓" : stepNum}
                </span>
                <span>{label.split(". ")[1]}</span>
              </button>
            );
          })}
        </div>
      </div>

      {state.message && (
        <p role="status" className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-800">
          {state.message}
        </p>
      )}

      <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        <input type="hidden" name="nome_fantasia" value={nomeFantasia} />
        <input type="hidden" name="razao_social" value={razaoSocial} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="cnpj" value={cnpj} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="telefone" value={telefone} />
        <input type="hidden" name="whatsapp" value={whatsapp} />
        <input type="hidden" name="cep" value={enderecoEmpresa.cep} />
        <input type="hidden" name="endereco" value={enderecoEmpresa.endereco} />
        <input type="hidden" name="numero" value={enderecoEmpresa.numero} />
        <input type="hidden" name="complemento" value={enderecoEmpresa.complemento} />
        <input type="hidden" name="bairro" value={enderecoEmpresa.bairro} />
        <input type="hidden" name="cidade" value={enderecoEmpresa.cidade} />
        <input type="hidden" name="estado" value={enderecoEmpresa.estado} />
        <input type="hidden" name="modelo_site_id" value={modeloSiteId} />
        <input type="hidden" name="usar_logo_propria" value={String(usarLogoPropria)} />
        <input type="hidden" name="logo_url" value={logoUrl} />
        <input type="hidden" name="menus_habilitados_json" value={JSON.stringify(menusHabilitados)} />
        <input type="hidden" name="erp_habilitado" value={String(erpHabilitado)} />
        <input type="hidden" name="modulos_erp_json" value={JSON.stringify(modulosSelecionados)} />
        <input type="hidden" name="limite_usuarios" value={String(limiteUsuarios)} />
        <input type="hidden" name="responsavel_nome" value={responsavelNome} />
        <input type="hidden" name="responsavel_email" value={responsavelEmail} />
        <input type="hidden" name="responsavel_telefone" value={responsavelTelefone} />
        <input type="hidden" name="administradoras_ids_json" value={JSON.stringify(administradorasSelecionadas)} />
        <input type="hidden" name="plano_id" value={planoId} />
        <input type="hidden" name="sites_parceiros_contratados" value={String(sitesParceirosContratados)} />
        <input type="hidden" name="sites_dominio_proprio_contratados" value={String(sitesDominioProprioContratados)} />

        {currentStep === 1 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 1 — Dados Cadastrais da Empresa</h2>
              <p className="text-xs text-slate-500">Informações jurídicas e comerciais da nova Master Franquia.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Fantasia *:</label>
                <input
                  value={nomeFantasia}
                  onChange={(e) => {
                    setNomeFantasia(e.target.value);
                    setSlug(autoSlug(e.target.value));
                  }}
                  placeholder="Ex: Gauchinho Consórcios Curitiba"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Razão Social *:</label>
                <input
                  value={razaoSocial}
                  onChange={(e) => setRazaoSocial(e.target.value)}
                  placeholder="Ex: Gauchinho Consórcios Curitiba LTDA"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Identificador URL (Slug) *:</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(autoSlug(e.target.value))}
                  placeholder="curitiba"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                />
                <p className="mt-1 text-[11px] text-slate-400">Usado em subdomínios e rotas internas.</p>
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">CNPJ:</label>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(formatCnpjBrInput(e.target.value))}
                  inputMode="numeric"
                  maxLength={18}
                  placeholder="00.000.000/0001-00"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail Comercial:</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="contato@franquia.com.br"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">WhatsApp / Telefone:</label>
                <input
                  value={whatsapp}
                  onChange={(e) => {
                    const valor = formatWhatsappBrInput(e.target.value);
                    setWhatsapp(valor);
                    setTelefone(valor);
                  }}
                  inputMode="tel"
                  maxLength={15}
                  placeholder="(41) 99999-9999"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
            <EmpresaEnderecoFields
              values={enderecoEmpresa}
              onChange={(patch) => setEnderecoEmpresa((atual) => ({ ...atual, ...patch }))}
            />
          </div>
        )}

        {currentStep === 2 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 2 — Modelo de Site & Logomarca</h2>
              <p className="text-xs text-slate-500">Selecione o modelo visual publicado que será a base do site da franquia.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {modelos.map((mod) => {
                const isSelected = mod.id === modeloSiteId;
                const colors = mod.identidade_visual || {};
                return (
                  <div
                    key={mod.id}
                    onClick={() => handleModeloChange(mod.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-cyan-600 bg-cyan-50/50 shadow-md ring-2 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-xs">{mod.nome}</h4>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        {mod.codigo}
                      </span>
                    </div>
                    <div className="mt-3 flex items-center gap-2">
                      <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: colors.cor_primaria || "#0284c7" }} />
                      <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: colors.cor_secundaria || "#0f172a" }} />
                      <div className="h-4 w-4 rounded-full border border-slate-200" style={{ backgroundColor: colors.cor_destaque || "#f59e0b" }} />
                      <span className="text-[11px] text-slate-500">Paleta base</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800/60 space-y-3">
              <label className="flex items-center gap-3 text-xs font-bold text-slate-800 dark:text-slate-200 cursor-pointer">
                <input
                  type="checkbox"
                  checked={usarLogoPropria}
                  onChange={(e) => setUsarLogoPropria(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600"
                />
                <span>Utilizar Logomarca Própria desta Master Franquia</span>
              </label>
              {usarLogoPropria && (
                <div>
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL Segura da Imagem do Logo:</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://exemplo.com/logo-franquia.png"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 3 — Menus do Site Institucional</h2>
              <p className="text-xs text-slate-500">Selecione as páginas e seções que estarão ativas na navegação do site desta franquia.</p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              {(selectedModelo?.catalogo_menus ?? []).map((menu) => {
                const isChecked = menusHabilitados.includes(menu.id);
                return (
                  <label
                    key={menu.id}
                    className={`flex items-center justify-between rounded-xl border p-3 cursor-pointer transition-colors ${
                      isChecked
                        ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30"
                        : "border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleMenu(menu.id)}
                        className="h-4 w-4 rounded text-cyan-600"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{menu.label}</h4>
                        <p className="text-[11px] font-mono text-slate-400">{menu.rota}</p>
                      </div>
                    </div>
                    <span className="text-[11px] font-bold text-cyan-700 dark:text-cyan-400">{isChecked ? "Ativo" : "Oculto"}</span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3 dark:border-slate-800">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 4 — Módulos do Sistema ERP</h2>
                <p className="text-xs text-slate-500">Configure o acesso ao ERP interno e escolha os módulos.</p>
              </div>
              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpHabilitado}
                  disabled={selectedPlano?.erp_incluido === false}
                  onChange={(e) => setErpHabilitado(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600 disabled:opacity-50"
                />
                <span>ERP Habilitado</span>
              </label>
            </div>
            {erpHabilitado && (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {modulos.map((mod) => {
                  const isChecked = modulosSelecionados.includes(mod.codigo);
                  return (
                    <label key={mod.id} className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${isChecked ? "border-cyan-300 bg-cyan-50/50" : "border-slate-200 bg-white opacity-60"}`}>
                      <input type="checkbox" checked={isChecked} onChange={() => toggleModulo(mod.codigo)} className="mt-0.5 h-4 w-4 rounded text-cyan-600" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{mod.nome}</h4>
                        <p className="text-[11px] text-slate-500">{mod.descricao}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {currentStep === 5 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 5 — Usuários e Gestão</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Limite de Usuários Permitidos:</label>
                <input
                  type="number"
                  min={1}
                  value={limiteUsuarios}
                  onChange={(e) => setLimiteUsuarios(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Responsável Inicial:</label>
                <input value={responsavelNome} onChange={(e) => setResponsavelNome(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail do Responsável:</label>
                <input type="email" value={responsavelEmail} onChange={(e) => setResponsavelEmail(e.target.value)} className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800" />
              </div>
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone:</label>
                <input
                  value={responsavelTelefone}
                  onChange={(e) => setResponsavelTelefone(formatWhatsappBrInput(e.target.value))}
                  inputMode="tel"
                  maxLength={15}
                  placeholder="(65) 99999-9999"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {currentStep === 6 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 6 — Administradoras</h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {administradoras.map((admin) => {
                const isChecked = administradorasSelecionadas.includes(admin.id);
                return (
                  <label key={admin.id} className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${isChecked ? "border-cyan-300 bg-cyan-50/50" : "border-slate-200"}`}>
                    <div className="flex items-center gap-3">
                      <input type="checkbox" checked={isChecked} onChange={() => toggleAdmin(admin.id)} className="h-4 w-4 rounded text-cyan-600" />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900">{admin.nome_fantasia || admin.nome}</h4>
                      </div>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {currentStep === 7 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 7 — Plano Comercial SaaS & Quotas</h2>
              <p className="text-xs text-slate-500">Selecione o plano da franquia no catálogo SaaS e informe as quotas contratadas.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {planos.map((plano) => {
                const isSelected = plano.id === planoId;
                return (
                  <div
                    key={plano.id}
                    onClick={() => handleSelectPlano(plano.id)}
                    className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                      isSelected
                        ? "border-cyan-600 bg-cyan-50/50 shadow-md ring-2 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{plano.nome}</h4>
                      <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
                        {plano.valor_mensal != null ? `R$ ${Number(plano.valor_mensal).toFixed(2)}/mês` : "Sob Consulta"}
                      </span>
                    </div>
                    <p className="mt-2 text-xs text-slate-500">{plano.descricao || "Plano comercial da plataforma."}</p>
                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800">
                      <span>Limite: {plano.limite_usuarios ?? "10"} usuários</span>
                      <span>{plano.permite_sites_parceiros ? `Até ${plano.max_sites_parceiros} parceiros` : "Sem sites parceiros"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {selectedPlano?.permite_sites_parceiros && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 dark:border-slate-800 dark:bg-slate-800/40 space-y-4">
                <h4 className="text-xs font-bold uppercase tracking-wider text-slate-700 dark:text-slate-300">Sites de Parceiros Contratados</h4>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Sites de Parceiros (Máx: {selectedPlano.max_sites_parceiros ?? 0}):</label>
                    <input
                      type="number"
                      min={0}
                      max={selectedPlano.max_sites_parceiros ?? 0}
                      value={sitesParceirosContratados}
                      onChange={(e) => setSitesParceirosContratados(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                  <div>
                    <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Domínios Próprios (Máx: {selectedPlano.max_sites_dominio_proprio ?? 0}):</label>
                    <input
                      type="number"
                      min={0}
                      max={Math.min(sitesParceirosContratados, selectedPlano.max_sites_dominio_proprio ?? 0)}
                      value={sitesDominioProprioContratados}
                      onChange={(e) => setSitesDominioProprioContratados(Number(e.target.value))}
                      className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                    />
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 8 — Revisão Geral do Onboarding</h2>
              <p className="text-xs text-slate-500">Confira as configurações e o resumo financeiro antes de oficializar a criação.</p>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold uppercase text-[11px] tracking-wider text-slate-500">Empresa</h4>
                <p><strong>Nome Fantasia:</strong> {nomeFantasia}</p>
                <p><strong>Slug:</strong> {slug}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold uppercase text-[11px] tracking-wider text-slate-500">Site & Identidade</h4>
                <p><strong>Modelo:</strong> {selectedModelo?.nome || "Padrão"}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold uppercase text-[11px] tracking-wider text-slate-500">ERP & Gestão</h4>
                <p><strong>ERP:</strong> {erpHabilitado ? "Habilitado" : "Desabilitado"}</p>
              </div>
              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold uppercase text-[11px] tracking-wider text-slate-500">Comercial</h4>
                <p><strong>Plano SaaS:</strong> {selectedPlano?.nome || "Básico"}</p>
                <p><strong>Sites Parceiros:</strong> {sitesParceirosContratados}</p>
              </div>
            </div>
            <div className="rounded-2xl border border-cyan-200 bg-cyan-50/60 p-5 dark:border-cyan-900 dark:bg-cyan-950/40 space-y-3">
              <h4 className="text-xs font-bold uppercase tracking-wider text-cyan-900 dark:text-cyan-200">Resumo Financeiro & Entitlements Estimados</h4>
              <div className="divide-y divide-cyan-200/60 text-xs dark:divide-cyan-800/60">
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">Plano SaaS ({selectedPlano?.nome || "Padrão"}):</span>
                  <strong>R$ {valorPlanoBase.toFixed(2)}/mês</strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">Limite de Usuários:</span>
                  <strong>{limiteUsuarios} usuários</strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">Site Principal:</span>
                  <strong>{selectedPlano?.site_principal_incluido !== false ? "Incluído no Plano" : "Não Incluso"}</strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">Sites de Parceiros ({sitesParceirosContratados} un × R$ {(selectedPlano?.valor_site_parceiro || 0).toFixed(2)}):</span>
                  <strong>R$ {valorSitesParceiros.toFixed(2)}/mês</strong>
                </div>
                <div className="flex justify-between py-1.5">
                  <span className="text-slate-700 dark:text-slate-300">Domínios Próprios ({sitesDominioProprioContratados} un × R$ {(selectedPlano?.valor_site_dominio_proprio || 0).toFixed(2)}):</span>
                  <strong>R$ {valorDominiosProprios.toFixed(2)}/mês</strong>
                </div>
                <div className="flex justify-between pt-2.5 text-sm font-extrabold text-cyan-950 dark:text-cyan-100">
                  <span>TOTAL MENSAL ESTIMADO:</span>
                  <span className="font-mono text-base text-cyan-700 dark:text-cyan-400">R$ {totalMensalEstimado.toFixed(2)}/mês</span>
                </div>
              </div>
            </div>

          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          <button
            type="button"
            onClick={() => setCurrentStep((prev) => Math.max(1, prev - 1))}
            disabled={currentStep === 1 || isPending}
            className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30 dark:border-slate-700 dark:text-slate-300"
          >
            ← Voltar
          </button>
          {currentStep < 8 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => Math.min(8, prev + 1))}
              disabled={!canAdvance()}
              className="rounded-lg bg-cyan-700 px-6 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-40"
            >
              Avançar →
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-8 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Criando Franquia..." : "✓ Finalizar Onboarding em Treinamento"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
