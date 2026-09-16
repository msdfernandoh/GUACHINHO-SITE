# Relatório de Fase 235 — Registro de Assembleias Multi-Grupos e Listagem de Cotas Próximas por Grupo

**Data de Conclusão:** 16 de Setembro de 2026  
**Módulo:** ERP Operacional / Assembleias e Pedras  
**Escopo:** `gauchinho-app/src/app/erp/assembleias` e `gauchinho-app/src/components/erp`  
**Tenant Homologado:** Racon Sinop / Gauchinho Consórcios  

---

## 1. Contexto e Demanda

No consórcio, as assembleias gerais ordinárias de uma mesma administradora ocorrem em uma data predefinida e a extração da Loteria Federal define a mesma **pedra sorteada** (ou sequência numérica) para múltiplos grupos vigentes daquela modalidade.

Anteriormente:
1. O operador precisava cadastrar a assembleia grupo por grupo de forma manual e repetitiva.
2. Ao acessar a apuração das cotas mais próximas, o sistema exibia apenas cotas do grupo individualmente selecionado. Caso aquele grupo específico não tivesse cotas com numeração definitiva no momento, exibia a mensagem *"Nenhuma cota definitiva numerada neste grupo"*, forçando o operador a alternar grupo a grupo para descobrir onde estavam os clientes contemplados ou limítrofes.

---

## 2. Implementações Realizadas

### 2.1. Inclusão de "Todos os grupos autorizados" no Registro
- **Formulário de Cadastro:**
  - Adicionada a opção destacada `★ Todos os grupos autorizados ({total})` no select de grupo em `/erp/assembleias`.
- **Ação do Servidor (`createAssembleiaAction`):**
  - Quando selecionado `TODOS`, busca todos os grupos autorizados e ativos para o tenant via `listGruposAutorizadosForEmpresa(empresaId)`.
  - Executa inserção em lote (`erp_assembleias_grupo`) com todos os grupos autorizados com a mesma data, número de assembleia, pedra sorteada e observação operacional.
  - Mantém estrita conformidade com os triggers do Postgres:
    - `validate_erp_assembleia_tenant_integrity` (validação de concessão multi-tenant).
    - `prevent_erp_assembleia_mutation` (tabela append-only para auditoria e integridade histórica).

### 2.2. Apuração Consolidada e Listagem de Clientes por Grupo
- **Agrupamento de Evento Operacional:**
  - O histórico lateral esquerdo agora consolida eventos de assembleia por data e pedra sorteada, exibindo cards informativos com a quantidade de grupos participantes (ex: `Todos os grupos (12) · Pedra 466`).
- **Listagem de Clientes Mais Próximos por Grupo (`agruparCotasPorGrupo`):**
  - Mapeia todas as cotas definitivas numeradas pertencentes a qualquer grupo do evento de assembleia.
  - Ordena cada grupo pela proximidade das cotas em relação à pedra sorteada.
  - Prioriza na visualização os grupos que possuem **cotas sorteadas na pedra** (`diferença = 0` / Contemplação pela pedra) e aqueles com menor distância.
  - Apresenta tabela com as colunas:
    - **COTA:** Número da cota com destaque `Sorteada!` em caso de empate com a pedra.
    - **CLIENTE:** Nome do cliente associado à cota definitiva e à venda.
    - **DIFERENÇA DA PEDRA:** Distância absoluta calculada em relação à pedra sorteada.
    - **STATUS REAL:** Status no consórcio (`ativa`, `contemplada`, etc.).
    - **ATENÇÃO:** Botão funcional para marcar/desmarcar atenção operacional na respectiva assembleia do grupo (`erp_assembleia_atencoes`).
- **Filtros Rápidos:**
  - Permite visualizar `Todos os grupos` simultaneamente ou filtrar por um grupo específico através de pills dinâmicas com contadores de cotas e indicativo de pedra sorteada (`🎯`).

---

## 3. Cobertura de Testes Automatizados

- `src/lib/erp/assembleias.test.ts`:
  - `ordena por distância e desempata pelo número da cota`
  - `ignora cota sem número inteiro real`
  - `agrupa cotas por grupo e prioriza grupos com cotas sorteadas na pedra (distância 0)`
- `src/lib/erp/assembleias-contract.test.ts`:
  - `é tenant-aware e valida grupo/cota no banco`
  - `preserva histórico e não altera contemplação`
  - `usa cotas definitivas e mantém sorteios do Portal fora do ERP`
  - `permite registrar assembleia para todos os grupos e lista clientes mais próximos por grupo`

Resultados: **7 testes aprovados com 100% de sucesso**.
Typecheck TypeScript (`tsc --noEmit`): **0 erros**.
