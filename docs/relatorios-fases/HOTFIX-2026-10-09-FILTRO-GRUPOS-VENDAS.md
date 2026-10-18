# Hotfix — Grupos repetidos no filtro de Vendas

Data: 09/10/2026.

## Causa e correção

O seletor reunia textos diferentes de vendas e cotas, usando o texto como
identidade. A leitura do banco confirmou nomes como `005288` e `5288 VEÍCULO`
para o mesmo `grupo_id`, além de divergência histórica de código em uma cota.

O DTO preserva o UUID canônico de grupo. Seletor e filtros de vendas, cotas e
boletos utilizam esse UUID; códigos textuais ficam como fallback somente na
ausência do vínculo. O nome vem prioritariamente do catálogo da venda, sem
reescrever o snapshot histórico da cota. Zeros iniciais e espaços são
normalizados apenas na apresentação do seletor. Grupos de mesmo número com
UUIDs distintos continuam separados, incluindo Veículo e Moto.

Não há migration, alteração de registros, snapshots ou regras financeiras.

## Validação e implantação

52 testes aprovados em 14 arquivos; três testes live previamente desativados
não contam como evidência. TypeScript sem erros. Testes específicos cobrem
variações pelo mesmo UUID, grupos distintos de mesmo número e legado sem UUID.
Lint dos novos módulos sem erros ou avisos. Build remoto aprovado e publicado
em `dpl_EzaECcuM4hUrWFHWbjpTngEzBuwu`, URL
`https://guachinho-site-e9xc5hoa3-hugo-8097s-projects.vercel.app`.
Smoke autenticado no domínio Racon Sinop confirmou HTTP 200 e 12 opções de
grupo únicas, incluindo `5288 VEÍCULO`, sem as variantes com zeros iniciais.
A sessão temporária foi encerrada após a validação.

Rollback: restaurar deployment anterior, sem reversão de banco.
