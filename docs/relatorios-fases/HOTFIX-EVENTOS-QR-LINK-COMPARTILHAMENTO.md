# Eventos — QR Code do link público

Data: 07/09/2026.

## Entrega

A listagem administrativa e o cabeçalho do detalhe do evento oferecem **QR Code**
e **Copiar link**, sem salvar ou modificar o evento. O modal apresenta o código,
o endereço selecionável e download PNG de 1200 × 1200 pixels, com fundo branco
e margem para leitura e uso em convites. O modal nativo permite fechamento por
Escape e mantém o foco dentro da janela.

O endereço é `/eventos/{slug}` no domínio atual, igual à navegação pública da
listagem. O QR é gerado localmente com a dependência `react-qr-code` já instalada.
Está disponível inclusive sem QR único; não substitui os vínculos reutilizáveis
`/qr/{slug}` nem o QR do sorteio. Eventos não publicados mostram aviso antes da
divulgação. Falhas da área de transferência oferecem cópia manual do endereço.

## Preservação

Sem migration, gravação no banco, dependência nova ou mudança de autorização.
Os dados, vínculos QR e períodos existentes permanecem preservados.

## Validação

- TypeScript: `npx tsc --noEmit` aprovado.
- ESLint do componente de compartilhamento aprovado.
- Regressão direcionada ao QR único: `src/lib/eventos-sorteio/qr-unico.test.ts`, quatro testes aprovados.
