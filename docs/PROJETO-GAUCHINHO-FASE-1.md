# Gauchinho Escritório de Soluções Financeiras — Fase 1

Documento de referência para a nova plataforma: site público, painel administrativo, leads, propostas, grupos/cotas e base para simuladores e PDF premium nas fases seguintes.

**Versão do documento:** 1.1  
**Data:** 15/06/2025  
**Escopo:** Fase 1 — base estrutural  
**Stack (decisão):** Next.js na Vercel + Supabase (Postgres, Auth, Storage)

---

## 1. Análise do repositório atual

| Item | Situação |
|------|----------|
| Código existente | Repositório **vazio** (greenfield) |
| Stack | A definir na implementação (recomendações na seção 2) |
| Rotas / banco / auth | Não há legado a preservar neste workspace |
| Risco de regressão | Baixo — implementação incremental sem migração de código antigo |

**Nota:** Se existir site ou admin em outro repositório ou pasta, alinhar stack e identidade visual antes de codificar. Este MD assume construção do zero neste projeto.

---

## 2. Decisões técnicas (oficial)

### 2.1 Stack

| Camada | Tecnologia | Motivo |
|--------|------------|--------|
| App full-stack | **Next.js** (App Router) | Site público + admin; deploy na **Vercel** |
| Linguagem | **TypeScript** | Tipagem para leads, propostas e cálculos |
| UI | **Tailwind CSS** + shadcn/ui ou `components/ui` | Admin limpo; `/grupos` tema escuro/dourado |
| Banco | **Supabase Postgres** | Schema relacional; JSONB para simulações |
| Migrations | **`supabase/migrations/`** | SQL versionado; `supabase db push` / CI |
| Auth | **Supabase Auth** | E-mail/senha (e extensões futuras); sessão via `@supabase/ssr` |
| Perfis de negócio | Tabela **`usuarios`** | Campo **`auth_user_id`** → `auth.users.id`; perfil `master` \| `srd` \| `imobiliaria` \| `visualizador` |
| Storage | **Supabase Storage** | PDFs de proposta (Fase 3+); bucket configurável |
| Segurança de dados | **RLS (Row Level Security)** | Políticas por perfil; operações sensíveis via service role no servidor |
| Validação | **Zod** + React Hook Form | Forms admin e fluxos públicos |

**Não usar como padrão do projeto:** Prisma, NextAuth/Auth.js dedicado, bcrypt local para senhas de usuário final (senhas ficam no Supabase Auth).

**Service role:** apenas em Server Actions / Route Handlers / `lib/supabase/admin.ts` — nunca expor `SUPABASE_SERVICE_ROLE_KEY` no client.

### 2.2 Estrutura de pastas (sugestão)

```
/
├── supabase/
│   ├── migrations/          # SQL incremental (001_initial_schema.sql, …)
│   └── seed.sql               # Dados iniciais (config, instruções Master)
├── src/
│   ├── app/
│   │   ├── (public)/          # Site + /grupos
│   │   ├── (auth)/login/
│   │   └── admin/
│   ├── components/
│   ├── lib/
│   │   ├── supabase/          # client.ts, server.ts, admin.ts
│   │   ├── auth/              # permissions.ts (perfis)
│   │   ├── grupos/            # calculos.ts
│   │   └── eventos/
│   └── server/                # services (Supabase queries)
├── .env.example
├── docs/
└── README.md
```

> O app Next.js pode viver na raiz ou em subpasta (`gauchinho-app/`) até consolidação; migrations e Supabase CLI ficam na **raiz do repositório**.

### 2.3 Rotas

| Rota | Acesso | Fase 1 |
|------|--------|--------|
| `/` | Público | Manter placeholder ou landing mínima |
| `/grupos` | Público | **Implementar** (sem link no menu) |
| `/admin/*` | Autenticado | **Implementar** |
| `/login` | Público | **Implementar** |
| Placeholders admin | Autenticado | Menu desabilitado ou “Em breve” |

Placeholders de menu (futuro): Cartas Contempladas, Imobiliárias, Imóveis, Parceiros, Casos de Sucesso, Dicas do Tchê.

