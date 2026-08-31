# Fase 166 — Modelos independentes, marca própria e contatos

Data: 31/08/2026.

## Entrega

- A duplicação solicita nome explícito e mantém a cópia em rascunho. Publicação e vínculo continuam ações separadas do Platform Superadmin.
- O renderizador visual é resolvido pela linhagem já existente `site_modelos.modelo_origem_id`, com limite de profundidade e proteção contra ciclos. Cópias e cópias de cópias mantêm a funcionalidade Racon sem depender de nome ou prefixo; Gauchinho e modelos desconhecidos permanecem isolados.
- Cópias podem ser preparadas para marca própria. A operação limpa na edição logo, imagens/textos de campanha, contatos e indicadores herdados, habilita logo própria e usa conteúdo neutro até a personalização. O modelo Racon original não é modificado.
- Telefone e WhatsApp passam a aceitar padrão do modelo em `identidade_visual.contatos` e override por empresa em `empresa_branding`; a empresa prevalece. Ausência não inventa números. Links `tel:`/`wa.me` só são emitidos para números validados.
- O HUB da Master Franquia ganhou “Contatos do site desta empresa”. Sites de parceiros passam a expor também telefone, além do WhatsApp já existente, reutilizando o JSON `branding` e a RPC canônica.

## Segurança e isolamento

Todas as gravações de Platform exigem Superadmin. A edição de contatos atualiza somente `empresa_branding.telefone/whatsapp` da empresa explícita. Duplicar não publica, não vincula empresa/parceiro e não altera o original. Nenhum registro real foi criado para validar a entrega.

## Verificações

Testes cobrem linhagem, ciclos, isolamento Gauchinho, precedência/validação de contatos, marca própria neutra e preservação do Racon original. TypeScript, ESLint, suíte completa e build são registrados no fechamento desta entrega.
