## Objetivo
Garantir que a tela de Mesas atualize automaticamente em até 2 segundos após adicionar um item em venda de mesa, funcionando em mobile e desktop, sem usar 127.0.0.1 e sem quebrar funcionalidades existentes.

## Mudanças no Backend (somente validação)
- Confirmar eventos de venda emitidos: `api/routes/sale.js` já chama `recordSaleUpdate` em add/remove/update item.
- Confirmar endpoints de tempo real:
  - `GET /api/sale/updates?since=...` (polling incremental).
  - `GET /api/sale/stream` (SSE para web).
  - WebSocket ativo em `api/server.js:221–239` (porta `ws://0.0.0.0:4001`).

## Mobile – Mesas (atualização dirigida)
1. No handler de `sale:update`, buscar a venda (`saleService.getById(id)`) com token e aplicar ao estado:
   - Se `sale.status === 'aberta'`: marcar a mesa `sale.mesaId` como `ocupada` (e atualizar campos apresentados se necessário).
   - Se `sale.status !== 'aberta'`: marcar a mesa como `livre`.
2. Manter fallback `softRefreshMesas()` apenas quando necessário (erro ou `mesaId` ausente), evitando múltiplos `GET /mesa/list` em cascata.
3. Manter WS com reconexão e backoff; ativar polling incremental (`saleService.updates(since)`) a cada 1s com debounce (~1.5s).
4. Garantir auth: interceptor já injeta `Authorization: Bearer <token>` (`mobile/src/services/api.js`); validar login antes de iniciar WS/polling.

## Desktop – Mesas (auth + SSE/polling)
1. Alinhar rotas REST: `/mesa/list`, `/mesa/:id/abrir`, `/mesa/:id/fechar` (já corrigidas).
2. Configurar `api` para incluir `Authorization: Bearer <token>` em todas as chamadas (login simples ou leitura do storage).
3. Adicionar SSE `EventSource('/api/sale/stream')` e, ao receber `sale:update`, chamar `loadMesas()` com token; fallback polling `setInterval(loadMesas, 2000)` com debounce.

## LAN-only
- Iniciar Expo com `npx expo start --host lan` e garantir QR `exp+mobile://192.168.x.x:8082`.
- O código já bloqueia `127.0.0.1/localhost/::1/0.0.0.0` em API e WS.

## Testes de Aceitação
- Mobile: abrir Mesas; em outro dispositivo, adicionar item em venda de mesa; a lista muda em ≤2s.
- Desktop: com token, observar atualização via SSE/polling em ≤2s.
- Simular queda de WS: polling incremental garante atualização e reconexão.

## Entregáveis
- Mesas atualizando em ≤2s com atualização dirigida (state), auth correto e sem 127.0.0.1, mantendo desempenho e funcionalidades existentes.