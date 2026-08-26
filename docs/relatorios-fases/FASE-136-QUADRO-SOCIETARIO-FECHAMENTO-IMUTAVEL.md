# Fase 136 — Quadro societário por empresa e fechamento imutável

**Data:** 26/08/2026  
**Migrations:** `134_socios_empresa_fechamento_imutavel.sql` e `135_fechamento_socios_bloqueio_periodos_sobrepostos.sql`  
**Supabase:** `eaeuoynprurmmulzhydt` (`Gauchinho-Site`, Production)  
**Status:** banco aplicado, pós-check e validação automatizada aprovados; promoção para `main` registrada no fechamento desta fase.

**Código funcional:** `main@11eea1e`  
**Deployment validado:** `dpl_GAjoJdNAET3jYAwo5JKuk2XS7TXw` (`READY`)

## 1. Problema corrigido

O ERP já permitia marcar usuários como `socio_pagador`, mas essa marca não era
um quadro societário. O cálculo visual considerava apenas os dois primeiros
usuários, assumia divisão fixa de 50% e não congelava percentuais, contas ou
instruções de acerto. Esse desenho não atendia novas franquias, mais de dois
sócios nem mudanças de participação ao longo do tempo.

## 2. Modelo implantado

- `empresa_socios`: sócio ligado simultaneamente a `empresa_id` e `usuario_id`,
  com percentual, vigência e histórico;
- `empresa_socio_contas`: conta/Pix de recebimento pertencente ao sócio e ao
  mesmo tenant;
- `financeiro_fechamentos_socios`: cabeçalho idempotente do período;
- `financeiro_fechamento_socios_itens`: snapshot de nome, percentual,
  responsabilidade, valor pago, saldo e conta;
- `financeiro_fechamento_socios_instrucoes`: transferências necessárias entre
  devedores e credores, inclusive quando existem três ou mais sócios.

O vínculo antigo `empresa_usuarios.socio_pagador` foi preservado para
compatibilidade e passou a ser sincronizado pela configuração canônica.

## 3. Regras de integridade

- todo sócio precisa ser usuário ativo da mesma empresa;
- cada quadro vigente deve somar exatamente 100%;
- percentuais são positivos e no máximo 100%;
- uma conta bancária não pode apontar para sócio de outro tenant;
- alterações criam vigência nova; configuração do mesmo dia só pode ser refeita
  antes de ser usada em fechamento;
- fechamento exige quadro válido durante todo o período;
- períodos de fechamento da mesma empresa não podem se sobrepor, mesmo em
  chamadas concorrentes;
- impostos/deduções já descontados em comissão ficam fora da equalização;
- fechamentos, itens e instruções são append-only: `UPDATE` e `DELETE` são
  bloqueados por trigger;
- nenhuma conta, venda, comissão ou movimento de caixa preexistente foi
  apagado ou recalculado.

## 4. Segurança

- cadastro do quadro: somente Platform Superadmin;
- criação do fechamento: usuário autenticado com escrita financeira no tenant;
- contas de sócio e snapshots financeiros: somente Platform ou escrita tenant;
- RPCs sem execução para `PUBLIC`, `anon` e `service_role`;
- cinco tabelas com RLS habilitada;
- conta/Pix não é enviada ao navegador de usuários sem poder financeiro.

## 5. UI e UX

No cadastro da empresa no SaaS foi adicionada a aba **Sociedade**:

- seleciona usuários já vinculados à empresa;
- cadastra qualquer quantidade de sócios;
- mostra a soma em tempo real e só salva quando fecha 100%;
- registra banco, agência, conta, tipo de Pix, chave e favorecido;
- explica que a mudança gera nova vigência.

Em **ERP → Contas a pagar**:

- a prévia deixou de depender de Fernando/Eroni e de divisão 50/50;
- cada card mostra pago, percentual e responsabilidade de cada sócio;
- a equalização suporta múltiplos devedores e credores;
- a explicação leiga informa quem transfere, para quem, quanto e como o acerto
  altera o valor efetivamente assumido por cada um;
- a alternativa mostra quanto o devedor pode assumir em próximas contas;
- o botão **Fechar período selecionado** cria o documento histórico imutável.

## 6. Migração de dados

Os dois vínculos existentes da Gauchinho marcados como sócios pagadores foram
convertidos automaticamente para o quadro canônico. Como não havia percentual
anterior registrado, o backfill inicial distribuiu 100% igualmente. A aba
Sociedade permite confirmar ou alterar essa configuração antes do primeiro
fechamento formal.

O pós-check de Production encontrou:

- 2 sócios ativos em 1 empresa;
- 0 quadros com soma diferente de 100%;
- 0 fechamentos criados automaticamente;
- 5 tabelas com RLS;
- 3 triggers de imutabilidade;
- todas as quatro verificações de execução `anon/service_role` iguais a `false`.

O pós-check da migration 135 confirmou o trigger de bloqueio ativo, função sem
execução para `anon`/`service_role` e nenhum fechamento preexistente afetado.

## 7. Validação automatizada

- `npm test`: 185 arquivos e 1.022 testes aprovados; 9 arquivos e 37 testes
  explicitamente ignorados;
- `npm run build`: compilação, TypeScript e 146 páginas aprovados;
- `supabase migration list --linked`: histórico local/remoto contínuo
  `001–135`;
- pós-check permanente: `supabase/tests/fase_136_socios_fechamento_imutavel.sql`.

Smokes após a promoção:

- site público: `200` no host canônico `www`;
- ERP sem sessão: redirecionamento seguro para `/login?next=/erp` e resposta `200`;
- Platform sem sessão: redirecionamento seguro para `/login?next=%2Fplatform` e resposta `200`.

## 8. Próximas fases

1. homologação autenticada dos menus/papéis do ERP;
2. importação de clientes e comissões legadas após amostra real do relatório;
3. conciliação bancária e projeção de caixa;
4. integrações das administradoras somente quando existirem APIs documentadas.
