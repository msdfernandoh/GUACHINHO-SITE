"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import {
  onboardingMasterFranquiaAction,
  type PlatformFormState,
} from "@/app/platform/empresas/actions";

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
  const [cidade, setCidade] = useState("");
  const [estado, setEstado] = useState("");

  // Gerar slug automaticamente
  const handleNomeFantasiaChange = (val: string) => {
    setNomeFantasia(val);
    if (!slug || slug === autoSlug(nomeFantasia)) {
      setSlug(autoSlug(val));
    }
  };

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

  // Ao mudar de modelo, atualizar lista de menus padrão
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

  // ETAPA 7: Plano
  const [planoId, setPlanoId] = useState(planos[0]?.id ?? "");
  const selectedPlano = planos.find((p) => p.id === planoId);

  // Validação para avançar
  const canAdvance = () => {
    if (currentStep === 1) {
      return nomeFantasia.trim().length > 0 && razaoSocial.trim().length > 0 && slug.trim().length > 0;
    }
    return true;
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      {/* Header */}
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
          Cadastro guiado com governança completa: Site, Menus, ERP, Usuários, Administradoras e Plano. A franquia será criada no status seguro de <strong>Treinamento</strong>.
        </p>
      </div>

      {/* Barra de Progresso das 8 Etapas */}
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

      {/* Erro */}
      {state.message && (
        <p role="status" className="rounded-lg bg-red-50 p-3 text-xs font-bold text-red-800">
          {state.message}
        </p>
      )}

      {/* Formulário Principal */}
      <form action={formAction} className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm dark:border-slate-800 dark:bg-slate-900 space-y-6">
        {/* Hidden inputs para payload completo */}
        <input type="hidden" name="nome_fantasia" value={nomeFantasia} />
        <input type="hidden" name="razao_social" value={razaoSocial} />
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="cnpj" value={cnpj} />
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="telefone" value={telefone} />
        <input type="hidden" name="whatsapp" value={whatsapp} />
        <input type="hidden" name="cidade" value={cidade} />
        <input type="hidden" name="estado" value={estado} />
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

        {/* ETAPA 1: DADOS DA EMPRESA */}
        {currentStep === 1 && (
          <div className="space-y-4">
            <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 1 — Dados Cadastrais da Empresa</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome Fantasia *:</label>
                <input
                  value={nomeFantasia}
                  onChange={(e) => handleNomeFantasiaChange(e.target.value)}
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
                  placeholder="Ex: Curitiba Consórcios e Investimentos LTDA"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-semibold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Slug da Empresa (Gerado automaticamente):</label>
                <input
                  value={slug}
                  onChange={(e) => setSlug(e.target.value)}
                  placeholder="Ex: gauchinho-curitiba"
                  required
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-mono dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">CNPJ (Opcional):</label>
                <input
                  value={cnpj}
                  onChange={(e) => setCnpj(e.target.value)}
                  placeholder="00.000.000/0000-00"
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
                    setWhatsapp(e.target.value);
                    if (!telefone) setTelefone(e.target.value);
                  }}
                  placeholder="(41) 99999-9999"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Cidade:</label>
                <input
                  value={cidade}
                  onChange={(e) => setCidade(e.target.value)}
                  placeholder="Ex: Curitiba"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Estado (UF):</label>
                <input
                  value={estado}
                  onChange={(e) => setEstado(e.target.value.toUpperCase())}
                  placeholder="PR"
                  maxLength={2}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 2: SITE & LOGO */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 2 — Modelo de Site e Identidade</h2>
              <p className="text-xs text-slate-500">Selecione o Modelo de Site visual que será atribuído a esta Franquia.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {modelos.map((m) => {
                const isSelected = m.id === modeloSiteId;
                const prim = m.identidade_visual?.cor_primaria || "#0284c7";
                const sec = m.identidade_visual?.cor_secundaria || "#0f172a";
                const dest = m.identidade_visual?.cor_destaque || "#f59e0b";

                return (
                  <div
                    key={m.id}
                    onClick={() => handleModeloChange(m.id)}
                    className={`cursor-pointer rounded-2xl border p-4 transition-all ${
                      isSelected
                        ? "border-cyan-600 bg-cyan-50/50 shadow-md ring-2 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{m.nome}</h4>
                      <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-600 dark:bg-slate-800 dark:text-slate-400">
                        {m.status}
                      </span>
                    </div>

                    {/* Paleta */}
                    <div className="mt-3 flex items-center gap-2">
                      <span className="text-[11px] font-semibold text-slate-500">Cores:</span>
                      <div className="flex items-center gap-1">
                        <span style={{ backgroundColor: prim }} className="h-4 w-4 rounded-full border border-white shadow-xs" />
                        <span style={{ backgroundColor: sec }} className="h-4 w-4 rounded-full border border-white shadow-xs" />
                        <span style={{ backgroundColor: dest }} className="h-4 w-4 rounded-full border border-white shadow-xs" />
                      </div>
                    </div>

                    <p className="mt-3 text-xs text-slate-500 line-clamp-2">
                      {m.codigo === "racon_inspired"
                        ? "Linguagem visual inspirada em tons azul escuro/royal e amarelo destaque, com cards arredondados."
                        : "Modelo canônico padrão do ecossistema Gauchinho."}
                    </p>
                  </div>
                );
              })}
            </div>

            {/* Configuração de Logo Próprio */}
            <div className="rounded-xl border border-slate-200 p-4 dark:border-slate-800 space-y-3">
              <label className="text-xs font-bold text-slate-700 dark:text-slate-300">
                Esta franquia utilizará logomarca própria?
              </label>
              <div className="flex items-center gap-4 text-xs">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rdLogo"
                    checked={!usarLogoPropria}
                    onChange={() => setUsarLogoPropria(false)}
                    className="text-cyan-600"
                  />
                  <span>Não (Usar a identidade e logotipo padrão do Modelo)</span>
                </label>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="rdLogo"
                    checked={usarLogoPropria}
                    onChange={() => setUsarLogoPropria(true)}
                    className="text-cyan-600"
                  />
                  <span>Sim (Franquia possui logotipo próprio)</span>
                </label>
              </div>

              {usarLogoPropria && (
                <div className="pt-2">
                  <label className="text-xs font-bold text-slate-700 dark:text-slate-300">URL da Logomarca da Franquia:</label>
                  <input
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://sua-empresa.com.br/logo.svg"
                    className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                  />
                </div>
              )}
            </div>
          </div>
        )}

        {/* ETAPA 3: MENUS */}
        {currentStep === 3 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 3 — Menus e Navegação do Site</h2>
              <p className="text-xs text-slate-500">
                Habilite as opções de menu que devem estar disponíveis no site desta Franquia (conforme catálogo do modelo <strong>{selectedModelo?.nome}</strong>).
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
              {(selectedModelo?.catalogo_menus ?? []).map((item) => {
                const isChecked = menusHabilitados.includes(item.id);
                return (
                  <label
                    key={item.id}
                    className={`flex items-center gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                      isChecked
                        ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30"
                        : "border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleMenu(item.id)}
                      className="h-4 w-4 rounded text-cyan-600"
                    />
                    <div>
                      <h4 className="text-xs font-bold text-slate-900 dark:text-white">{item.label}</h4>
                      <p className="text-[11px] text-slate-400 font-mono">{item.rota}</p>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPA 4: ERP & MÓDULOS */}
        {currentStep === 4 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 4 — ERP e Módulos Operacionais</h2>
                <p className="text-xs text-slate-500">Configure o acesso ao ERP interno e escolha os módulos autorizados.</p>
              </div>

              <label className="flex items-center gap-2 text-xs font-bold cursor-pointer">
                <input
                  type="checkbox"
                  checked={erpHabilitado}
                  onChange={(e) => setErpHabilitado(e.target.checked)}
                  className="h-4 w-4 rounded text-cyan-600"
                />
                <span>ERP Habilitado</span>
              </label>
            </div>

            {erpHabilitado ? (
              <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
                {modulos.map((mod) => {
                  const isChecked = modulosSelecionados.includes(mod.codigo);
                  return (
                    <label
                      key={mod.id}
                      className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition-colors ${
                        isChecked
                          ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30"
                          : "border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleModulo(mod.codigo)}
                        className="mt-0.5 h-4 w-4 rounded text-cyan-600"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">{mod.nome}</h4>
                        <p className="text-[11px] text-slate-500 line-clamp-2">{mod.descricao || mod.codigo}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            ) : (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-500">
                O ERP está desabilitado para esta franquia. Ela terá acesso apenas ao Site/Portal Institucional.
              </div>
            )}
          </div>
        )}

        {/* ETAPA 5: USUÁRIOS & RESPONSÁVEL */}
        {currentStep === 5 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 5 — Limite de Usuários e Responsável Inicial</h2>
              <p className="text-xs text-slate-500">Defina a quantidade de acessos permitidos e o gestor inicial da franquia.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Limite de Usuários Permitidos:</label>
                <select
                  value={limiteUsuarios}
                  onChange={(e) => setLimiteUsuarios(Number(e.target.value))}
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs font-bold dark:border-slate-700 dark:bg-slate-800"
                >
                  <option value={5}>5 Usuários</option>
                  <option value={10}>10 Usuários (Padrão)</option>
                  <option value={20}>20 Usuários</option>
                  <option value={50}>50 Usuários</option>
                  <option value={100}>100 Usuários</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Nome do Responsável Inicial:</label>
                <input
                  value={responsavelNome}
                  onChange={(e) => setResponsavelNome(e.target.value)}
                  placeholder="Ex: Fernando Silva"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">E-mail do Responsável:</label>
                <input
                  type="email"
                  value={responsavelEmail}
                  onChange={(e) => setResponsavelEmail(e.target.value)}
                  placeholder="gestor@franquia.com.br"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 dark:text-slate-300">Telefone do Responsável:</label>
                <input
                  value={responsavelTelefone}
                  onChange={(e) => setResponsavelTelefone(e.target.value)}
                  placeholder="(41) 99999-8888"
                  className="mt-1 w-full rounded-lg border border-slate-300 p-2.5 text-xs dark:border-slate-700 dark:bg-slate-800"
                />
              </div>
            </div>
          </div>
        )}

        {/* ETAPA 6: ADMINISTRADORAS */}
        {currentStep === 6 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 6 — Concessão de Administradoras Oficiais</h2>
              <p className="text-xs text-slate-500">
                Selecione as Administradoras autorizadas pela Plataforma para esta Master Franquia comercializar.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {administradoras.map((admin) => {
                const isChecked = administradorasSelecionadas.includes(admin.id);
                return (
                  <label
                    key={admin.id}
                    className={`flex items-center justify-between rounded-xl border p-4 cursor-pointer transition-colors ${
                      isChecked
                        ? "border-cyan-300 bg-cyan-50/50 dark:border-cyan-800 dark:bg-cyan-950/30"
                        : "border-slate-200 bg-white opacity-60 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => toggleAdmin(admin.id)}
                        className="h-4 w-4 rounded text-cyan-600"
                      />
                      <div>
                        <h4 className="text-xs font-bold text-slate-900 dark:text-white">
                          {admin.nome_fantasia || admin.nome}
                        </h4>
                        <p className="text-[11px] text-slate-500">Status: {admin.status}</p>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${
                        isChecked
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                          : "bg-slate-100 text-slate-500 dark:bg-slate-800"
                      }`}
                    >
                      {isChecked ? "✓ Concedida" : "Não Concedida"}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPA 7: PLANO SAAS */}
        {currentStep === 7 && (
          <div className="space-y-4">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 7 — Plano Comercial SaaS</h2>
              <p className="text-xs text-slate-500">Selecione o plano da franquia no catálogo SaaS.</p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {planos.map((plano) => {
                const isSelected = plano.id === planoId;
                return (
                  <div
                    key={plano.id}
                    onClick={() => setPlanoId(plano.id)}
                    className={`cursor-pointer rounded-2xl border p-5 transition-all ${
                      isSelected
                        ? "border-cyan-600 bg-cyan-50/50 shadow-md ring-2 ring-cyan-500 dark:border-cyan-500 dark:bg-cyan-950/40"
                        : "border-slate-200 bg-white hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <h4 className="font-bold text-slate-900 dark:text-white text-sm">{plano.nome}</h4>
                      <span className="font-mono text-xs font-bold text-cyan-700 dark:text-cyan-400">
                        {plano.valor_mensal != null ? `R$ ${plano.valor_mensal}/mês` : "Sob Consulta"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">{plano.descricao || "Plano comercial da plataforma."}</p>

                    <div className="mt-3 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-500 dark:border-slate-800">
                      <span>Limite: {plano.limite_usuarios ?? "Ilimitado"} usuários</span>
                      <span>Taxa de Implantação: {plano.taxa_implantacao != null ? `R$ ${plano.taxa_implantacao}` : "—"}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ETAPA 8: REVISÃO FINAL */}
        {currentStep === 8 && (
          <div className="space-y-6">
            <div>
              <h2 className="text-base font-bold text-slate-900 dark:text-white">Etapa 8 — Revisão Geral do Onboarding</h2>
              <p className="text-xs text-slate-500">
                Confira todas as configurações antes de oficializar a criação da Master Franquia em treinamento.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 text-xs">
              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider text-slate-500">
                  Empresa
                </h4>
                <p><strong>Nome Fantasia:</strong> {nomeFantasia}</p>
                <p><strong>Razão Social:</strong> {razaoSocial}</p>
                <p><strong>Slug:</strong> {slug}</p>
                <p><strong>Status Inicial:</strong> <span className="font-bold text-amber-700">TREINAMENTO (Inativo)</span></p>
                <p><strong>Cidade/UF:</strong> {cidade || "—"} / {estado || "—"}</p>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider text-slate-500">
                  Site & Identidade
                </h4>
                <p><strong>Modelo:</strong> {selectedModelo?.nome || "Padrão"}</p>
                <p><strong>Logomarca Própria:</strong> {usarLogoPropria ? "Sim" : "Não (Usa do modelo)"}</p>
                <p><strong>Menus Habilitados:</strong> {menusHabilitados.length} áreas ativas</p>
                <p><strong>Domínio:</strong> <span className="text-slate-400">Pendente de apontamento</span></p>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider text-slate-500">
                  ERP & Gestão
                </h4>
                <p><strong>ERP:</strong> {erpHabilitado ? "Habilitado" : "Desabilitado"}</p>
                <p><strong>Módulos:</strong> {modulosSelecionados.length} módulos ativos</p>
                <p><strong>Limite de Usuários:</strong> {limiteUsuarios} acessos</p>
                <p><strong>Responsável:</strong> {responsavelNome || "Não definido"}</p>
              </div>

              <div className="rounded-xl border bg-slate-50 p-4 dark:border-slate-800 dark:bg-slate-800 space-y-2">
                <h4 className="font-bold text-slate-900 dark:text-white uppercase text-[11px] tracking-wider text-slate-500">
                  Comercial & Administradoras
                </h4>
                <p><strong>Administradoras Concedidas:</strong> {administradorasSelecionadas.length} selecionada(s)</p>
                <p><strong>Plano SaaS:</strong> {selectedPlano?.nome || "Básico"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Botões de Navegação */}
        <div className="flex items-center justify-between border-t border-slate-100 pt-4 dark:border-slate-800">
          {currentStep > 1 ? (
            <button
              type="button"
              onClick={() => setCurrentStep((prev) => prev - 1)}
              className="rounded-lg border px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-100 dark:border-slate-700 dark:text-slate-300"
            >
              ← Voltar
            </button>
          ) : (
            <div />
          )}

          {currentStep < 8 ? (
            <button
              type="button"
              disabled={!canAdvance()}
              onClick={() => setCurrentStep((prev) => prev + 1)}
              className="rounded-lg bg-cyan-700 px-5 py-2 text-xs font-bold text-white shadow hover:bg-cyan-800 disabled:opacity-50"
            >
              Avançar →
            </button>
          ) : (
            <button
              type="submit"
              disabled={isPending}
              className="rounded-lg bg-emerald-600 px-6 py-2.5 text-xs font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
            >
              {isPending ? "Criando Master Franquia..." : "✓ Criar Master Franquia em Treinamento"}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
