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
### 2.3. Sorteio pela Loteria Federal no ERP (Igual no Site)
- **Cálculo da Pedra por Grupo:**
  - O formulário agora oferece o modo **🎯 Pela Loteria Federal (Site)** além do modo manual.
  - Ao informar o **1º Prêmio da Loteria Federal** (5 dígitos, ex: `95866` ou `80246`), o sistema calcula a pedra sorteada de cada grupo aplicando a fórmula canônica:
    $$\text{Pedra} = \text{1º Prêmio} \pmod{\text{Quantidade de Cotas do Grupo}}$$
    - Grupos de Imóvel (999 cotas): `80246 mod 999 = 326`
    - Grupos de Automóvel (2000 cotas): `80246 mod 2000 = 246`
  - Ao selecionar "Todos os grupos", cada grupo é registrado e apurado com a **sua respectiva pedra calculada**.
- **Busca Oficial na Caixa:**
  - Botão **"Buscar Caixa"** que consulta a API oficial da Caixa Econômica Federal em tempo real para a data da assembleia, preenchendo automaticamente o 1º prêmio e informando o número do concurso.
- **Preview em Tempo Real:**
  - Exibe badges dinâmicos de cada grupo autorizado com a sua pedra resultante e quantidade de cotas antes mesmo de gravar.

### 2.4. Critério Oficial de Aproximação: "Sempre o Número ou Maior"
- Em consórcios, a apuração segue estritamente a fila de contemplação em ordem crescente a partir da pedra sorteada:
  1. **Exata (`distancia = 0`):** Cota igual à pedra sorteada (Destaque `0 (Sorteada!)` e badge `🎯 Sorteada!`).
  2. **Superior (`cota > pedra`):** Cotas com numeração imediatamente superior ordenadas em ordem crescente (`+1`, `+2`, `+3`...). A cota `468` vem **sempre antes** da cota `465` quando a pedra for `466`.
  3. **Após Giro (`cota < pedra`):** Caso a fila atinja o término do grupo (`999` ou `2000` cotas) sem preencher a vaga, a contemplação avança do início (`001, 002...` até `pedra - 1`), identificada com o rótulo `+(Após giro)`.

---

## 3. Cobertura de Testes Automatizados

- `src/lib/erp/assembleias.test.ts`:
  - `valida e calcula pedra de cada grupo pela Loteria Federal (igual no site)`
  - `calcula distância seguindo a regra oficial do consórcio: sempre o número ou maior`
  - `ordena cotas priorizando número sorteado e cotas superiores antes do giro`
  - `ignora cota sem número inteiro real`
  - `agrupa cotas por grupo e prioriza grupos com cotas sorteadas na pedra (distância 0)`
- `src/lib/erp/assembleias-contract.test.ts`:
  - `é tenant-aware e valida grupo/cota no banco`
  - `preserva histórico e não altera contemplação`
  - `usa cotas definitivas e mantém sorteios do Portal fora do ERP`
  - `permite registrar assembleia para todos os grupos e lista clientes mais próximos por grupo`

Resultados: **9 testes aprovados com 100% de sucesso**.  
Typecheck TypeScript (`tsc --noEmit`): **0 erros**.
