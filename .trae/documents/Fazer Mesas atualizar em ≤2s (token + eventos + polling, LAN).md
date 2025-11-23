## Diagnóstico
- Os logs mostram chamadas a `GET /sale/list` e `GET /mesa/list`, mas a tela não muda ao adicionar item. Isso acontece quando o backend retorna erro de autenticação ("Token ausente"), ou quando o refresh não incorpora o evento da venda específica.
- Em desktop (`api/models/Mesa.js`) as chamadas não estão autenticadas; em mobile, o interceptor injeta token, mas o refresh só chama `/mesa/list` (pode não refletir imediatamente a venda específica).
- WebSocket/SSE/polling existem, porém é necessário garantir token e atualizar de forma dirigida.

## Ajustes Propostos (sem quebrar nada e sem usar 127.0.0.1)

### Backend (sem mudanças disruptivas)
- Validar que os eventos `sale:update` são emitidos nas operações de itens: já ocorre em `api/routes/sale.js` (add/remove/update). Manter `GET /api/sale/updates` e `/api/sale/stream`.
- Garantir WS ativo (pacote `ws` já presente) e escutando em `0.0.0.0:4001`.

### Mobile – Tela de Mesas
- Autenticação: confirmar que o usuário está logado antes de abrir Mesas; o interceptor (`mobile/src/services/api.js:154–157`) injeta o token.
- Atualização dirigida no handler de eventos:
  - Ao receber `sale:update`, buscar a venda `saleService.getById(id)` (com token) e atualizar somente a mesa ligada a `venda.mesaId` no estado, evitando depender apenas de `/mesa/list`.
  - Manter `softRefreshMesas()` como fallback.
- Polling incremental (1s): usar `saleService.updates(since)` para reduzir carga e garantir ≤2s.
- Debounce (`~1.5s`) para evitar excesso de chamadas e manter desempenho.

### Desktop – Mesas (`api/models/Mesa.js`)
- Corrigir endpoints:
  - `/mesa/list`, `/mesa/:id/abrir`, `/mesa/:id/fechar`.
- Autenticação do `api`:
  - Configurar `Authorization: Bearer <token>` (obtido via login simples ou de storage) para todas as chamadas.
- SSE + Polling:
  - Adicionar `EventSource('/api/sale/stream')` ouvindo `sale:update` e chamar `loadMesas()` com token.
  - Fallback de polling `setInterval(loadMesas, 2000)` com token.

### LAN-only
- Expo Go iniciado com `--host lan`; QR precisa mostrar `exp+mobile://192.168.x.x:8082`.
- O código já bloqueia `127.0.0.1/localhost/::1/0.0.0.0` em API/WS.

## Testes de Aceitação
- Logar, abrir Mesas (mobile), adicionar item em venda de mesa (desktop ou outro telefone): lista atualiza em ≤2s.
- Repetir no navegador (desktop) com token: a lista atualiza via SSE/polling.
- Simular queda de WS: polling de 1–2s garante atualização; reconexão com backoff.

## Entrega
- Mesas atualizam em ≤2s, sem alterar o que já funciona, sem usar 127.0.0.1, com tratamento de erros de conexão.

Posso aplicar e validar agora?