# Dashboard principal do proprietário

## Objetivo
Ampliar o painel já existente sem alterar login, cadastro, logo ou identidade visual, oferecendo uma visão consolidada e funcional dos três mercados.

## Implementação
- Extrair o painel para componentes próprios, preservando o fluxo atual de entrada e cadastro.
- Criar menu lateral recolhível com todas as áreas solicitadas, estado ativo, modo compacto no computador e gaveta no celular.
- Montar o topo com seletor de mercado, busca funcional, notificações, período, usuário e menu de perfil.
- Exibir nove indicadores principais com valores fictícios e atualização conforme mercado/período selecionado.
- Adicionar cinco visualizações: vendas em sete dias, comparação entre mercados, mais vendidos, menor giro e perdas/divergências.
- Criar cards detalhados para Mercado Central, Mercado Jardim e Mercado Avenida, com alertas controlados e ação para adicionar mercado.
- Ao selecionar um mercado, abrir uma página provisória dentro do painel com o nome e os dados daquele mercado, incluindo retorno à visão geral.
- Simular busca, filtros, notificações, navegação lateral, recolhimento do menu e perfil sem banco ou autenticação real.
- Garantir boa adaptação para computador, tablet e celular.

## Validação
- Conferir login → dashboard e cadastro → dashboard.
- Testar filtros, busca, menus, cards e página provisória dos mercados.
- Verificar visualmente computador e celular, sem sobreposição ou rolagem horizontal.
- Confirmar ausência de erros na compilação e no console.
