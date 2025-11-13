#!/bin/bash

echo "🎯 Iniciando Sistema Completo do Bar..."
echo "=================================="

# Função para matar processos existentes
cleanup() {
    echo "🛑 Parando todos os processos..."
    pkill -f "node server.js" 2>/dev/null
    pkill -f "expo start" 2>/dev/null
    exit 0
}

# Capturar Ctrl+C
trap cleanup SIGINT

echo "1️⃣ Iniciando API..."
gnome-terminal -- bash -c "cd /Users/reginaldomiranda/Documents/barAppAdmin && ./start-api.sh; exec bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd /Users/reginaldomiranda/Documents/barAppAdmin && ./start-api.sh"' 2>/dev/null || \
echo "⚠️  Abra um novo terminal e execute: ./start-api.sh"

sleep 5

echo "2️⃣ Iniciando Mobile App..."
gnome-terminal -- bash -c "cd /Users/reginaldomiranda/Documents/barAppAdmin && ./start-mobile.sh; exec bash" 2>/dev/null || \
osascript -e 'tell app "Terminal" to do script "cd /Users/reginaldomiranda/Documents/barAppAdmin && ./start-mobile.sh"' 2>/dev/null || \
echo "⚠️  Abra um novo terminal e execute: ./start-mobile.sh"

echo ""
echo "✅ Sistemas iniciados!"
echo "📊 API: http://localhost:4000"
echo "📱 Mobile: http://localhost:8081"
echo ""
echo "Pressione Ctrl+C para parar todos os sistemas"
echo "=================================="

# Manter o script rodando
while true; do
    sleep 1
done

