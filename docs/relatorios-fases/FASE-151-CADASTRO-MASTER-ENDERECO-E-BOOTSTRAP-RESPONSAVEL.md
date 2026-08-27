# Fase 151 — Cadastro completo e bootstrap do responsável

Data: 27/08/2026
Escopo: cadastro/onboarding de Master Franquia e convite do primeiro usuário responsável.

## Problemas corrigidos

1. CNPJ, telefone e WhatsApp aceitavam conteúdo sem máscara e sem validação
   cadastral suficiente.
2. A empresa possuía apenas cidade/UF; não havia estrutura própria para CEP e
   endereço completo.
3. A RPC de convite exigia `empresas.ativo = true`, mas a ativação da empresa
   exige previamente um usuário responsável. Isso criava uma dependência
   circular e deixava o botão aguardando uma operação que terminava em erro.

## Entrega

- máscaras brasileiras para CNPJ, telefone, WhatsApp e CEP;
- preenchimento automático de logradouro, bairro, cidade e UF via ViaCEP, com
  edição manual preservada;
- validação no servidor e persistência normalizada (documentos e telefones sem
  pontuação);
- colunas aditivas `cep`, `endereco`, `numero`, `complemento` e `bairro` em
  `empresas`, sem alteração ou perda dos dados existentes;
- RPCs de atualização e onboarding com endereço estruturado e auditoria;
- convite do primeiro responsável autorizado para franquias em treinamento,
  exclusivamente pela Platform e sem remover validações de papel, quota,
  módulos, unicidade ou multi-tenancy N:N;
- primeiro vínculo marcado automaticamente como responsável principal quando a
  empresa ainda não possui responsável, mesmo que o operador não marque o
  checkbox; a interface também antecipa visualmente essa seleção;
- a ativação continua sendo uma etapa posterior e continua validando assinatura,
  administradora concedida e usuário responsável.

## Segurança e escala

O ajuste não usa `usuarios.company_id` nem relaciona consultor a `auth.uid()`.
Identidade, papel e empresa permanecem separados por `empresa_usuarios`. A RPC
continua `SECURITY DEFINER`, com `search_path` fixo, checagem explícita de
`is_platform_superadmin()` e execução negada a `PUBLIC`/`anon`.

## Banco de dados

Migrations: `149_cadastro_master_endereco_e_bootstrap_responsavel.sql`,
`150_resolve_onboarding_endereco_overload.sql` e
`151_primeiro_usuario_responsavel_automatico.sql`.

Ela é aditiva e idempotente para as colunas. A ampliação das RPCs é publicada
como sobrecarga compatível para não interromper consumidores históricos; a
aplicação usa os novos parâmetros nomeados. A migration 150 mantém a função
histórica sob um nome-base interno explícito, evitando ambiguidade de resolução
entre assinaturas no PostgreSQL.

## Validação executada

- ESLint direcionado sem erros;
- build completo do Next.js aprovado;
- 8 testes direcionados aprovados;
- migrations 149 e 150 aplicadas no Supabase vinculado;
- lint do schema remoto concluído sem erros.
