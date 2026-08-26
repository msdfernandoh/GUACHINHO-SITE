# Fase 138 — Qualidade regressiva e decisões futuras

**Data:** 26/08/2026  
**Migration:** não aplicável  
**Código:** `main@34aeb3c`  
**Deployment verificado:** `dpl_BfrDtiZAoq9ap4SFzRtfXQhRJVA7` (`READY`)  
**Status:** saneamento executável concluído; decisões de legado/API registradas, sem implementação antecipada.

## Entrega realizada

- lint reduzido de 173 erros para zero erros bloqueantes;
- baseline de 353 avisos históricos mantido visível e travado, impedindo aumento;
- comandos `lint:errors`, `test:regression` e `check` consolidados;
- Vitest migrado para configuração ESM nativa, sem o aviso de carregamento futuro;
- Home deixou de construir JSX dentro de `try/catch`;
- Auditoria cancela atualização assíncrona após desmontagem e não usa função antes da declaração;
- campos de financiamento deixaram de criar componente durante renderização;
- QR passou a usar `useId`, sem aleatoriedade durante renderização;
- pequenas correções mecânicas seguras de `prefer-const`.

## Evidências

- `npm run lint`: 0 erros, baseline de 353 avisos;
- `npm run lint:errors`: aprovado;
- Vitest: 185 arquivos e 1.028 testes aprovados;
- 9 arquivos e 37 testes live ignorados por padrão, pois acessam ambiente remoto;
- Next.js/TypeScript: build aprovado com 146 páginas;
- `git diff --check`: aprovado;
- nenhum SQL criado ou aplicado; Supabase continua em `001–135`.

## Avisos históricos

Os avisos não foram ocultados. Os três grupos que exigem refatoração gradual
(`no-explicit-any`, sincronização de estado em effects e textos JSX históricos)
continuam como warning. O teto de 353 torna o estado mensurável: uma alteração
que elevar a contagem faz `npm run lint` falhar. Correções futuras devem reduzir
o teto no mesmo commit.

## Carteira legada — contrato funcional aprovado

1. A importação ocorre em lotes e o operador seleciona na tela o modelo de
   comissão Racon já cadastrado.
2. A data histórica da contratação ancora o cronograma do modelo.
3. Somente etapas posteriores à posição temporal atual são criadas. Exemplo:
   contratação há 12 meses e comissão na parcela 18 gera previsão em seis meses.
4. Etapas já vencidas não são geradas; carteira encerrada permanece apenas para
   controle de cota, lance, contemplação e estorno.
5. Grupo/cota atuais podem ser vinculados, mas crédito, parcela e condições da
   contratação ficam congelados em snapshot histórico.
6. Se a planilha trouxer parcela atual/paga e ela divergir do cálculo pela data,
   a linha fica em erro de conferência; não haverá competência presumida.
7. Contemplados entram em lote separado com bloqueio definitivo de comissão.
8. Nenhuma implementação começa antes da análise de uma amostra real da
   planilha, necessária para mapear colunas e formatos.

## API Racon — contrato funcional aprovado

- integração específica Racon, sem `administradora_id` no payload externo;
- autenticação/endpoint identificam unicamente o conector;
- futuras administradoras terão conectores independentes;
- dados esperados: grupo, cotas, vagas disponíveis/totais, taxa administrativa,
  seguro, fundo de reserva, prazo, assembleias, primeira assembleia,
  características de contemplação, média de lance livre e contemplados do mês;
- ingestão idempotente e reprocessável;
- tela de auditoria inicialmente desativada, pronta para homologação, com erros
  por linha, perda de conexão, tentativas e comando explícito de reprocessamento;
- nenhuma integração externa foi ativada nesta fase.

## Itens deliberadamente adiados

- conciliação bancária e projeção de caixa, por decisão do produto;
- importador legado, até recebimento da planilha;
- execução da API Racon, até aprovação do documento de contrato e definição de
  credenciais/forma de transporte pela matriz.
