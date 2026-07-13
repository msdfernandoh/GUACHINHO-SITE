# Testes — Pacote Fechamento da Proposta

## Contratar pelo Simulador

1. Acesse `/simulador`, conclua uma simulação e clique em **Contratar agora**.
2. Confirme redirecionamento para `/proposta/{token}`.
3. Siga as etapas até finalizar.

## Contratar pelos Grupos

1. Acesse `/grupos`, selecione cota(s) e clique em **Contratar agora**.
2. Valide resumo financeiro na primeira tela.

## SDR — Gerar link

1. Entre como master ou SRD.
2. No simulador, **Contratar agora** → **Gerar link para enviar ao cliente** (ou botão dedicado em Grupos).
3. Copie o link ou envie pelo WhatsApp pelo modal.

## Cliente pelo link

1. Abra o link em aba anônima (sem login).
2. Confirme proposta, preencha dados, CPF/CNPJ, documentos e pagamento.

## Configurar Pix

1. Admin → **Configurações** → aba **Contratação**.
2. Ative Pix, informe chave e recebedor; opcionalmente exija comprovante.

## Boleto e cartão

Sem integração: o cliente vê mensagem informativa; a equipe envia boleto/link manualmente depois.

## Admin contratações

- Lista: `/admin/contratacoes`
- Detalhe: `/admin/contratacoes/{id}` — link público, documentos (URL assinada), pagamento.

## Documentos no admin (SDR/staff)

1. Login como **SRD** ou **master**.
2. Abra `/admin/contratacoes/{id}` com documentos enviados.
3. Use **Visualizar documento**, **Baixar documento** ou **Abrir em nova aba** — cada ação gera signed URL temporária (~1 h).
4. Imobiliária não acessa `/admin/contratacoes` (redirect). Se no futuro o perfil não tiver `canAccessContratacaoDocumentos`, verá a mensagem de permissão.

Migration `024_contratacoes_documentos_storage_rls.sql` alinha Storage ao RLS das tabelas.

## Migration

Aplicar no Supabase (SQL Editor), nesta ordem:

1. `supabase/migrations/023_contratacoes_online.sql`
2. `supabase/migrations/024_contratacoes_documentos_storage_rls.sql` (opcional, storage)
3. **`supabase/migrations/025_contratacoes_endereco.sql`** — colunas `cep`, `endereco`, `numero`, `complemento`, `bairro`, `cidade`, `uf` (etapa CPF/CNPJ)

Sem a **025**, a etapa de endereço falha com erro de *schema cache* até a migration ser aplicada.
