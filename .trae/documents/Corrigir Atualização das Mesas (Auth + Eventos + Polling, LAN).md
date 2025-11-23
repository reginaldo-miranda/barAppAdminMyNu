## Problema Observado
- Chamadas repetidas a `GET /sale/list` e `GET /mesa/list`, mas a tela não muda quando adiciona item.
- Mensagens "Token ausente" em chamadas de API indicam que o backend rejeita requisições sem Authorization.
- WS/SSE/polling existem, porém sem dados atualizados se as chamadas falham por falta de token.

## Plano de Correção

### 1) Autenticação nas requisições
- Mobile: confirmar que o interceptor de `axios` injeta `Authorization: Bearer <token>` (já implementado em `mobile/src/services/api.js:154–157`).
- Desktop (`api/models/Mesa.js`): configurar o `api` para enviar token válido (via armazenamento local ou um pequeno login inicial) antes de chamar `/mesa/list` e ações de abrir/fechar. Sem isso, o backend retorna "Token ausente" e os dados não mudam.

### 2) Atualização em tempo real mais confiável
- Mobile Mesas (`mobile/app/(tabs)/mesas.tsx`): manter WS com reconexão e fallback SSE/polling (1–2s) e garantir que ao receber `sale:update`, chame `softRefreshMesas()` com token válido.
- Desktop Mesas (`api/models/Mesa.js`): adicionar SSE (`/api/sale/stream`) e polling de 2s, garantindo que `api` usa token para `/mesa/list`. Assim, a lista muda em até 2s.

### 3) Desempenho
- Debounce de refresh (~1.5s) para evitar múltiplas chamadas simultâneas.
- Polling incremental: usar `/api/sale/updates?since=...` para reduzir carga.

### 4) LAN-only
- Garantir que nenhuma URL usa `127.0.0.1/localhost`. Confirmar filtros ativos em `mobile/src/services/api.js` e iniciar Expo em LAN.

## Validação
- Login, abrir Mesas e adicionar item em venda de mesa a partir de outro dispositivo. Verificar que a lista muda em ≤2s.
- Testar em smartphone (Expo Go) e navegador do desktop.

## Entregável
- Mesas atualizando automaticamente (≤2s) com WS/SSE/polling, autenticação correta e sem 127.0.0.1, sem alterar fluxos já estáveis.

Posso aplicar essas correções e validar agora?