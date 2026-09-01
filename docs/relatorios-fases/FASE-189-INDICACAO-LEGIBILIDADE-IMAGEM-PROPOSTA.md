# Fase 189 — Indicação e imagem completa da proposta

## Ajustes

- o item do menu público voltou a se chamar `Indicação`, evitando remontagem da
  navegação desktop;
- os rótulos dos campos do formulário de indicação agora são brancos e em
  negrito;
- `Copiar imagem` deixou de desenhar o cartão fixo incompleto;
- o botão consulta a proposta pública pelo token e usa a visualização atualmente
  selecionada no modal;
- a imagem resumida contém o mesmo conjunto essencial do link resumido;
- a imagem detalhada inclui proposta, grupos e todos os dados financeiros
  exibidos no link detalhado.

## Segurança e consistência

A imagem usa somente a resposta já sanitizada da API pública da proposta. Nenhum
dado privado adicional é consultado ou incluído no arquivo copiado.