### 2.4 Configurações gerais

- **Fase 1:** tabela **`configuracoes_sistema`** (`chave` + `valor` JSONB), ex.: `site`, `contato`, `propostas`, `leads`, `menus`.
- **WhatsApp por origem:** tabela `whatsapp_origens` (CRUD na aba correspondente).
- Abas mínimas: Site, Contato, Propostas, Leads, WhatsApp por Origem. Demais abas: shell “Fase futura”.

### 2.5 Onde encaixar serviços

| Domínio | Responsabilidade |
|---------|------------------|
| `server/leads/*` | CRUD, histórico, agendamento, fechamento |
| `server/propostas/*` | CRUD, vínculo lead, status, `pdf_url` reservado |
| `server/grupos/*` | Grupos, cotas, duplicar, bulk paste de créditos |
| `server/simulacoes-grupos/*` | Persistência pública + admin |
| `lib/grupos/calculos.ts` | **Única** fonte de fórmulas (parametrizável) |
| `lib/eventos/registrar.ts` | `eventos_site` |

### 2.6 PDF premium

- Campo `propostas.pdf_url` e estrutura de dados (`dados_simulacao`, `resumo_projecao`, grupos) prontos.
- Geração de PDF **fora** do escopo Fase 1.

---

## 3. Perfis de usuário e permissões

### 3.1 Perfis

| Perfil | Código | Fase 1 |
|--------|--------|--------|
| Master | `master` | Completo |
| SRD | `srd` | Operacional leads/propostas; grupos se flag global permitir |
| Imobiliária | `imobiliaria` | Estrutura (`imobiliaria_id`); telas mínimas |

### 3.2 Matriz resumida

| Ação | Master | SRD | Imobiliária |
|------|:------:|:---:|:-----------:|
| Usuários / config sensível | ✓ | ✗ | ✗ |
| Leads (ver, manual, status, retorno, obs, fechar) | ✓ | ✓ | — |
| Propostas (CRUD / ver) | ✓ | ✓ (criar/ver) | — |
| Grupos / cotas | ✓ | Condicional | — |
| Exclusão definitiva | ✓ | ✗ | ✗ |
| Dashboard completo | ✓ | Parcial* | — |

\* SRD: dashboard operacional (leads/propostas); sem métricas restritas a Master se houver.

### 3.3 Implementação de permissões

- Middleware em `/admin`: sessão + `perfil`.
- Helpers: `canManageUsers()`, `canEditSettings()`, `canManageGrupos()`, etc.
- Flag em config (aba Leads / Grupos): “SRD pode cadastrar/editar grupos”.

---

## 4. Modelo de dados

Nomes em **snake_case** no banco (Postgres/Supabase); tipos TypeScript espelham as tabelas em `supabase/migrations/`.

### 4.1 `usuarios`

| Campo | Tipo | Observação |
|-------|------|------------|
| id | UUID / cuid | PK |
| nome | string | |
| email | string | unique |
| telefone | string? | |
| perfil | enum | master, srd, imobiliaria |
| imobiliaria_id | FK? | futuro |
| ativo | boolean | |
| senha_hash | string | auth |
| created_at, updated_at | datetime | |

### 4.2 `leads`

Campos conforme especificação funcional (nome, whatsapp, email, cidade, origem, origem_detalhe, tipo_interesse, produto_interesse, valor_simulado, prazo_simulado, entrada, renda, dados_simulacao JSON, resultado_resumido, analise_ia, status, srd_responsavel_id, srd_responsavel_nome, proximo_retorno_data/hora, retorno_observacao, fechado, data_fechamento, valor_fechado, produto_fechado, motivo_perda, observacoes, criado_manual, criado_por_usuario_id, imobiliaria_id, imovel_id, carta_contemplada_id, parceiro_id, timestamps).

**Status:** configurável; padrão inicial na aba Leads.

### 4.3 `leads_historico`

Auditoria: lead_id, usuario_id, acao, descricao, status_anterior/novo, dados_anteriores/novos JSON, created_at.

