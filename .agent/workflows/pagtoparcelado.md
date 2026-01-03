---
description: pagamento de conta total ou parcelado
---

Implementação de divisão e controle de pagamento por mesa/comanda

Implementar uma funcionalidade para dividir o recebimento de uma mesa ou comanda, permitindo pagamentos parciais, individuais ou fracionados por item.

Requisitos funcionais

Opção de divisão no fechamento

Ao iniciar o fechamento de uma mesa ou comanda, o sistema deve permitir que o usuário:

Escolha quais itens deseja pagar.

Pague valores parciais de um item (exemplo: pagar metade do valor de uma porção).

Seleção e marcação de itens

O usuário poderá marcar os itens que estão sendo pagos.

Conforme os itens forem selecionados, o sistema deve atualizar em tempo real:

Valor total da comanda.

Valor já pago.

Valor restante a pagar.

Pagamento fracionado

Para itens com pagamento parcial:

O usuário deverá informar manualmente o valor a ser pago.

O item só será marcado como “pago” quando o valor total do item for quitado.

Enquanto estiver parcialmente pago, o item deve permanecer como “em aberto”, exibindo o valor restante.

Persistência dos pagamentos

É obrigatória a criação de uma tabela no banco de dados para registrar:

Cada pagamento realizado.

O valor pago.

O valor restante.

Os itens vinculados à mesa/comanda.

Esse histórico será usado para consulta, continuidade do pagamento e auditoria.

Continuidade do pagamento

A mesa ou comanda não deve ser finalizada enquanto o valor total não for totalmente quitado.

Caso o usuário saia da tela e retorne:

O sistema deve recuperar os dados do banco.

Exibir corretamente:

Itens já pagos.

Itens parcialmente pagos.

Saldo pendente.

Permitir continuar o pagamento ou finalizar a venda.

Finalização

A finalização da mesa/comanda só será permitida quando:

Todos os itens estiverem totalmente pagos.

O saldo pendente for zero.

Observações importantes

A implementação deve reaproveitar a estrutura atual do sistema, realizando apenas os ajustes e melhorias necessárias.

Garantir que o fluxo seja intuitivo e que os valores sejam atualizados corretamente em tempo real.