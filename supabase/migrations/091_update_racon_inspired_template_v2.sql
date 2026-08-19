-- ==============================================================================
-- Migration 091: Atualização Estrutural e Publicação do Modelo Racon Inspired V2
-- Data: 18/08/2026
-- Objetivo: Evolução visual canônica do template Racon Inspired com identidade
--           fiel ao padrão Racon (topbar discreta, header clean, hero forte com
--           simulador integrado, cards de segmentos e rodapé institucional).
-- ==============================================================================

UPDATE public.site_modelos
SET
  nome = 'Racon Inspired',
  descricao = 'Modelo de alta conversão inspirado na linguagem visual Racon, com topo utilitário discreto, header limpo, hero com gradiente e simulador em destaque, cards de segmentos e rodapé institucional.',
  status = 'PUBLICADO',
  versao = 2,
  identidade_visual = '{
    "cor_primaria": "#0066cc",
    "cor_secundaria": "#0c2340",
    "cor_destaque": "#ffb800",
    "cor_fundo": "#ffffff",
    "cor_texto": "#0f172a",
    "fonte_familia": "Inter, system-ui, sans-serif",
    "border_radius": "16px",
    "estilo_botoes": "rounded-full",
    "estilo_cards": "rounded-2xl shadow-lg border border-slate-100"
  }'::jsonb,
  catalogo_menus = '[
    {"id": "home", "label": "Início", "rota": "/", "ativo_padrao": true, "obrigatorio": true},
    {"id": "simulador", "label": "Simulador", "rota": "/simulador", "ativo_padrao": true},
    {"id": "imoveis", "label": "Imóveis", "rota": "/consorcio/imoveis", "ativo_padrao": true},
    {"id": "veiculos", "label": "Veículos", "rota": "/consorcio/veiculos", "ativo_padrao": true},
    {"id": "pesados", "label": "Pesados", "rota": "/consorcio/pesados", "ativo_padrao": true},
    {"id": "grupos", "label": "Grupos & Cotas", "rota": "/grupos", "ativo_padrao": true},
    {"id": "como_funciona", "label": "Como Funciona", "rota": "/#como-funciona", "ativo_padrao": true},
    {"id": "sobre", "label": "Sobre Nós", "rota": "/#sobre", "ativo_padrao": true},
    {"id": "contato", "label": "Fale Conosco", "rota": "/#contato", "ativo_padrao": true},
    {"id": "area_parceiro", "label": "Área do Parceiro", "rota": "/area-parceiro", "ativo_padrao": true},
    {"id": "login", "label": "Login", "rota": "/login", "ativo_padrao": true}
  ]'::jsonb,
  secoes_home = '[
    {"id": "topbar", "tipo": "topbar", "titulo": "Barra Superior de Atendimento", "ordem": 1, "habilitada": true},
    {"id": "header", "tipo": "header", "titulo": "Header Branco com Navegação Limpa", "ordem": 2, "habilitada": true},
    {"id": "hero", "tipo": "hero", "titulo": "Hero em Destaque com Chamada Principal", "ordem": 3, "habilitada": true},
    {"id": "produtos", "tipo": "produtos", "titulo": "Cards Comerciais de Segmentos", "ordem": 4, "habilitada": true},
    {"id": "beneficios", "tipo": "beneficios", "titulo": "Por que Escolher o Consórcio", "ordem": 5, "habilitada": true},
    {"id": "como_funciona", "tipo": "como_funciona", "titulo": "Passo a Passo de Contemplação", "ordem": 6, "habilitada": true},
    {"id": "estatisticas", "tipo": "estatisticas", "titulo": "Números e Credibilidade", "ordem": 7, "habilitada": true},
    {"id": "cta", "tipo": "cta", "titulo": "Faça sua Simulação Agora", "ordem": 8, "habilitada": true},
    {"id": "footer", "tipo": "footer", "titulo": "Rodapé Estruturado e Regulatório", "ordem": 9, "habilitada": true}
  ]'::jsonb,
  configuracao_footer = '{
    "copyright": "Todos os direitos reservados. Administradora autorizada e fiscalizada pelo Banco Central do Brasil.",
    "links_uteis": [
      {"label": "Consórcio de Imóveis", "url": "/consorcio/imoveis"},
      {"label": "Consórcio de Automóveis", "url": "/consorcio/veiculos"},
      {"label": "Pesados e Frotas", "url": "/consorcio/pesados"},
      {"label": "Simulador Online", "url": "/simulador"},
      {"label": "Área do Parceiro", "url": "/area-parceiro"}
    ]
  }'::jsonb,
  permite_logo_propria = true,
  updated_at = NOW()
WHERE codigo = 'racon_inspired';
