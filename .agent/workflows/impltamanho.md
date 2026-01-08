---
description: implementacao de tamnho
---

📌 SCRIPT DE IMPLEMENTAÇÃO — VARIAÇÃO DE TAMANHO (PEQUENA / MÉDIA / GRANDE)
CONTEXTO

Sistema de bar/restaurante já possui:

Produtos

Variação de sabores (incluindo meio a meio)

Venda por mesa/comanda

Objetivo:
Implementar variação de tamanho (Pequena, Média, Grande), onde o preço é definido pelo tamanho, sem quebrar a variação de sabores existente.

1️⃣ BANCO DE DADOS (MySQL)
Criar tabela de tamanhos por produto
CREATE TABLE produto_tamanhos (
  id INT AUTO_INCREMENT PRIMARY KEY,
  produto_id INT NOT NULL,
  nome VARCHAR(50) NOT NULL,
  preco DECIMAL(10,2) NOT NULL,
  ativo TINYINT(1) DEFAULT 1,
  FOREIGN KEY (produto_id) REFERENCES produtos(id)
);

Ajustar tabela de produtos
ALTER TABLE produtos
ADD COLUMN possui_variacao_tamanho TINYINT(1) DEFAULT 0;

2️⃣ CADASTRO / EDIÇÃO DE PRODUTO
Regras

Adicionar opção “Possui variação de tamanho”

Se marcado:

Exibir seção para cadastrar tamanhos

Permitir adicionar / editar / desativar tamanhos

Cada tamanho deve ter:

Nome (Pequena, Média, Grande)

Preço

Comportamento

Produto não pode ser vendido sem ao menos 1 tamanho ativo

Preço do produto passa a ser ignorado

Preço vem exclusivamente do tamanho

3️⃣ BACKEND (Node / API)
Criar endpoints
GET    /produtos/:id/tamanhos
POST   /produtos/:id/tamanhos
PUT    /produto-tamanhos/:id
DELETE /produto-tamanhos/:id (desativar)

Regra de negócio

Se possui_variacao_tamanho = true:

Venda exige tamanho_id

Valor do item = preço do tamanho

Sabores NÃO alteram o valor

4️⃣ VENDA / COMANDA / MESA
Fluxo ao adicionar produto

Selecionar produto

Se possui variação de tamanho:

Exibir modal/lista de tamanhos

Obrigatório selecionar 1 tamanho

Após selecionar tamanho:

Atualizar preço automaticamente

Se produto possuir variação de sabor:

Permitir escolher sabor ou meio a meio

5️⃣ ITENS DA VENDA (BANCO)
Ajustar tabela de itens
ALTER TABLE itens_venda
ADD COLUMN tamanho_id INT NULL,
ADD COLUMN valor_unitario DECIMAL(10,2);

ALTER TABLE itens_venda
ADD FOREIGN KEY (tamanho_id) REFERENCES produto_tamanhos(id);

Regra

valor_unitario deve receber o preço do tamanho no momento da venda

Mesmo que o preço do tamanho mude depois, a venda não é afetada

6️⃣ TELAS (UX)
Cadastro de Produto

Checkbox: Possui variação de tamanho

Grid de tamanhos com preço

Botão “Adicionar tamanho”

Tela de Venda

Seleção de tamanho obrigatória

Preço visível e atualizado em tempo real

Sabores continuam funcionando normalmente

7️⃣ RELATÓRIOS / IMPRESSÃO
Exibir:
Porção de Batata (Grande)
½ Calabresa | ½ Bacon
R$ 45,00
