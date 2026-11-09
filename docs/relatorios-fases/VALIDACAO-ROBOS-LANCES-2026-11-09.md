# Validação dos robôs de lances em 09/11/2026

O modo de teste chega à tela de oferta e lê seus parâmetros antes de encerrar a consulta. Cada conta pode ser validada em uma execução direcionada a uma cota com estratégia ativa.

A coluna Crédito usa o valor do bem registrado pelo Newcon, o crédito individual cadastrado ou o valor individual da importação legada. Quando os três estiverem ausentes, a interface indica “Não informado”. A base do cálculo em reais permanece no campo de saldo devedor.

O robô remove os ouvintes de diálogos e novas abas ao concluir cada cota. Isso evita que os ouvintes da cota anterior tratem avisos e protocolos da cota seguinte.

Na execução `6a143599-37fc-499d-bc30-e6dd89602d60`, o worker interrompeu o lote aos 10 minutos. A consulta posterior confirmou no histórico e no Storage os comprovantes dos protocolos 5772260 e 5772261 da cota 1553/0067. O limite de lances no código atual do worker é de três horas.

O vínculo no histórico individual agora é gravado após cada upload e antes de sair do relatório no Newcon. Se a gravação falhar, a cota registra erro. Assim, uma interrupção após esse vínculo preserva o comprovante de cada modalidade já concluída.
