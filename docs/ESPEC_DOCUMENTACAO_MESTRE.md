# Especificação da Documentação Mestre do Mercado Fácil

Recebida do proprietário em 23/09/2026. Isto é a **encomenda** de como a
futura *Documentação Mestre* deve ser escrita — ainda não é a documentação em
si. Só começo a escrevê-la quando o proprietário autorizar explicitamente
("pode gerar a Documentação Mestre" ou equivalente).

## Módulos que ela precisa cobrir (mínimo)

Estrutura SaaS; proprietário da plataforma; cadastro do cliente; empresa/rede;
múltiplos mercados; cobrança por mercado; App do Dono; Painel Web; App do
Conferente; App do Repositor; painel administrativo da plataforma; usuários;
funções; permissões; produtos; embalagens; códigos de barras; fornecedores;
recebimento; conferência cega; divergências; lotes; validade; depósito;
endereçamento; gôndolas; estoque; movimentações; estoque mínimo e máximo;
reposição; alertas; contagens; histórico das operações; dashboards; planos;
teste gratuito; assinaturas; cobrança; cupons.

## Para cada módulo, documentar

Objetivo; quem utiliza; onde aparece; telas necessárias; dados exibidos;
campos; botões e ações; regras de negócio; permissões; fluxo de entrada;
fluxo de saída; alterações geradas no banco; relação com outros módulos;
possíveis erros; estados da operação; critérios de aceite.

## Seção obrigatória: fluxos ponta a ponta

Exemplo dado pelo proprietário:

> mercadoria chega → conferente recebe → realiza conferência → produto entra
> no depósito → estoque é atualizado → sistema identifica necessidade de
> reposição → repositor recebe tarefa → retira produto do depósito → abastece
> gôndola → confirma → estoque é atualizado → dono acompanha tudo.

## Como isto se conecta ao que já foi registrado

- Segue a arquitetura de 5 superfícies da Correção 1 (`CORRECOES_ARQUITETURA.md`).
- Segue o padrão de experiência (menu inferior, simplicidade) da Correção 2.
- Detalha os fluxos do Conferente e do Repositor exigidos na Correção 3.
- Ao escrever, sigo a regra de conduta da Correção 4: onde não houver decisão
  do proprietário, marco **PENDÊNCIA DE DEFINIÇÃO** em vez de decidir.

**Status:** especificação registrada. Aguardando autorização do proprietário
para começar a escrever a Documentação Mestre.
