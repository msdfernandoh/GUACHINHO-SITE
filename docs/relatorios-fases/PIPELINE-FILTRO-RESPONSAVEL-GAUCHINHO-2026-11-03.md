# Pipeline Gauchinho — filtro por responsável — 03/11/2026

Relato restrito ao portal Gauchinho. Inspeção encontrou filtro por igualdade de um
único ID, enquanto a lista de consultores consolida usuários da mesma identidade
auth_user_id e descartava os IDs alternativos. O histórico Gauchinho também pode
ter responsáveis não elegíveis para novas atribuições.

Consultores agora conservam usuarioIds da identidade comprovada no tenant.
Filtro local reconhece esses IDs. Opções adicionais são derivadas exclusivamente
dos leads já autorizados no quadro, identificadas como vínculo histórico.
Essas opções não são repassadas ao modal para novas atribuições.
Não agrupa por nome, não cruza empresas, não modifica atribuições ou RLS.

Sete testes aprovados: identidades/legado, homônimos separados, sem responsável,
históricos e opções únicas. TypeScript aprovado. Homologação autenticada no portal
Gauchinho pendente; não consultados nem alterados leads reais.
