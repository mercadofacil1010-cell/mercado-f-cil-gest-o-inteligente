# Fluxo “Adicionar novo mercado”

## Objetivo
Conectar o botão existente da dashboard a um cadastro demonstrativo em cinco etapas, mantendo integralmente login, cadastro da empresa, dashboard e identidade visual atuais.

## Implementação
- Criar um fluxo reutilizável com progresso para Identificação, Endereço, Responsável, Estrutura e Cobrança.
- Incluir todos os campos solicitados, máscaras e validações visuais para obrigatórios, CPF, CNPJ, CEP, telefones e e-mails.
- Simular salvamento de rascunho, navegação entre etapas e convite ao gerente.
- Exibir na cobrança um resumo claramente marcado como demonstração, com plano, unidades, adicional mensal, próxima cobrança, proporcional e mensalidade estimada.
- Exigir o aceite sobre aumento da assinatura antes da confirmação.
- Exibir uma tela de sucesso e, ao retornar, adicionar a nova unidade aos filtros, totais e cards da dashboard durante a sessão.
- Preservar a abertura da página provisória ao clicar no novo card.

## Validação
- Verificar o fluxo completo em computador e celular.
- Confirmar validações, rascunho, retorno sem cadastro, inclusão do card, filtros e abertura da nova unidade.
- Confirmar ausência de erros visuais, de console e de compilação.

## Limites
- Sem pagamento, banco de dados ou autenticação real.
- Os dados persistem apenas durante a sessão atual da demonstração.
