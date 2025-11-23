## Objetivo

Garantir atualização automática (≤2s) da tela de Mesas logo após adicionar produto em uma venda de mesa, funcionando em mobile (Expo Go) e desktop, sem alterar fluxos já estáveis e sem usar 127.0.0.1.

## Estado Atual e Lacunas

* Backend já emite eventos de venda (`sale:update`) ao adicionar/remover/alterar itens: `api/routes/sale.js` (ex.: 394–462, 464–509, 511–565) e registra em `api/lib/events.js`.

* Servidor cria WebSocket em `api/server.js:221–239`, mas pode estar desativado se pacote `ws` não estiver disponível.

* Mobile Mesas possui WS básico e polling em 5s. É necessário reforçar: reconexão, fallback para SSE no web e polling de 1–2s com `GET /sale/updates?since=...`.

* Desktop (arquivo `api/models/Mesa.js`) consome `/mesa/list`, sem escuta de eventos; precisa receber SSE e polling leve.

* Regras LAN: bloquear completamente `127.0.0.1/localhost` em URLs de WS/API.

## Regras e Restrições

* Não alterar regras de negócio (validações de venda/mesa/produto continuam no servidor).

* Não quebrar funcionalidades de Mesas (apenas adicionar escuta/refresh leve).

* Nunca usar `127.0.0.1` (apenas IP da rede `192.168.x.x` ou similar).

## Mudanças no Servidor (não disruptivas)

1. Garantir WebSocket ativo:

   * Confirmar dependência `ws` instalada (já consta em `api/package.json`).

   * Manter instância em `api/server.js:221–239` escutando em `ws://0.0.0.0:4001`.
2. SSE de venda:

   * Manter/validar endpoint `/api/sale/stream`: `api/server.js:158–179` (clientes SSE recebem `sale:update`).
3. Endpoint incremental de atualizações:

   * Validar `/api/sale/updates?since=...`: `api/server.js:148–156` (para polling inteligente).

## Mudanças no Mobile (Tela Mesas)

1. Conector robusto de WS:

   * Em `mobile/app/(tabs)/mesas.tsx:203–219`, abrir WS pelo `getWsUrl()` e implementar reconexão com backoff (1s→2s→4s→8s), escutando `sale:update` e disparando `softRefreshMesas()`.
2. Fallback SSE (web) e Polling Inteligente:

   * SSE: usar `EventSource` em `/sale/stream` quando for web.

   * Polling incremental: `saleService.updates(since)` a cada 1s (novo efeito em `mesas.tsx`) para garantir ≤2s.
3. Anti-spam/Desempenho:

   * Debounce de `softRefreshMesas()` (\~1.5s) para evitar excesso de chamadas.
4. LAN-only:

   * Garantir `getWsUrl()` e base da API nunca retornem hosts locais (já há filtros em `mobile/src/services/api.js`).

## Mudanças no Desktop (Tela Mesas)

1. Alinhar rotas REST:

   * Corrigir endpoints para `/mesa/list`, `/mesa/:id/abrir`, `/mesa/:id/fechar`: `api/models/Mesa.js:104, 124, 141`.
2. SSE + Polling:

   * Adicionar `EventSource('/api/sale/stream')` e, como fallback, `setInterval(loadMesas, 2000)` para refresh leve.
3. Manter UI e lógica intactas: apenas refresh automático, sem alterar formulários/botões.

## Tratamento de Erros

* WS/SSE: reconectar com backoff, e ativar polling enquanto reconecta.

* API indispon