### 4.4 `propostas`

Vínculo lead_id; dados cliente; tipo_proposta, tipo_bem; parceiro; valores financeiros; dados_simulacao, resumo_projecao, comparativo_financiamento JSON; consultor; contato_exibido_tipo; validade_*; pdf_url; status; observacoes.

**Status proposta:** Gerada, Enviada, Em negociação, Aprovada, Perdida, Cancelada, Arquivada.

### 4.5 `grupos_consorcio`

codigo_grupo, modalidade (Imóvel, Auto, Moto, …), administradora, taxas e flags (seguro, parcela reduzida, lance embutido), prazos, cet_percentual, status, ativo, observacoes.

### 4.6 `grupos_cotas`

grupo_id, valores de crédito/parcelas, saldo_devedor, vagas_*, status, ativo, ordem.

### 4.7 `simulacoes_grupos` e `simulacoes_grupos_itens`

Cabeçalho com totais; itens com snapshot de grupo/cota e quantidade_cotas.

### 4.8 `whatsapp_origens`

origem, ativo, exibir_botao_apos_lead, nome_atendimento, whatsapp_destino, mensagem_padrao, usar_whatsapp_principal_fallback.

### 4.9 `eventos_site`

tipo_evento, origem, pagina, entidade_*, ids relacionados, dados_evento JSON, created_at.

### 4.10 Configurações (complemento)

Tabela ou JSON versionado para abas: Site, Identidade Visual, Menus, Simulador, Financiamento, Propostas, IA, Parceiros, Leads, Contato.

---

## 5. Painel administrativo

### 5.1 Layout

- Sidebar fixa: Dashboard, Leads, Propostas, Grupos, Usuários, Configurações Gerais.
- Itens futuros visíveis como disabled ou submenu “Em breve”.
- Header: usuário logado, sair.

### 5.2 Configurações Gerais — abas

| Aba | Fase 1 |
|-----|--------|
| Site | Nome, subtítulo, descrição, URL site, status ativo |
| Contato | WhatsApp, telefone, e-mail, endereço, Instagram |
| Propostas | Validade padrão, resumo executivo, aviso legal |
| Leads | Status inicial, permitir manual, permitir arquivar |
| WhatsApp por Origem | CRUD `whatsapp_origens` |
| Demais | Shell + texto “Fase futura” |

---

## 6. Dashboard

### 6.1 Cards (sem gráficos)

- Leads novos  
- Leads em atendimento  
- Leads com retorno agendado  
- Leads fechados  
- Valor total fechado  
- Propostas geradas  
- Grupos ativos  
- Cotas disponíveis  

### 6.2 Tabelas rápidas

1. **Últimos leads** — Data, Nome, WhatsApp, Origem, Interesse, SRD, Status, Próximo retorno, Ações  
2. **Leads com retorno agendado** — Data retorno, Nome, WhatsApp, Interesse, SRD, Status, Ações  
3. **Últimas propostas** — Data, Cliente, Tipo, Valor crédito, Consultor, Status, Ações  

Queries agregadas no server; paginação curta (ex.: 10 linhas).

---

## 7. Módulo Leads

### 7.1 Lista e filtros

Período, origem, tipo interesse, status, SRD, retornos (hoje / atrasados / futuros / sem / com agendamento).

### 7.2 Cadastro manual

Campos listados na especificação; `criado_manual = true`; histórico “lead_criado”.

**Tipos de interesse:** Consórcio, Financiamento, Carta contemplada, Oportunidade imobiliária, Crédito com garantia, Outro.

### 7.3 Detalhe

Dados pessoais, origem, interesse, simulação (se houver), observações, histórico, propostas, agendamento, fechamento.

### 7.4 Fechamento (obrigatório)

valor_fechado, produto_fechado, data_fechamento, observação.

**Produtos fechados:** Consórcio, Financiamento, Carta contemplada, Crédito com garantia, Imóvel, Automóvel, Caminhão/Carreta, Outro.

---

## 8. Módulo Propostas

