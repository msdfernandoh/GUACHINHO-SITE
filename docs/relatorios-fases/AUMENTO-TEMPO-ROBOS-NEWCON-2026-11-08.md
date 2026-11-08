# Aumento do tempo de execução dos robôs Newcon — 08/11/2026

O limite do worker foi separado por rotina: contemplação permanece em 6 horas,
lances passam a 3 horas e boletos a 2 horas. O polling do terminal passa a
acompanhar por até 3 horas; fechar a janela não cancela a execução registrada.

Validação: `npx tsc --noEmit` aprovado. O build local não concluiu por falha
ambiental de DNS para Google Fonts e permissões do diretório `.next`; o build
remoto anterior chegou à etapa de TypeScript e apontou apenas o erro corrigido.
