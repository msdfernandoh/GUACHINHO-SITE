# Fase 150 — DNS Registro.br e Vercel

Data: 27/08/2026  
Escopo: onboarding de domínio próprio das franquias, diagnóstico DNS e orientação operacional.

## Problema encontrado

O sistema inferia subdomínio pela quantidade de partes separadas por ponto. Por
isso um domínio raiz brasileiro como `raconsorriso.com.br` era interpretado como
subdomínio e recebia orientação CNAME inadequada. A presença das variáveis da
Vercel também era apresentada como conexão válida, mesmo quando o token não
possuía acesso suficiente à API.

## Evidências de produção

- `raconsorriso.com.br` está cadastrado no projeto Vercel `guachinho-site` como
  domínio de Produção, ainda com configuração DNS inválida;
- a opção “Vercel DNS” do próprio projeto exige
  `ns1.vercel-dns.com` e `ns2.vercel-dns.com`;
- o Registro.br aceitou os dois servidores e informou período de transição;
- antes da troca, o domínio ainda respondia pelos nameservers automáticos do
  Registro.br;
- `gauchinhoconsorcios.com.br` já usa os dois nameservers da Vercel e serviu como
  referência operacional válida.

## Correções entregues

1. A classificação usa exclusivamente `empresa_dominios.tipo`; não conta mais
   pontos, evitando erro em `.com.br`.
2. Domínio próprio recebe orientação preferencial para delegação integral do DNS
   à Vercel, com passos específicos do Registro.br.
3. A interface impede a troca prematura quando o domínio ainda não foi confirmado
   na Vercel e alerta sobre preservação de MX/TXT para domínios com e-mail.
4. Subdomínios continuam usando CNAME, sem alterar os nameservers do domínio pai.
5. O diagnóstico consulta registros NS e reconhece a delegação Vercel como
   evidência válida.
6. O IP recomendado atual do projeto (`216.150.1.1`) e o legado
   (`76.76.21.21`) são aceitos, evitando falso negativo durante transições.
7. Erro de credencial e conflito real de domínio agora possuem mensagens
   diferentes.
8. Quando a automação não tem acesso, o Superadmin pode confirmar manualmente a
   presença do domínio no projeto, sem fingir que o token foi validado.
9. A migration `148_normaliza_dns_registrobr_vercel.sql` normaliza instruções já
   persistidas e registra `raconsorriso.com.br` como adicionado após conferência
   visual no projeto correto.

## Operação padrão

1. Cadastrar domínio na Platform.
2. Confirmar que aparece no projeto Vercel `guachinho-site`.
3. Se for domínio próprio no Registro.br, usar os nameservers `ns1` e `ns2` da
   Vercel. Não é necessário preencher “Configurar endereçamento”.
4. Aguardar a transição do Registro.br e a propagação global (até 48 horas).
5. Clicar em “Verificar DNS agora”; o cron repete a verificação das pendências.
6. O domínio só fica operacional quando DNS e HTTPS estiverem disponíveis.

## Validação

- lint sem erros;
- testes direcionados aprovados;
- build de Produção aprovado;
- migration 148 aplicada no Supabase remoto.

## Observação operacional

O domínio funciona pelo fluxo manual confirmado. Para que futuros domínios sejam
incluídos sem confirmação manual, o token `VERCEL_API_TOKEN` precisa ser renovado
com acesso ao time e ao projeto configurados; a aplicação não lê nem expõe esse
segredo.
