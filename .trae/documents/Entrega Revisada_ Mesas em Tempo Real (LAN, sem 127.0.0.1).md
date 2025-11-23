## Objetivo
Garantir atualização automática da tela de Mesas em até 2 segundos após adicionar produto em venda de mesa, funcionando em mobile (Expo Go) e desktop, sem tocar no que já funciona e sem usar 127.0.0.1.

## Diagnóstico do que pode estar falhando
- WebSocket desativado ou não acessível na LAN (pacote `ws` ausente ou firewall).
- App não iniciado em LAN (QR do Metro mostra `exp://127.0.0.1`).
- Cliente Mesas não escutando `sale:update` de forma consistente ou sem fallback.
- SSE no desktop sem escuta ou bloqueado; falta polling incremental.

## Plano de Correções (precisas e limitadas)

### 1) Servidor de tempo real
- Validar WS ativo e acessível em LAN:
  - `api/server.js:221–239` mantém WebSocket em `ws://0.0.0.0:4001`; confirmar pacote `ws` instalado e porta aberta.
- Validar SSE e endpoint de updates:
  - SSE: `api/server.js:158–179` (stream `/api/sale/stream` já envia `sale:update`).
  - Polling incremental: `api/server.js:148–156` (`GET /api/sale/updates?since=...`).
- Eventos de venda ao alterar itens:
  - Adicionar item: `api/routes/sale.js:394–462` chama `recordSaleUpdate`.
  - Remover: `api/routes/sale.js:464–509`; Alterar quantidade: `api/routes/sale.js:511–565`.

### 2) Mobile – Tela de Mesas
- WS robusto com reconexão/backoff e debounce (~1.5s) e fallback para SSE/polling:
  - Conector: `mobile/app/(tabs)/mesas.tsx:203–219`.
  - Polling incremental (1s): `mobile/app/(tabs)/mesas.tsx:221–234` via `saleService.updates(since)`.
  - Refresh leve: `softRefreshMesas()` em `mobile/app/(tabs)/mesas.tsx:180–186`.
- LAN-only (sem 127.0.0.1): filtros já ativos em `mobile/src/services/api.js:9, 38–44, 483–519`.

### 3) Desktop – Mesas
- Alinhar rotas REST e escuta de eventos:
  - Corrigir endpoints: `api/models/Mesa.js:104` (`/mesa/list`), `124` (`/mesa/:id/abrir`), `141` (`/mesa/:id/fechar`).
  - Adicionar SSE + polling (2s): bloco após `useEffect` inicial (aprox. `api/models/Mesa.js:118–141`).

### 4) Garantia de LAN
- Iniciar Metro em LAN (QR sempre `exp://192.168.x.x`): `npx expo start --host lan` em `mobile`.
- Evitar localhost em tudo: `mobile/src/services/api.js` já bloqueia `localhost/127.0.0.1/::1/0.0.0.0`.

## Testes e Validação
- Backend: subir API e validar saúde `GET /api/health` na LAN.
- Mobile: abrir Mesas no Expo Go (LAN). Em outro dispositivo, adicionar item na venda de mesa; verificar atualização automática (≤2s).
- Desktop: com `api/models/Mesa.js` aberto, observar lista atualizar via SSE/polling.
- Simular queda de WS: verificar fallback de polling (2s) e reconexão com backoff.

## Entregáveis
- Mesas atualizando em ≤2s no mobile e desktop.
- Sem alterar fluxos existentes (somente escutas e refresh leve).
- Sem uso de 127.0.0.1 — somente IP da LAN.
- Tratamento de erros de conexão (reconexão + polling de segurança).

Confirma que posso aplicar e validar estes pontos agora?