- Lista + filtros básicos  
- Create/Edit vinculado a lead  
- Status completo  
- Consultor e validade (dias + data calculada)  
- `dados_simulacao` e slot para itens de grupos  
- `pdf_url` nullable  

---

## 9. Módulo Grupos (admin)

### 9.1 Funcionalidades

Listar, criar, editar, inativar, **duplicar**, filtrar modalidade/status, buscar código, contagem de cotas.

### 9.2 Formulário

- Dados principais  
- Configurações financeiras  
- Cotas: CRUD inline + **colar lista** (uma linha = um valor de crédito → nova cota)

### 9.3 Duplicar grupo

Copiar `grupos_consorcio` + cotas com novos IDs; opcional sufixo no código.

---

## 10. Página pública `/grupos`

### 10.1 UX

- Tema escuro premium, destaque amarelo/dourado  
- Título “Nossos Grupos”  
- Filtros: Todos, Imóvel, Auto, Moto  
- Busca: código do grupo ou valor de crédito  
- Tabela: Grupo, Tipo, Crédito, Parcela, Prazo, Vagas, Status, Ação  

### 10.2 Seleção

- Uma cota **por grupo**  
- Linha destacada; painel de resumo com totais em tempo real  
- Botões: Gerar simulação, Gerar proposta, Falar com especialista  

### 10.3 Fluxo simulação/proposta

1. Modal: nome + WhatsApp  
2. Criar lead (origem página grupos)  
3. Salvar `simulacoes_grupos` + itens  
4. Registrar eventos (`simulacao_grupo_criada`, `lead_criado`, etc.)  
5. Proposta: redirecionar admin ou rascunho (Fase 1: criar registro básico vinculado)

**Regra:** não exibir link no menu público por padrão (config Menus — fase futura).

---

## 11. Cálculos de grupos (`lib/grupos/calculos.ts`)

Funções **puras**, comentadas, parâmetros explícitos (percentuais do grupo, quantidade de cotas, flags):

| Função | Responsabilidade |
|--------|------------------|
| `calcularSomaCotas` | Soma créditos selecionados |
| `calcularSaldoDevedor` | Agregação saldo |
| `calcularLanceEmbutido` | % lance embutido × base |
| `calcularRecursoProprio` | % recurso próprio sugerido |
| `calcularLanceTotal` | Lance embutido + recurso + extras |
| `calcularPrimeiraParcela` | Primeira parcela total |
| `calcularSeguro` | Seguro total conforme flags |
| `calcularParcelasRestantes` | Projeção parcelas |
| `calcularCreditoLiquido` | Crédito após contemplação/lances |

**Regra:** componentes React apenas consomem essas funções; fórmulas ajustáveis até validação com Excel.

Exemplo de assinatura:

```ts
export type ParametrosGrupo = {
  taxaAdministrativaPercentual: number;
  fundoReservaPercentual: number;
  seguroHabilitado: boolean;
  seguroPercentual: number;
  permiteLanceEmbutido: boolean;
  percentualLanceEmbutido: number;
  percentualRecursoProprioSugerido: number;
  // …
};

export function calcularLanceEmbutido(
  credito: number,
  params: ParametrosGrupo,
  overrides?: Partial<ParametrosGrupo>,
): number { /* … */ }
```

---

## 12. Eventos (`eventos_site`)

| tipo_evento | Quando |
|-------------|--------|
| `lead_criado` | Manual ou /grupos |
| `proposta_gerada` | Nova proposta |
| `simulacao_grupo_criada` | Simulação salva |
| `grupo_visualizado` | Opcional analytics |
| `cota_selecionada` | Toggle seleção |
| `clique_whatsapp_pos_lead` | Botão pós-lead |
| `clique_gerar_proposta` | CTA proposta |

---

## 13. UI/UX

| Área | Diretriz |
|------|----------|
| Admin | Limpo, tabelas densidade média, filtros no topo, ações por linha |
| `/grupos` | Premium, não “planilha”; sticky summary; mobile: cards ou scroll horizontal |
| Acessibilidade | Contraste no tema escuro; foco visível em seleção |

---

## 14. Regras de negócio (checklist)

