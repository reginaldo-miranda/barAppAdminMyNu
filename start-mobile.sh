#!/bin/bash

echo "📱 Iniciando Aplicativo Mobile..."
cd /Users/reginaldomiranda/Documents/barAppAdminMyNu/mobile || { echo "❌ Não foi possível acessar a pasta mobile"; exit 1; }

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Função utilitária: encerrar processos por porta
kill_by_port() {
  local PORT_TO_KILL="$1"
  local PIDS=$(lsof -tiTCP:"$PORT_TO_KILL")
  if [ -n "$PIDS" ]; then
    echo "🧹 Encerrando processos na porta $PORT_TO_KILL: $PIDS"
    kill -9 $PIDS 2>/dev/null
  fi
}

# Detectar IP da LAN automaticamente no macOS (fallback para valor definido)
DETECTED_IP=$(ipconfig getifaddr en0 2>/dev/null)
if [ -z "$DETECTED_IP" ]; then
  DETECTED_IP=$(ipconfig getifaddr en1 2>/dev/null)
fi
LAN_IP=${REACT_NATIVE_PACKAGER_HOSTNAME:-$DETECTED_IP}
if [ -z "$LAN_IP" ]; then
  LAN_IP=192.168.0.176
fi

# Configurar IP da LAN e URL da API (evitar localhost/127.0.0.1)
export REACT_NATIVE_PACKAGER_HOSTNAME="$LAN_IP"
export EXPO_PUBLIC_API_URL="http://${LAN_IP}:4000/api"
# URL pública da API em ambiente Railway/LocalTunnel (permite override por RAILWAY_PUBLIC_API_URL)
export EXPO_PUBLIC_API_URL_RAILWAY="${RAILWAY_PUBLIC_API_URL:-https://small-trees-rescue.loca.lt/api}"

echo "🔗 REACT_NATIVE_PACKAGER_HOSTNAME=${REACT_NATIVE_PACKAGER_HOSTNAME}"
echo "🔗 EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"
echo "🔗 EXPO_PUBLIC_API_URL_RAILWAY=${EXPO_PUBLIC_API_URL_RAILWAY}"

# Verificar saúde da API e iniciar automaticamente se necessário
API_HEALTH_URL="http://${LAN_IP}:4000/api/health"
echo "🩺 Verificando saúde da API em ${API_HEALTH_URL}..."
STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH_URL")
if [ "$STATUS_CODE" != "200" ]; then
  echo "🚀 API não está ativa. Iniciando automaticamente..."
  cd /Users/reginaldomiranda/Documents/barAppAdminMyNu || { echo "❌ Não foi possível voltar à raiz"; exit 1; }
  # Garantir permissão de execução
  chmod +x ./start-api.sh 2>/dev/null || true
  # Forçar alvo do banco como Local por padrão (ignora DB_TARGET pré-existente)
  TARGET="${API_DB_TARGET:-local}"
  echo "🔧 Iniciando API com DB_TARGET=${TARGET}..."
  # Iniciar API com alvo selecionado em background (detached)
  nohup bash -lc "bash ./start-api.sh ${TARGET}" >/tmp/barapp-api.log 2>&1 &
  API_PID=$!
  echo "🔧 API iniciada em background (PID=${API_PID}) com DB_TARGET=${TARGET}. Aguardando ficar saudável..."
  # Aguardar até 30s pela saúde da API
  ATTEMPTS=0
  until [ $ATTEMPTS -ge 30 ]
  do
    STATUS_CODE=$(curl -s -o /dev/null -w "%{http_code}" "$API_HEALTH_URL")
    if [ "$STATUS_CODE" = "200" ]; then
      echo "✅ API saudável (HTTP 200)."
      break
    fi
    ATTEMPTS=$((ATTEMPTS+1))
    sleep 1
  done
  if [ "$STATUS_CODE" != "200" ]; then
    echo "❌ API não ficou saudável após aguardar. Veja logs em /tmp/barapp-api.log"
  fi
  # Voltar para pasta mobile para iniciar Expo
  cd /Users/reginaldomiranda/Documents/barAppAdminMyNu/mobile || { echo "❌ Não foi possível voltar para mobile"; exit 1; }
fi

# Garantir porta livre antes de iniciar o Expo
kill_by_port 8082

# Iniciar Expo em modo LAN (-c limpa cache) na porta 8082
echo "🔧 Iniciando Expo em modo LAN na porta 8082 com cache limpo..."
npx expo start --host lan --port 8082 -c

