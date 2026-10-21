# Análise e teste do robô de boletos ERP — 21/10/2026

## Escopo e evidências
Pedido: baixar boletos dos clientes cota por cota e disponibilizar em Vendas & Cotas, aba Boletos. Repositório GAUCHINHO SITE; dados financeiros, cotas, clientes e credenciais preservados.

Consulta ao Supabase configurado confirmou tabela cotas_boletos vazia e configuração de boletos restrita às três cotas SNP 1176/1552/1617 do grupo 5288. Essa consulta pontual era confundida com o robô da carteira. Duas solicitações estavam PENDENTES; o processamento depende do runner local, não ocorre somente por abrir a tela.

Os logs históricos registravam SUCESSO apesar de três erros de navegação e zero PDFs. O primeiro teste desta fase reproduziu a emissão bloqueada: o seletor escolhia o botão desabilitado Emitir Cobrança Mensal. HTML real mostrou que as linhas das pendências utilizam input type=image com imgEmite_Boleto, e não checkbox. A primeira pendência era uma diferença negativa; a parcela do mês exige seleção própria. Após corrigir a seleção, o botão Emitir Cobrança foi habilitado. O popup temporário fechava antes da extração por DOM.

## Correções locais
- Carteira paginada em lotes de 500, empresa explícita obrigatória, filtro de administradora quando configurada e exclusão de cotas/vendas canceladas. Falha de consulta interrompe; sem fallback para primeira empresa ou snapshot de venda.
- Consulta pontual continua limitada às suas cotas. Provisionamento do robô completo não considera essa consulta como a configuração da carteira. Credencial da própria empresa tem prioridade; busca global limita-se a configurações sem empresa.
- Seleção da parcela da competência civil de Cuiabá; ignora diferença negativa, parcela futura e controle desabilitado. Usa botão de imagem da linha e botão de emissão habilitado com nome exato.
- Captura acompanha respostas PDF e downloads de páginas/popup temporário. Não reabre URL do relatório. HTML só é impresso se tiver identificação de cobrança; conteúdo vazio ou que não comece com assinatura PDF é rejeitado.
- Extração usa cópia Uint8Array para não destacar o buffer do upload.
- Persistência exige PDF e linha digitável ou Pix. Valor extraído ausente permanece nulo; não inventa valor com a parcela cadastrada.
- Storage usa empresa/competência/UUID da cota/SHA256, permitindo repetição sem criar outro nome de arquivo.
- Histórico cotas_boletos utiliza a chave canônica existente. Controle vendas_boletos_envios é consultado por empresa+venda+cota+competência e inserido/atualizado, eliminando ON CONFLICT em chave inexistente e mistura entre cotas da mesma venda.
- Erros retornados pelo Supabase interrompem a cota e são contabilizados; falha parcial resulta em ERRO no executor. Contadores só avançam após upload e duas gravações. Envios anteriores e status PAGO são preservados.
- Painel consulta arquivos realmente armazenados em vez de manter o indicador fixo em zero. Executor passa a registrar resultado próprio de boletos.

## Testes e situação de implantação
23 testes aprovados em quatro arquivos: extração, seleção, paginação, captura de popup, rejeição de HTML, isolamento por empresa/cota, idempotência sequencial, falhas de Storage/banco e contrato da aba Boletos. Vitest terminou com exit 0 e aviso de encerramento lento do servidor Vite após os testes; sem falha de teste. Build de produção e TypeScript aprovados. ESLint direcionado sem erros; quatro avisos preexistentes de any no módulo de Robôs.

### Teste real concluído
Execução em 21/10 nas três cotas SNP da mesma venda: 1617, 1176 e 1552. Três PDFs baixados, armazenados e vinculados separadamente em cotas_boletos e vendas_boletos_envios. Verificação posterior baixou os três objetos diretamente do Storage e extraiu o conteúdo novamente: identidade grupo/cota confirmada em cada arquivo; tamanhos de 176775, 176300 e 176741 bytes. Valor nominal R$ 799,54 em cada documento, vencimento do boleto reemitido 21/10/2026. Competência consultada continua outubro; o vencimento original da parcela no detalhe é distinto do vencimento do novo boleto. Sem Pix textual detectado; linha digitável presente. Valor e vencimento, inicialmente nulos, foram completados nas duas tabelas exclusivamente nos três paths obtidos no teste, com o extrator corrigido e leitura posterior.

A consulta usa exatamente empresa, venda e cota nas tabelas consumidas pela UI existente. Não foi feita inspeção autenticada da tela publicada nesta fase; a comprovação é do download real e dos vínculos lidos pelo serviço da aba. A carteira inteira permanece fora do teste.

Sem migration, sem exclusão de dados, sem pagamento e sem envio de WhatsApp. Somente execuções de teste das três cotas configuradas; a carteira inteira não foi executada. Envio das correções à main autorizado pelo titular em 21/10/2026. O push não confirma a implantação da interface nem a execução automática da carteira completa.

## Limitações observadas
Storage mantém o bucket público e policies existentes da migration 320; esta fase não declara hardening de privacidade concluído. Sincronização entre duas tabelas ocorre em duas operações, sem transação única; falha entre elas pode deixar histórico disponível e controle pendente para retry. Persistência sem índice único de controle não garante concorrência entre dois executores diretos; runner coordenado deve ser usado. O runner possui limite global de dez minutos, insuficiente para carteiras grandes sem lotes/retomada. Download e identidade dos três PDFs foram conferidos no Storage; a renderização autenticada da tela publicada e a execução da carteira completa não foram homologadas.

Reversão: retornar arquivos de aplicação; registros de execução de teste ficam como evidência. Não apagar arquivos/documentos reais obtidos.
