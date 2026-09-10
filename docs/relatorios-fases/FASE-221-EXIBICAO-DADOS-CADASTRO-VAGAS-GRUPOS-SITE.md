# Relatório de Fase 221 — Exibição Completa dos Dados de Cadastro, Vagas Disponíveis e Observações de Grupos no Site

## 1. Visão Geral e Contexto
- **Fase:** 221
- **Data:** 10/09/2026
- **Status:** Concluído com Sucesso e Validado
- **Objetivo:**
  1. **Diagnóstico da Ausência de Dados na Aba "Ajustar" dos Grupos no Site:**  
     Investigar e corrigir o motivo pelo qual as informações cadastrais dos grupos (como número de participantes, 1ª assembleia e data de término) apareciam com traços ("—") e orientações vazias ao clicar em "Ajustar" na listagem de grupos do site público, apesar de estarem devidamente preenchidas no ERP e no SaaS Platform.
  2. **Inclusão do Número de Vagas Disponíveis:**  
     Exibir com clareza e destaque as vagas disponíveis cadastradas no grupo (ex.: "650 vagas") tanto no painel expandido de "Ajustar" quanto na listagem principal de grupos (tabela desktop e cards mobile).
  3. **Apresentação Fiel ao Cadastro Completo do Grupo:**  
     Garantir que o painel de detalhes do grupo exiba de forma organizada e elegante todos os dados operacionais e financeiros oficiais do cadastro:
     - Vagas disponíveis (com destaque visual e aviso de esgotado ou aguardando vagas);
     - Participantes / Capacidade total do grupo;
     - 1ª assembleia (início oficial do grupo);
     - Término estimado do grupo e prazo total;
     - Assembleias realizadas e prazo restante;
     - Taxa administrativa percentual;
     - Fundo de reserva percentual;
     - Reajuste anual (fixo ou variável por índice);
     - Seguro mensal;
     - Administradora e modalidade/tipo de bem;
     - Observações operacionais completas do SaaS (regras de lances, sorteio etc.).

---

## 2. Diagnóstico Técnico

1. **Causa Raiz 1 — `calcularCicloGrupoDatas` (`src/lib/grupos/prazos.ts`):**
   - A função `calcularCicloGrupoDatas` buscava a data da primeira assembleia e a data de término **exclusivamente** a partir do campo `data_base_parcelas` menos as parcelas realizadas. Como grupos novos ou em formação possuem `data_base_parcelas = null` e utilizam a coluna oficial `data_primeira_assembleia` (ex.: `"2026-11-12"` no Grupo 1553), a função abortava precocemente retornando `dataPrimeiraAssembleia: null` e `dataTerminoGrupo: null`.
   - Para participantes, a função consultava apenas `quantidade_cotas_sorteio` (campo legado da tabela de sorteios), ignorando completamente a coluna oficial `capacidade_total` (ex.: 700 participantes no Grupo 1553), resultando em `participantes: null` e exibindo `"Cadastre no admin (sorteio / cotas)"`.
   - O campo `vagas_disponiveis` (ex.: 650 vagas) nem sequer era retornado pelo objeto `GrupoCicloDatas`.

2. **Causa Raiz 2 — Componente `GrupoCicloDetalhes` (`src/components/public/grupos/grupo-ciclo-detalhes.tsx`):**
   - O componente apresentava apenas 3 cartões simplificados (Participantes, 1ª Assembleia e Término), não exibindo vagas disponíveis, taxa administrativa, fundo de reserva, reajuste anual, seguro, assembleias/prazo restante nem as observações operacionais do grupo.

3. **Causa Raiz 3 — Identificação de Vagas na Tabela Principal e Mobile:**
   - Na linha principal da tabela (`GrupoRow`) e nos cartões mobile (`GrupoMobileCard`), embora o status "Em Formação" e "Aguardando novas vagas" fossem mostrados, a quantidade numérica de vagas disponíveis não era apresentada para o cliente/consultor.

---