- [ ] `/grupos` pública, sem item de menu padrão  
- [ ] Admin controla grupos e cotas  
- [ ] Várias cotas por grupo; seleção pública: **1 cota por grupo**  
- [ ] Totais atualizam em tempo real (client state + `calculos.ts`)  
- [ ] Simulação persiste grupos/cotas escolhidos  
- [ ] Proposta preparada para reutilizar seleção  
- [ ] Fórmulas centralizadas  
- [ ] Não quebrar site futuro — rotas `(public)` isoladas  

---

## 15. Entregáveis Fase 1

| # | Entregável | Critério de aceite |
|---|------------|-------------------|
| 1 | Autenticação | Login admin; sessão estável |
| 2 | Perfis | master, srd, imobiliaria no schema e guards |
| 3 | Layout admin | Sidebar + rotas filhas |
| 4 | Configurações | Abas mínimas persistidas |
| 5 | Dashboard | 8 cards + 3 tabelas |
| 6–10 | Leads | CRUD, manual, retorno, fechamento, histórico |
| 11 | Propostas | CRUD básico + status + lead |
| 12–13 | Grupos | CRUD + cotas + paste em lote |
| 14–17 | `/grupos` | Lista, seleção, totais, simulação salva |
| 18 | PDF | Estrutura de campos; geração na Fase 2+ |

---

## 16. Plano de implementação incremental

1. **Bootstrap** — Next.js, projeto Supabase, migrations SQL, seed Master (Auth + `usuarios`)  
2. **Auth + usuários** — login, CRUD usuários (Master)  
3. **Config** — abas Site, Contato, Propostas, Leads, WhatsApp  
4. **Leads + histórico** — filtros, manual, fechamento  
5. **Propostas** — lista, form, vínculo lead  
6. **Grupos admin** — CRUD, cotas, duplicar, bulk  
7. **`calculos.ts`** — unit tests mínimos com fixtures Excel  
8. **`/grupos`** — UI pública + API simulação + eventos  
9. **Dashboard** — agregações  
10. **QA** — perfis SRD vs Master; smoke mobile `/grupos`  

---

## 17. Variáveis de ambiente (inicial)

Ver `.env.example` na raiz. Mínimo:

