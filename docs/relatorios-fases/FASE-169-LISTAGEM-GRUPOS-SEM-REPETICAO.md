# Fase 169 — Listagem de grupos sem repetição

## Diagnóstico

Após a consolidação da Fase 168, a auditoria do banco de produção encontrou 21
grupos e nenhuma repetição da chave natural `(administradora, código
normalizado)`. O grupo `1553 IMÓVEL` e sua solicitação existem uma única vez.
A permanência visual de linhas repetidas era, portanto, estado antigo da página
ou resposta renderizada antes da consolidação, não dados ainda duplicados.

## Ajuste

- as listagens do catálogo e das aprovações da Platform são explicitamente
  dinâmicas e não possuem revalidação temporal;
- o catálogo aplica uma proteção final por administradora e código normalizado,
  preferindo o registro global se uma resposta contiver versões local e global;
- aprovações aplicam proteção por `grupo_id` ou, na ausência dele, pela chave
  empresa, administradora e código;
- a deduplicação é somente de apresentação e não mistura administradoras nem
  exclui registros ou histórico.

## Verificação

Testes unitários cobrem espaços, caixa, prioridade global, administradoras
distintas e solicitações repetidas para o mesmo grupo.
