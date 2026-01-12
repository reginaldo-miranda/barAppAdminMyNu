---
description: alteracoes no sistema delivery
---

Alterações necessárias no sistema de Delivery

É necessário implementar as seguintes melhorias no módulo de Delivery, sem impactar as funcionalidades já existentes:

1. Cliente

Adicionar um campo de input para Nome do Cliente.

Este campo deve buscar automaticamente no cadastro de clientes.

Caso o cliente não exista, deve abrir a tela de cadastro de cliente para inclusão.

2. Funcionários

Adicionar a seleção do funcionário entregador.

Utilizar o mesmo cadastro de funcionários já existente (o mesmo usado nas comandas).

Manter também o registro do funcionário que realizou o atendimento.

3. Venda Balcão com Delivery

Ao realizar uma venda de balcão com opção Delivery, o sistema deve:

Solicitar:

Nome do cliente

Funcionário entregador

Funcionário que atendeu

Trazer automaticamente do cadastro do cliente:

Endereço de entrega

Cidade

Enviar essas informações para a tela de Delivery para:

Calcular a taxa de entrega

Na venda deve constar:

Nome do cliente

Nome do entregador

Nome do funcionário que atendeu

Soma dos produtos

Taxa de entrega

Valor total da venda

4. Tela de Entregas

Na tela de Entregas, cada venda deve exibir:

Nome do cliente

Nome do funcionário entregador

Nome do funcionário que atendeu

Data e hora da venda

Valor total

5. Confirmação de Entrega

Ao clicar em Confirmar Entrega:

Abrir a tela de finalização

Permitir encerrar a venda corretamente

6. Filtros na Tela de Entregas

Implementar os seguintes filtros:

Filtro por status (Entregue / Não Entregue)

Filtro por período (datas)