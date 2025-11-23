## Problema
- A tela chama `/mesa/list` e `/sale/list` repetidamente, mas não muda ao adicionar item.
- O backend exige token — respostas "Token ausente" indicam que sem `Authorization` o refresh não aplica.
- WS/SSE/polling estão chamando refresh, porém a atualização não é dirigida ao estado da mesa; o resultado: re-render sem alterações.

## Correções Propostas (sem quebrar o que funciona)

### 1) Atualização dirigida no cliente
- Mobile `mobile/app/(tabs)/mesas.tsx`:
  - No handler de `sale:update`, buscar a venda (`saleService.getById(id)`) e aplicar ao estado:
    - Se `sale.status === 'aberta'`, marcar a mesa `sale.mesaId` como `ocupada` e, opcionalmente, atualizar campos exibidos (ex.: totais/itens, se estiverem no card).
    - Se `sale.status !== 'aberta'`, marcar mesa como `livre` e limpar venda associada.
  - Manter `softRefreshMesas()` como fallback quando não houver `mesaId` ou em caso de erro.
- Desktop `api/models/Mesa.js`:
  - Adicionar SSE `/api/sale/stream` e, ao receber `sale:update`, chamar `loadMesas()` com token.

### 2) Autenticação
- Garantir que todas as chamadas tenham `Authorization: Bearer <token>`:
  - Mobile já injeta token no interceptor (`mobile/src/services/api.js`). Validar login antes de iniciar WS/polling.
  - Desktop `api/models/Mesa.js`: configurar `api` para incluir token (ex.: obtido via login inicial ou storage) em cada chamada (`/mesa/list`, abrir/fechar).

### 3) Desempenho
- Reduzir polling de listas para um ciclo seguro: usar `/sale/updates?since=...` a cada 1s e só invocar `/mesa/list` quando necessário (ex.: mismatch ou a cada 10–15s).
- Debounce de refresh (~1.5s) para evitar chamadas em cascata.

### 4) LAN-only
- Expo Go em LAN (`--host lan`), QR `exp+mobile://192.168.x.x:8082`.
- Os filtros já bloqueiam `127.0.0.1/localhost`; manter apenas IP da LAN em WS/API.

## Testes de Aceitação
- Login → abrir Mesas no telefone → adicionar item em uma venda de mesa a partir de outro dispositivo.
- A lista muda em ≤2s (via state dirigido / fallback SSE/polling) em mobile e desktop.
- Simular queda de WS: polling aplica atualização; reconexão com backoff.

## Entregável
- Mesas atualizam automaticamente em ≤2s, sem alterar fluxos existentes, com token e sem usar 127.0.0.1.

Posso aplicar essas mudanças e validar agora?