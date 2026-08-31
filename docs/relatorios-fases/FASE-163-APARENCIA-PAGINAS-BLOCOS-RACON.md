# Fase 163 — Aparência Racon por página e bloco

## Entrega

- Nova aba no modelo: Fotos e cores por página / bloco.
- Cores independentes de fundo, títulos, textos, destaques, botões e texto dos botões.
- Upload, biblioteca e URL de imagem com preenchimento e posição focal.
- Home: banner, simulador, produtos, três cards, benefícios, unidades, estatísticas e franquia.
- Simulador: cabeçalho, escolhas, crédito, prazo, parcela, estratégia, financiamento e resultado.
- Grupos: cabeçalho, tabela e totais. Outras páginas do catálogo: página, cabeçalho e conteúdo.
- Logomarca oficial copiada sem edição de analise/logoracon.jpg; configurável no modelo.
- Ativação explícita de menus aplicada ao desktop, mobile e rodapé, distinta de ativo padrão.
- Preview e site usam o mesmo cabeçalho/rodapé; removida a marca legada do preview.
- Seleções, resultado e cabeçalho da tabela azuis; textos sobre fotos e estatísticas com contraste claro.

## Persistência e segurança

Reuso de identidade_visual, catalogo_menus, logo_padrao_url e RPC existente.
Sem novas tabelas, migrations ou mutações de dados comerciais. URLs e cores
normalizadas antes da persistência e renderização. URLs HTTPS externas não
dependem do otimizador Next para serem exibidas. A publicação de configurações
continua restrita ao Platform Superadmin.

O editor altera o modelo compartilhado pelas empresas que o utilizam. Não
altera o modelo Gauchinho. A configuração de menus é visual e mantém intactas
as autorizações multiempresa.

## Validação

- Build de produção e TypeScript aprovados; suíte completa com 1.120 testes
  aprovados e 37 ignorados pelas condições já existentes.
- ESLint sem erros nos arquivos novos e principais arquivos alterados.

- Testes unitários de isolamento, round-trip JSON, herança, imagens e rejeição de injeção CSS.
- Testes de seleção de menus e contratos de identidade/rotas.
- Navegador local: logo oficial, home, cores das seleções e resultado no simulador.
- Editor exercitado em fixture local temporária, removida antes da entrega:
  título do card de veículos alterado para #ffcc00, texto #ddeeff e foto trocada;
  card de imóveis preservou foto e cores. Nenhuma configuração de produção
  foi usada como dado de teste.

## Operação

Platform → Modelos de Site → Racon Inspired:
Geral / Logomarca para logo; Header & Menus para ativação;
Fotos e cores por página / bloco para personalização.
Salvar Configurações do Modelo publica as alterações pela rotina existente.
