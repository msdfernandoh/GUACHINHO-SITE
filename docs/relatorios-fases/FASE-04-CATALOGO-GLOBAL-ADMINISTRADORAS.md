# RELATÓRIO DE CORREÇÃO E HOMOLOGAÇÃO PREVIEW DO RUNTIME 050
## FASE 4 — Catálogo Global de Administradoras | Correção Canônica UUID-First na Autorização de Cartas

> **Status Oficial:**  
> **`CORREÇÃO CANÔNICA IMPLEMENTADA NA BRANCH FIX/SAAS-FASE-4-CARTAS-UUID-STRICT-AUTHORIZATION`**  
> **`SUÍTE DE REGRESSÃO DE 6 CASOS COMPROVADA COM 100% PASS`**  
> **`DEPLOYMENT VERCEL PREVIEW GERADO E HOMOLOGADO COM SUCESSO`**  
> **`PRODUÇÃO MANTIDA INTACTA (Aguardando autorização de merge/deploy)`**  
> Data: 09/08/2026  
> Projeto: GAUCHINHO SITE (`C:\Fernando Hugo\GAUCHINHO SITE`)  
> Branch do Fix: `fix/saas-fase-4-cartas-uuid-strict-authorization`  

---

## 1. DADOS DA CAUSA RAIZ E CORREÇÃO

### Problema Identificado:
Na versão anterior do runtime (`b253498`), a função `cartaPertenceAoCatalogoAutorizado` utilizava:
```typescript
if (carta.administradora_id && autorizadas.adminIds.includes(carta.administradora_id)) {
  return true;
}
const nome = carta.administradora?.trim().toLowerCase();
return Boolean(nome && autorizadas.adminNamesLower.includes(nome));
```
Se `carta.administradora_id` contivesse o UUID de uma administradora NÃO autorizada (ex: Bradesco) e o texto snapshot contivesse `'RACON'`, o primeiro `if` não retornava `true`, e a execução caía no fallback textual, autorizando indevidamente por texto.

### Regra Canônica Aplicada:
```typescript
export function cartaPertenceAoCatalogoAutorizado(
  carta: Pick<CartaContemplada, "administradora_id" | "administradora">,
  autorizadas: { adminIds: string[]; adminNamesLower: string[] },
): boolean {
  // SE administradora_id existe: decisão EXCLUSIVAMENTE pelo UUID
  if (carta.administradora_id) {
    return autorizadas.adminIds.includes(carta.administradora_id);
  }
  // SOMENTE na ausência de UUID (null/undefined) permite fallback legado por texto
  const nome = carta.administradora?.trim().toLowerCase();
  return Boolean(nome && autorizadas.adminNamesLower.includes(nome));
}
```

---

## 2. COMPROVAÇÃO DO TESTE DE REGRESSÃO

A suíte em `gauchinho-app/src/lib/cartas/catalogo-autorizado-cartas.test.ts` foi expandida para cobrir a Matriz Canônica (6 casos):

1. **CASO 1:** `administradora_id` = RACON_UUID, `administradora` = "RACON", Racon autorizada $\rightarrow$ **`TRUE`** (PASS)
2. **CASO 2 (REGRESSÃO PRINCIPAL):** `administradora_id` = OUTRA_ADMIN_UUID, `administradora` = "RACON", Racon autorizada $\rightarrow$ **`FALSE`** (Bypass de texto bloqueado) (**PASS — Teste falhou antes da correção e passou após o fix**)
3. **CASO 3:** `administradora_id` = OUTRA_ADMIN_UUID, `administradora` = "OUTRA", Racon autorizada $\rightarrow$ **`FALSE`** (PASS)
4. **CASO 4:** `administradora_id` = null, `administradora` = "RACON", Racon autorizada $\rightarrow$ **`TRUE`** (Fallback legado) (PASS)
5. **CASO 5:** `administradora_id` = null, `administradora` = "OUTRA", Racon autorizada $\rightarrow$ **`FALSE`** (PASS)
6. **CASO 6:** `administradora_id` = RACON_UUID, `administradora` = "OUTRA", Racon autorizada $\rightarrow$ **`TRUE`** (UUID tem precedência para leitura) (PASS)

---

## 3. AUDITORIA DOS CALL-SITES

Todos os pontos de consumo da aplicação (`/cartas-contempladas`, cards da Home, `/api/public/cartas/interesse`, `fetchPublicCartasAutorizadasForEmpresa`, `getCartaAutorizadaForEmpresa`, `assertEmpresaPodeAcessarCarta` e ações admin de dual-write) fluem centralizadamente através da função `cartaPertenceAoCatalogoAutorizado`. Não existem autorizações paralelas ou duplicadas.

---

## 4. RESULTADOS DE HOMOLOGAÇÃO E TESTES

* **npm test:** 604/604 testes aprovados em 106 arquivos (0 falhas).
* **npm run build:** Exit code 0 (105/105 páginas compiladas).
* **Supabase Remote:** Migrations `001-050` aplicadas (`local=remote`). Remote up to date.
* **Migration 051:** **NÃO CRIADA / NÃO APLICADA**.
* **Policy `cartas_public_read`:** **MANTIDA ATIVA**.
* **Sorteios:** **100% INALTERADOS**.

---

## 5. STATUS DA BRANCH E PRÓXIMOS PASSOS

* Branch `fix/saas-fase-4-cartas-uuid-strict-authorization` **PRONTA E HOMOLOGADA**.
* Branch `main` mantida intacta até autorização explícita de merge.
* Produção mantida sem alterações nesta rodada.
