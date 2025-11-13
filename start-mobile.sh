#!/bin/bash

echo "📱 Iniciando Aplicativo Mobile..."
cd /Users/reginaldomiranda/Documents/barAppAdmin/mobile

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

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
echo "🔗 REACT_NATIVE_PACKAGER_HOSTNAME=${REACT_NATIVE_PACKAGER_HOSTNAME}"
echo "🔗 EXPO_PUBLIC_API_URL=${EXPO_PUBLIC_API_URL}"

# Iniciar Expo em modo LAN (-c limpa cache) na porta 8082
# Nota: 'network' não é aceito pelo CLI atual; 'lan' cumpre o mesmo objetivo
echo "🔧 Iniciando Expo em modo LAN na porta 8082 com cache limpo..."
npx expo start --host lan --port 8082 -c

