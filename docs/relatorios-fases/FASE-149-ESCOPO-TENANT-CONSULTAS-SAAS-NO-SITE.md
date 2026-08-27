# Fase 149 — Escopo tenant nas consultas SaaS do site

Data: 27/08/2026

## Problema

As páginas de consulta “Empresas (SaaS)” e “Catálogo de Administradoras” do
admin tenant utilizavam consultas globais quando o usuário conectado também
possuía papel Platform Superadmin. No domínio da Gauchinho isso expunha nomes e
status de outras franquias independentes e administradoras não concedidas.

## Correção

- `/admin/empresas` exibe exclusivamente `empresaAtiva` resolvida pelo domínio e vínculo N:N da sessão.
- `/admin/empresas/{uuid}` retorna 404 quando o UUID não é o tenant ativo.
- `/admin/administradoras` usa `listAdministradorasAutorizadasForEmpresa(empresaAtiva.id)` e mostra somente administradora global ativa com concessão ativa.
- `/admin/administradoras/{uuid}` usa `getAdministradoraAutorizadaById`; UUID sem concessão retorna 404.
- O detalhe da administradora não revela a lista de outras franquias vinculadas.
- Os rótulos do menu foram alterados para “Minha empresa (SaaS)” e “Administradoras autorizadas”.

## Fronteiras mantidas

- `/admin`: contexto tenant da franquia identificada pelo host e sessão.
- `/platform`: governança global, todas as empresas e administradoras, exclusiva da Plataforma SaaS.
- O papel Platform Superadmin não remove o isolamento tenant quando navega em `/admin`.

## Banco de dados

Não há nova migration. O modelo correto já existe em `empresa_usuarios` e
`empresa_administradoras`; a falha estava na escolha da consulta pelas páginas.

## Testes

Foi adicionado contrato regressivo que impede o retorno das consultas globais
às páginas tenant e exige validação do UUID nas rotas de detalhe.