```env
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Deploy Vercel: mesmas variáveis no painel do projeto; `NEXT_PUBLIC_SITE_URL` = URL de produção.

---

## 18. Referência rápida — enums

**Lead — tipo_interesse:** consorcio | financiamento | carta_contemplada | oportunidade_imobiliaria | credito_garantia | outro  

**Proposta — status:** gerada | enviada | em_negociacao | aprovada | perdida | cancelada | arquivada  

**Grupo — modalidade (filtro público):** imovel | auto | moto (+ todas)  

---

## 19. Próximas fases (fora do escopo Fase 1)

- Simuladores completos (consórcio/financiamento)  
- PDF premium de proposta  
- Cartas contempladas, imobiliárias, imóveis, parceiros  
- IA (`analise_ia` em leads)  
- Identidade visual avançada e menus dinâmicos  

---

# Complemento final do documento mestre

# Módulo público de grupos e cotas

## 58. Módulo de Grupos

Criar uma página pública dedicada:

**/grupos**

Essa página não precisa aparecer como botão no menu principal do site.
Ela será pública, mas acessada por link direto, para uso comercial, apresentação, corretores, parceiros ou clientes específicos.

A página deverá ter visual premium, moderno e mais agradável que o Excel atual, mas mantendo a lógica comercial da planilha.

A referência visual pode seguir a ideia da imagem enviada:

* Fundo escuro premium
* Título grande: **Nossos Grupos**
* Filtros por tipo
* Busca
* Tabela organizada
* Botão de ação
* Status visual
* Barras de disponibilidade/vagas
* Destaques em amarelo/dourado

---

## 58.1 Objetivo da página /grupos

A página de grupos deverá permitir visualizar grupos disponíveis e selecionar cotas para montar uma simulação baseada em grupos reais.

Ela deve funcionar como uma versão moderna da planilha Excel, mas com experiência melhor.

Objetivos:

* Exibir todos os grupos cadastrados.
* Permitir filtrar por modalidade.
* Permitir buscar por grupo ou valor de crédito.
* Permitir selecionar uma ou mais cotas.
* Permitir selecionar uma cota por grupo, conforme regra inicial.
* Totalizar automaticamente os valores selecionados.
* Calcular crédito, saldo devedor, lance embutido, recurso próprio, lance total, parcelas e crédito líquido.
* Permitir gerar lead e proposta com base na seleção.
* Usar visual mais bonito e comercial do que o Excel.

---

## 58.2 Acesso

A página será pública pelo link:

**/grupos**

Mas não precisa aparecer no menu principal do site.

No admin, deve existir uma configuração:

**Exibir botão de grupos no site? Sim/Não**

Por padrão, pode ficar **Não**.

---

## 58.3 Modalidades dos grupos

A página deverá permitir filtro por modalidade:

* Todos
* Imóvel
* Auto
* Moto

Estrutura preparada para futuro:

* Caminhonete
* Caminhão
* Carreta
* Serviços
* Outros

---

## 58.4 Visual público da página de grupos

A tela pública deverá ter:

### Cabeçalho

Título:

**Nossos Grupos**

Subtítulo opcional:

**Escolha uma ou mais cotas e monte sua simulação personalizada.**

### Filtros

Botões:

* Todos
* Imóvel
* Auto
* Moto

### Busca

Campo:

**Buscar por crédito ou grupo...**

### Tabela principal

Colunas sugeridas na versão pública:

* Grupo
* Tipo
* Crédito
* Parcela
* Prazo
* Vagas / disponibilidade
* Status
* Ação

Ação:

* Participar
* Selecionar
* Simular

---

## 58.5 Tabela avançada estilo Excel

Além da tabela pública simplificada, o sistema deverá ter uma visão avançada para simulação.

Essa visão poderá ser usada por:

* Master
* SRD
* Consultor
* Usuário autorizado
* Link público avançado, se o Master permitir

A tabela avançada deverá conter as colunas do Excel atual:

* Grupo
* Cotas
* Valor crédito
* Soma das cotas
* Saldo devedor
* Lance embutido
* Recurso próprio
* Lance total
* À realizar
* 1ª parcela
* Seguro
* Realizadas
* Prazo restante
* Seguro pós-contemplação
* Parcelas restantes
* CET %

A tabela deve parecer uma planilha inteligente, mas com UI moderna.

---

## 58.6 Cadastro dos grupos no admin

Criar uma área no admin chamada:

**Grupos**

O cadastro deve ser rápido e prático.

O usuário deverá cadastrar o grupo uma vez e informar várias cotas/créditos daquele grupo de uma vez.

Exemplo:

Grupo: 1443  
Tipo: Imóvel  
Taxa administrativa: 25%  
Fundo de reserva: 2%  
Seguro: Sim/Não  
Parcela reduzida: Sim/Não  
Lance embutido: 40%

Cotas disponíveis:

* R$ 55.214,00
* R$ 65.258,58
* R$ 75.000,00
* R$ 212.000,00

Ou seja: o cadastro não deve obrigar o usuário a criar um grupo inteiro repetido para cada crédito, se todos pertencem ao mesmo grupo.

A estrutura correta é:

* Grupo
* Configurações gerais do grupo
* Lista de cotas/créditos vinculados ao grupo

---

## 58.7 Configuração do grupo

Campos do grupo:

* Código do grupo
* Modalidade: Imóvel, Auto, Moto
* Administradora
* Taxa administrativa percentual
* Fundo de reserva percentual
* Seguro habilitado: Sim/Não
* Seguro percentual ou valor, se houver
* Tem parcela reduzida: Sim/Não
* Percentual da parcela reduzida
* Permite lance embutido: Sim/Não
* Percentual do lance embutido
* Prazo total
* Parcelas realizadas
* Prazo restante
* Seguro pós-contemplação
* CET percentual
* Status do grupo
* Observações internas
* Ativo/inativo

---

## 58.8 Cadastro das cotas dentro do grupo

Dentro do cadastro do grupo, criar uma seção:

**Cotas / Créditos disponíveis**

Cada cota deverá ter:

* Valor do crédito
* Valor da parcela
* Parcela integral
* Parcela reduzida
* Parcela com seguro
* Parcela sem seguro
* Saldo devedor
* Vagas disponíveis ou percentual de disponibilidade
* Status: disponível, últimas, esgotado, inativo
* Ativo/inativo

O admin poderá adicionar várias cotas de uma vez.

Formas de entrada:

1. Campo manual linha por linha.
2. Colagem simples de valores em bloco.

Exemplo de colagem:

```
55214,00
65258,58
75000,00
212000,00
```

O sistema interpreta cada linha como uma cota/crédito daquele grupo.

---

## 58.9 Seleção das cotas

Na página pública ou avançada, o usuário poderá selecionar cotas.

Regra inicial aprovada:

**Pode selecionar uma cota em cada grupo.**

Quando selecionar uma cota, o sistema soma automaticamente:

* Valor do crédito
* Soma das cotas
* Saldo devedor
* Lance embutido
* Recurso próprio
* Lance total
* Primeira parcela
* Seguro
* Parcelas restantes
* Crédito líquido após contemplação

Se futuramente quiser permitir múltiplas cotas do mesmo grupo, a estrutura poderá evoluir.

---

## 58.10 Totalizadores

Abaixo da tabela, exibir um resumo premium da simulação.

Campos:

* Total de grupos selecionados
* Total de cotas selecionadas
* Total de crédito
* Soma das cotas
* Saldo devedor total
* Lance embutido total
* Recurso próprio total
* Lance total
* Total da primeira parcela
* Total de seguro
* Parcelas restantes
* Crédito líquido após contemplação

O destaque principal será:

**Crédito líquido após contemplação**

Esse número deve aparecer grande, forte e destacado, como no Excel, mas com visual mais moderno.

---

## 58.11 Configuração de lance embutido

O lance embutido deverá ser configurável por grupo.

Campos:

* Permite lance embutido: Sim/Não
* Percentual do lance embutido
* Fórmula base do lance embutido

Exemplo:

* Lance embutido = saldo devedor x percentual configurado

Mas a fórmula deve ser validada com a lógica da planilha antes de fechar.

---

## 58.12 Recurso próprio

O recurso próprio poderá ser configurado e também ajustado na simulação.

Campos:

* Percentual sugerido de recurso próprio
* Valor manual de recurso próprio, se o usuário autorizado quiser editar
* Permitir edição manual: Sim/Não

Regra:

**Lance total = Lance embutido + Recurso próprio**

---

## 58.13 Seguro

No cadastro do grupo, incluir:

**Seguro: Sim/Não**

Se marcado como Sim, permitir configurar:

* Percentual do seguro
* Valor do seguro
* Seguro pós-contemplação
* Se o seguro entra na parcela exibida
* Se a tabela mostra parcela com seguro e sem seguro

Se marcado como Não:

* Seguro aparece zerado ou oculto, conforme configuração visual.

---

## 58.14 Parcela reduzida

No cadastro do grupo, incluir:

* Tem parcela reduzida: Sim/Não
* Percentual da parcela reduzida
* Prazo ou condição da parcela reduzida
* Parcela integral
* Parcela reduzida
* Parcela pós-contemplação, se aplicável

A tabela deverá deixar claro quando uma parcela é reduzida.

---

## 58.15 Status do grupo/cota

Cada cota ou grupo poderá ter status:

* Disponível
* Últimas
* Esgotado
* Inativo

Visual:

* Disponível: destaque positivo
* Últimas: destaque de urgência
* Esgotado: desabilitado ou sem ação
* Inativo: não aparece publicamente

---

## 58.16 Botão de ação

Na tabela pública, botão:

**Participar**

ou

**Selecionar**

Ao clicar:

* Seleciona a cota/grupo
* Atualiza totalizadores
* Permite continuar selecionando outras cotas de outros grupos

Depois da seleção, exibir botões:

* Gerar simulação
* Gerar proposta
* Falar com especialista

Para gerar proposta ou capturar atendimento:

* Pedir nome
* WhatsApp
* Gravar lead
* Gravar simulação
* Gerar proposta, quando solicitado

---

## 58.17 Relação com propostas

Quando uma proposta for gerada a partir da seleção de grupos, a proposta deve salvar:

* Grupos selecionados
* Cotas selecionadas
* Valores de crédito
* Parcelas
* Saldo devedor
* Lance embutido
* Recurso próprio
* Lance total
* Seguro
* Parcelas restantes
* Crédito líquido após contemplação
* Data da simulação

Essas informações devem aparecer na proposta premium em uma seção:

**Grupos e cotas selecionados**

---

## 58.18 Banco de dados atualizado

### grupos_consorcio

* id
* codigo_grupo
* modalidade
* administradora
* taxa_administrativa_percentual
* fundo_reserva_percentual
* seguro_habilitado
* seguro_percentual
* seguro_valor
* tem_parcela_reduzida
* percentual_parcela_reduzida
* permite_lance_embutido
* percentual_lance_embutido
* percentual_recurso_proprio_sugerido
* prazo_total
* parcelas_realizadas
* prazo_restante
* seguro_pos_contemplacao
* cet_percentual
* status
* ativo
* observacoes
* created_at
* updated_at

### grupos_cotas

* id
* grupo_id
* valor_credito
* valor_parcela
* parcela_integral
* parcela_reduzida
* parcela_com_seguro
* parcela_sem_seguro
* saldo_devedor
* vagas_percentual
* vagas_texto
* status
* ativo
* ordem
* created_at
* updated_at

### simulacoes_grupos

* id
* lead_id
* proposta_id
* usuario_id
* origem
* modalidade
* dados_totais
* credito_liquido
* total_grupos
* total_cotas
* total_credito
* total_saldo_devedor
* total_lance_embutido
* total_recurso_proprio
* total_lance
* total_primeira_parcela
* total_seguro
* total_parcelas_restantes
* created_at

### simulacoes_grupos_itens

* id
* simulacao_grupo_id
* grupo_id
* grupo_cota_id
* codigo_grupo
* modalidade
* valor_credito
* quantidade_cotas
* soma_cotas
* saldo_devedor
* lance_embutido
* recurso_proprio
* lance_total
* primeira_parcela
* seguro
* parcelas_realizadas
* prazo_restante
* seguro_pos_contemplacao
* parcelas_restantes
* cet_percentual
* created_at

---

## 58.19 Admin de grupos

A tela administrativa de grupos deverá ter:

* Lista de grupos
* Botão novo grupo
* Filtro por modalidade
* Filtro por status
* Busca por código do grupo
* Quantidade de cotas cadastradas
* Ativo/inativo rápido
* Editar
* Duplicar
* Excluir apenas Master

Dentro do grupo:

* Dados gerais
* Configurações financeiras
* Cotas/créditos disponíveis
* Status
* Observações

---

## 58.20 Importante sobre a fórmula

O sistema deverá funcionar como o Excel, mas antes de travar as fórmulas no código, será necessário validar:

* Cálculo do saldo devedor
* Cálculo do lance embutido
* Cálculo do recurso próprio
* Cálculo do lance total
* Cálculo da primeira parcela
* Cálculo do seguro
* Cálculo de parcelas restantes
* Cálculo do crédito líquido após contemplação

As fórmulas devem ser transformadas em funções claras no código e comentadas, para manutenção futura.

---

## 58.21 Regra final

O módulo de grupos é parte essencial do projeto.

Ele deve ser tratado como:

**Simulador avançado de grupos e cotas**

E não apenas como uma tabela simples.

Ele precisa unir:

* Dados do Excel
* Visual premium
* Facilidade de cadastro
* Seleção de cotas
* Totalização automática
* Geração de lead
* Geração de proposta

---

*Documento gerado a partir do briefing Fase 1. Atualizar quando o schema SQL em `supabase/migrations/` ou a stack mudar.*