## 3. Modificações Implementadas

### 3.1. Correção do Cálculo do Ciclo de Datas e Prazos (`src/lib/grupos/prazos.ts`)
- `calcularCicloGrupoDatas`:
  - **1ª Assembleia:** Agora avalia prioritariamente `grupo.data_primeira_assembleia`. Se não informada, recorre ao cálculo via `data_base_parcelas` e `parcelas_realizadas_base`.
  - **Término do Grupo:** Calculado a partir da primeira assembleia resolvida somando `prazoTotalMeses` (via `adicionarMesesCalendario`).
  - **Participantes / Capacidade:** Lê prioritariamente `grupo.capacidade_total`. Caso nulo, recorre a `grupo.quantidade_cotas_sorteio`.
  - **Vagas Disponíveis:** Lê e normaliza `grupo.vagas_disponiveis` (`Math.max(0, Number(grupo.vagas_disponiveis))`).
  - **Prazos:** Consolida `parcelasRealizadas` e `prazoRestante` via `calcularPrazoGrupoFromRow`.

### 3.2. Painel Informativo Rico em `GrupoCicloDetalhes` (`src/components/public/grupos/grupo-ciclo-detalhes.tsx`)
- Reformulado com grid responsivo de 10 cartões informativos em dark theme:
  1. **Vagas Disponíveis:** Destaque esmeralda com quantidade de vagas ou badge "0 (Esgotado)".
  2. **Participantes / Capacidade:** Capacidade total cadastrada.
  3. **1ª Assembleia (Início):** Data formatada (DD/MM/AAAA) da 1ª assembleia.
  4. **Término do Grupo:** Data estimada de encerramento do grupo e prazo total em meses.
  5. **Assembleias / Prazo:** Parcelas realizadas / prazo total e meses restantes.
  6. **Taxa Administrativa:** Percentual cadastrado no grupo.
  7. **Fundo de Reserva:** Percentual cadastrado no grupo.
  8. **Reajuste Anual:** Percentual fixo ou índice variável cadastrado.
  9. **Seguro Mensal:** Percentual do seguro ou indicador de não incidência.
  10. **Administradora / Tipo:** Ex.: "Racon · Imóvel".
- **Observações Operacionais do SaaS:** Seção em bloco destacado exibindo as observações cadastradas no grupo (ordem de sorteio, limites de lance fixo, fidelidade etc.).

### 3.3. Badges de Vagas Disponíveis na Listagem Pública
- **`GrupoRow` (`src/components/public/grupos/grupo-row.tsx`):**
  - Exibição de badge compacta de vagas disponíveis (`X vagas`) logo abaixo do código do grupo na primeira coluna.
- **`GrupoMobileCard` (`src/components/public/grupos/grupo-mobile-card.tsx`):**
  - Inclusão da badge de vagas disponíveis no cabeçalho do card de cada grupo na visualização mobile.

---

## 4. Testes e Validação

1. **Testes Unitários de Prazos e Ciclo:**
   - Adicionado caso de teste reproduzindo fielmente os dados do Grupo 1553 (capacidade 700, vagas 650, 1ª assembleia 12/11/2026, prazo 160 meses).
   - Validação de término estimado para `2040-03-12` (12/03/2040).
   - Execução:
     ```pwsh
     npx vitest run src/lib/grupos/prazos.test.ts
     ```
     - **Resultado:** 13 testes aprovados (100%).
2. **Suíte Completa de Grupos:**
   ```pwsh
   npx vitest run src/lib/grupos
   ```
   - **Resultado:** 27 arquivos de teste e 173 testes aprovados com sucesso.
3. **Build de Produção do Next.js:**
   - Compilação estática e rotas geradas com sucesso sem erros de tipagem.

---

## 5. Conclusão
O problema foi solucionado na raiz do cálculo e a interface do site foi enriquecida para refletir com exatidão todas as informações operacionais cadastradas no ERP e na Platform, com foco especial na visualização instantânea do número de vagas disponíveis.
