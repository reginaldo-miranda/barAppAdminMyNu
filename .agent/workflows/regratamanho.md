---
description: regra de preco de tamanho
---

🔴 O problema (conceitual)

Hoje o fluxo está assim:

Escolhe TAMANHO (pequeno / médio / grande)

Entra na tela MEIO A MEIO

O sistema usa apenas o preço do tamanho

❌ Ignora a regra do meio a meio

maior preço

preço fixo

preço médio

👉 Isso acontece porque o tamanho está sobrescrevendo o preço final, quando na verdade ele deveria ser apenas um modificador.

✅ Regra correta (modelo mental)

👉 O preço final SEMPRE deve sair da variação “MEIO A MEIO”
👉 O tamanho só define QUAL preço será usado

Resumo da hierarquia correta:

Produto
 └── Tamanho (define conjunto de preços)
      └── Meio a Meio (define a regra de cálculo)


Ou seja:

❗ Tamanho não calcula preço, quem calcula é o meio a meio

🧠 Forma correta de modelar no banco
1️⃣ Produto base
produto
- id
- nome
- permite_meio_a_meio (bool)
- permite_tamanho (bool)

2️⃣ Tamanhos (preço por tamanho)
produto_tamanho
- id
- produto_id
- nome (Pequeno | Médio | Grande)
- preco


📌 Aqui o preço não é o final, é apenas o valor base do sabor naquele tamanho

3️⃣ Regra do meio a meio
produto_meio_meio
- produto_id
- regra_preco ENUM('MAIOR', 'MEDIO', 'FIXO')
- preco_fixo (opcional)

🔁 Fluxo correto na VENDA
Passo 1 – Cliente escolhe TAMANHO

Ex:

tamanhoSelecionado = "Grande"

Passo 2 – Busca preços dos sabores no tamanho escolhido

Ex:

Batata grande = 40
Calabresa grande = 48

Passo 3 – Aplica a REGRA DO MEIO A MEIO
function calcularPrecoMeioAMeio(regra, sabores, precoFixo = 0) {
  const precos = sabores.map(s => s.preco)

  switch (regra) {
    case 'MAIOR':
      return Math.max(...precos)

    case 'MEDIO':
      return precos.reduce((a, b) => a + b, 0) / precos.length

    case 'FIXO':
      return precoFixo

    default:
      return 0
  }
}

Passo 4 – Exemplo real
Regra: MAIOR
sabores = [
  { nome: "Batata", preco: 40 },
  { nome: "Calabresa", preco: 48 }
]

precoFinal = calcularPrecoMeioAMeio("MAIOR", sabores)
// Resultado: 48

Regra: MÉDIO
Resultado: (40 + 48) / 2 = 44

Regra: FIXO
Resultado: preço definido no produto (ex: 45)

🚨 Erro comum que causa seu problema

❌ Calcular preço no tamanho

precoFinal = tamanho.preco


✔️ Preço sempre vem do meio a meio

precoFinal = calcularPrecoMeioAMeio(...)

🛠️ Ajuste prático no seu sistema (resumo para IDE)

Correção necessária:
Quando o produto possuir tamanho + meio a meio, o preço final não pode ser definido pelo tamanho.
O tamanho deve apenas filtrar o preço base de cada sabor, e o cálculo final deve respeitar a regra do meio a meio (maior, médio ou fixo).

💡 Dica extra (boa prática)

Salve na venda:

{
  "produto": "Porção Meio a Meio",
  "tamanho": "Grande",
  "sabores": ["Batata", "Calabresa"],
  "regra_meio_a_meio": "MAIOR",
  "preco_final": 48
}


Isso evita erro em relatórios e reimpressão de pedidos.

