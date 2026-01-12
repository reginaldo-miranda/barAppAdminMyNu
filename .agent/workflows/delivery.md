---
description: implementcao de delivery
---

Implementação de Sistema de Delivery com Google Maps integrado à Venda Balcão
Objetivo

Implementar um sistema de delivery utilizando Google Maps para cálculo de distância e valor de entrega, sem criar um novo tipo de venda, aproveitando a venda de balcão já existente, que só poderá ser finalizada após a confirmação da entrega pelo entregador.

1️⃣ Regra Principal de Venda (Delivery)

O delivery deve utilizar exclusivamente a Venda Balcão existente no sistema.

Ao marcar uma venda de balcão como Delivery:

A venda não deve ser finalizada imediatamente.

A venda de delivery somente poderá ser fechada quando:

O entregador retornar à loja, ou

O entregador confirmar a entrega no sistema.

Enquanto não houver confirmação de entrega:

A venda deve permanecer em aberto

Deve aparecer em uma lista de Entregas em Andamento

Após a confirmação:

A venda é finalizada normalmente

Registrar data e hora da entrega

2️⃣ Configurações da Loja

Criar (ou utilizar) uma tela de Configurações para cadastrar:

Endereço completo da loja

Latitude e longitude da loja (fixas)

Raio máximo de entrega (opcional)

Essas informações serão usadas como ponto de origem para o cálculo do delivery.

3️⃣ Cadastro de Perímetros e Valor de Entrega

Criar configuração de faixas de distância para definir o valor da entrega:

Exemplo:

0 a 2 km → R$ 5,00

2 a 5 km → R$ 8,00

5 a 8 km → R$ 12,00

Fora do perímetro → não permitir delivery

As faixas devem ser configuráveis, sem necessidade de alterar código.

4️⃣ Tela de Venda / Delivery (Frontend)

Na tela de Venda Balcão, ao marcar a opção Delivery:

Exibir campo para endereço do cliente com Google Places Autocomplete

Exibir o endereço selecionado no Google Maps

Ao selecionar o endereço:

Calcular automaticamente a distância entre loja e cliente

Identificar o perímetro correspondente

Definir o valor da taxa de entrega

Exibir na tela:

Endereço de entrega

Distância calculada

Valor da entrega

Total da venda atualizado automaticamente

5️⃣ Cálculo da Distância

Implementar cálculo de distância entre:

Endereço da loja (fixo)

Endereço do cliente

Opções:

Preferencialmente usar Google Distance Matrix API

Alternativamente, cálculo por latitude/longitude (linha reta)

6️⃣ Regras de Negócio

O valor da entrega deve ser definido automaticamente

Não permitir edição manual do valor do frete

Se o endereço estiver fora do perímetro:

Bloquear a venda como delivery

Exibir mensagem informando que a região não é atendida

Validar o valor da entrega também no backend

7️⃣ Backend

Criar/ajustar endpoints para:

Buscar configurações da loja

Buscar faixas de perímetro

Calcular distância (se for feito no backend)

Confirmar entrega pelo entregador

Finalizar a venda somente após confirmação

8️⃣ Requisitos Gerais

Funcionar corretamente em telefone e desktop

Não quebrar funcionalidades existentes

Não criar novo tipo de venda

Apenas estender a venda de balcão para suportar delivery

Estrutura preparada para futuras melhorias


acho melhor fazer a opcao abaixo sem chave 

Implementação de Sistema de Delivery com OpenStreetMap (Gratuito) integrado à Venda Balcão
Objetivo

Implementar um sistema de delivery utilizando OpenStreetMap, permitindo localizar o endereço de entrega no mapa e calcular automaticamente o valor da taxa de entrega com base na distância/perímetro, sem uso do Google Maps, aproveitando a Venda Balcão existente, que somente poderá ser finalizada após a confirmação da entrega pelo entregador.

1️⃣ Regra Principal de Venda (Delivery)

O delivery deve utilizar exclusivamente a Venda Balcão existente.

Ao marcar uma venda de balcão como Delivery:

A venda não deve ser finalizada imediatamente.

A venda de delivery somente poderá ser fechada quando:

O entregador retornar à loja, ou

O entregador confirmar a entrega no sistema.

Enquanto a entrega não for confirmada:

A venda deve permanecer em aberto

Deve aparecer em uma lista de Entregas em Andamento

Após a confirmação:

Finalizar a venda

Registrar data e hora da entrega

2️⃣ Tecnologias Utilizadas (100% Gratuitas)

OpenStreetMap → Mapa

Leaflet / React-Leaflet (web) ou react-native-maps com OSM (mobile)

Nominatim (OpenStreetMap) → Busca e geocodificação de endereços

Cálculo de distância por latitude/longitude (Haversine)

⚠️ Não utilizar Google Maps nem APIs pagas.

3️⃣ Configurações da Loja

Cadastrar nas configurações do sistema:

Endereço completo da loja

Latitude e longitude da loja (fixas)

Raio máximo de entrega (opcional)

Esses dados serão usados como ponto de origem para o cálculo do delivery.

4️⃣ Cadastro de Perímetros e Taxa de Entrega

Criar configuração de faixas de distância para cálculo automático da taxa:

Exemplo:

0 a 2 km → R$ 5,00

2 a 5 km → R$ 8,00

5 a 8 km → R$ 12,00

Fora do perímetro → não permitir delivery

As faixas devem ser configuráveis, sem necessidade de alterar código.

5️⃣ Tela de Venda Balcão (Delivery)

Na tela de Venda Balcão, ao marcar a opção Delivery:

Campo para digitar endereço do cliente

Buscar endereço via Nominatim

Exibir o endereço selecionado no mapa OpenStreetMap

Após selecionar o endereço:

Obter latitude e longitude do cliente

Calcular a distância até a loja

Identificar a faixa de perímetro

Definir automaticamente o valor da entrega

Exibir na tela:

Endereço de entrega

Distância calculada

Valor da taxa de entrega

Total da venda atualizado automaticamente

6️⃣ Cálculo da Distância

Utilizar cálculo de distância em linha reta (Haversine):

Origem: latitude/longitude da loja

Destino: latitude/longitude do cliente

Esse cálculo será usado exclusivamente para definir a taxa de entrega.

7️⃣ Regras de Negócio

O valor da entrega deve ser automático

Não permitir edição manual do frete

Caso o endereço esteja fora do perímetro:

Bloquear o delivery

Exibir mensagem informando que a região não é atendida

Validar a taxa também no backend

8️⃣ Backend

Criar/ajustar endpoints para:

Buscar configurações da loja

Buscar faixas de perímetro

Calcular distância (ou validar cálculo recebido do frontend)

Confirmar entrega pelo entregador

Finalizar venda somente após confirmação

9️⃣ Requisitos Gerais

Funcionar corretamente em telefone e desktop

Não quebrar funcionalidades existentes

Não criar novo tipo de venda

Apenas estender a Venda Balcão para suportar delivery

Implementação simples, gratuita e sustentável

🔧 Dependências Sugeridas
Mobile (React Native / Expo)

react-native-maps (configurado com OpenStreetMap)

Busca de endereço via Nominatim (HTTP)

Web

leaflet

react-leaflet