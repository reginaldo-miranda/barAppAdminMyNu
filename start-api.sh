#!/bin/bash

echo "🚀 Iniciando API do Sistema Bar..."
cd /Users/reginaldomiranda/Documents/barAppAdmin/api

# Verificar se .env existe
if [ ! -f .env ]; then
    echo "📋 Criando arquivo .env..."
    cp env_exemplo .env
    # Garantir porta 4000
    if grep -q "^PORT=" .env; then
      sed -i '' 's/^PORT=.*/PORT=4000/' .env
    else
      echo "PORT=4000" >> .env
    fi
fi

# Garantir host 0.0.0.0 para acessos externos
if ! grep -q "^HOST=" .env; then
  echo "HOST=0.0.0.0" >> .env
fi

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
    echo "📦 Instalando dependências..."
    npm install
fi

# Dica de URL pública
PUBLIC_TUNNEL_URL="https://small-trees-rescue.loca.lt/api"
echo "🔗 URL pública esperada: ${PUBLIC_TUNNEL_URL}"

# Iniciar LocalTunnel em background para expor a API
if command -v npx >/dev/null 2>&1; then
  echo "🌐 Iniciando LocalTunnel em background..."
  (npx localtunnel --port 4000 --subdomain small-trees-rescue >/dev/null 2>&1 &)
fi

# Iniciar servidor somente se a porta não estiver em uso
if lsof -nP -iTCP:4000 | grep LISTEN >/dev/null; then
  echo "✅ API já está rodando na porta 4000. Pulando start."
else
  echo "🔧 Iniciando servidor na porta 4000 (0.0.0.0)..."
  npm start
fi

