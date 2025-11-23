## Problema

* Chamadas repetidas a `/mesa/list` e `/sale/list`, mas sem mudança visual ao adicionar itens.

* Logs de “status=N/A” e mensagens de “Token ausente” indicam requisições sem Authorization.

* Polling de `/sale/updates` em 1s está tentando repetidamente sem aplicar mudanças ao estado.

## Correções Propostas (sem quebrar o que funciona, só melhorar)

### 1) Guard de Autenticação

* Mobile `mobile/app/(tabs)/mesas.tsx`:

  * Não iniciar WS/SSE/polling nem chamar `loadMesas()` até `isAuthenticated === true`.

  * Se receber 401/“Token ausente”, pausar polling por 5s e tentar novamente (circuit breaker simples), sem travar a UI.

### 2) Atualização Dirigida da Mesa

* No handler de `sale:update`:

  * Buscar a venda pelo ID (`saleService.getById(id)`), com token.

  * Atualizar somente a mesa `mesaId` no estado (`status='ocupada'` se `aberta`; `status='livre'` caso contrário).

  * Se não houver `mesaId` ou ocorrer erro, usar fallback `softRefreshMesas()` com debounce (\~1.5s).

### 3) Polling Inteligente com Backoff

* Reduzir polling de `/sale/updates` para 2s e aplicar backoff quando consecutivos erros ocorrerem (ex.: 2s → 4s → 8s, máx 8s).

* Só chamar `/mesa/list` quando `updates.length > 0` ou a cada 10–15s para consistência, com debounce (\~1.5s).

### 4) Desktop `api/models/Mesa.js`

* Garantir `Authorization: Bearer <token>` em `/mesa/list`, `/mesa/:id/abrir` e `/mesa/:id/fechar` (já alinhado).

* Adicionar SSE `/api/sale/stream` e polling de 2s com debounce; usar token em `loadMesas()`.

### 5) LAN-only

* Expo com `--host lan`, QR `exp+mobile://192.168.x.x:8082`.

* Confirmar filtros para bloquear `127.0.0.1/localhost/::1/0.0.0.0` em API/WS (já implementados).

## Testes de Aceitação

* Mobile: abrir Mesas e adicionar item numa venda de mesa em outro dispositivo; lista muda em ≤2s.

* Desktop: com token, observar atualização em ≤2s via SSE/polling.

* Erros de conexão: polling com backoff e reconexão de WS.

Posso aplicar essas mudanças e validar agora?sim

parou de fazer porque ?

