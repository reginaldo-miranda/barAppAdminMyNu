#!/bin/bash

echo "🚀 Iniciando API do Sistema Bar..."
API_DIR="/Users/reginaldomiranda/Documents/barAppAdminMyNu/api"
cd "$API_DIR" || { echo "❌ Não foi possível acessar $API_DIR"; exit 1; }

# Verificar se .env existe
if [ ! -f .env ]; then
  echo "📋 Criando arquivo .env..."
  cp env_exemplo .env
fi

# Garantir porta 4000 e host 0.0.0.0
if grep -q "^PORT=" .env; then
  sed -i '' 's/^PORT=.*/PORT=4000/' .env
else
  echo "PORT=4000" >> .env
fi
if ! grep -q "^HOST=" .env; then
  echo "HOST=0.0.0.0" >> .env
fi

# Exportar variáveis do .env
set -a
source .env
set +a

# Seleção de banco de dados (argumento, variável ou prompt)
if [ -n "$1" ]; then
  DB_TARGET="$1"
fi
if [ -z "$DB_TARGET" ]; then
  echo ""
  echo "📊 Selecione o banco de dados:"
  echo "  1) Local"
  echo "  2) Railway"
  read -p "👉 Escolha [1/2] (padrão: 2): " choice
  case "$choice" in
    1) DB_TARGET="local" ;;
    2|"" ) DB_TARGET="railway" ;;
    *) DB_TARGET="railway" ;;
  esac
fi

# Garantir variáveis de conexão
if ! grep -q "^DATABASE_URL_LOCAL=" .env; then
  echo "DATABASE_URL_LOCAL=\"mysql://root:saguides%40123@localhost:3306/appBar\"" >> .env
fi
if ! grep -q "^DATABASE_URL_RAILWAY=" .env; then
  # Se já existir DATABASE_URL em .env, use como Railway
  if grep -q "^DATABASE_URL=" .env; then
    RAIL=$(grep "^DATABASE_URL=" .env | sed 's/^DATABASE_URL=//')
    echo "DATABASE_URL_RAILWAY=${RAIL}" >> .env
  else
    echo "DATABASE_URL_RAILWAY=\"mysql://root:EcNHsXSBfTPvATYnaVMSGHKIOjDMZnZx@shuttle.proxy.rlwy.net:17474/railway\"" >> .env
  fi
fi

# Recarregar variáveis
set -a
source .env
set +a

# Definir DATABASE_URL conforme alvo
case "$DB_TARGET" in
  local)
    export DATABASE_URL="$DATABASE_URL_LOCAL"
    ;;
  railway)
    export DATABASE_URL="$DATABASE_URL_RAILWAY"
    ;;
  *)
    echo "⚠️ Alvo desconhecido: $DB_TARGET. Usando 'railway'."
    export DATABASE_URL="$DATABASE_URL_RAILWAY"
    DB_TARGET="railway"
    ;;
esac
export DB_TARGET

# Funções utilitárias para garantir reinício limpo
kill_by_port() {
  PORT_TO_KILL="$1"
  PIDS=$(lsof -tiTCP:"$PORT_TO_KILL")
  if [ -n "$PIDS" ]; then
    echo "🧹 Encerrando processos na porta $PORT_TO_KILL: $PIDS"
    kill -9 $PIDS 2>/dev/null
  fi
}

stop_localtunnel() {
  LT_PIDS=$(pgrep -f "localtunnel")
  if [ -n "$LT_PIDS" ]; then
    echo "🧹 Encerrando LocalTunnel: $LT_PIDS"
    kill -9 $LT_PIDS 2>/dev/null
  fi
}

# Instalar dependências se necessário
if [ ! -d "node_modules" ]; then
  echo "📦 Instalando dependências..."
  npm install
fi

# Aplicar migrations e regenerar Prisma Client
echo "🧩 Aplicando migrations do Prisma..."
npm run prisma:migrate

echo "🧹 Limpando cache do Prisma e regenerando client..."
rm -rf node_modules/.prisma >/dev/null 2>&1
npm run prisma:generate

# Dica de URL pública (evitar localhost)
PUBLIC_TUNNEL_URL="https://small-trees-rescue.loca.lt/api"
echo "🔗 URL pública esperada: ${PUBLIC_TUNNEL_URL}"

# Garantir que não há LocalTunnel prévio e iniciar novamente
stop_localtunnel
if command -v npx >/dev/null 2>&1; then
  echo "🌐 Iniciando LocalTunnel em background..."
  (npx localtunnel --port 4000 --subdomain small-trees-rescue >/dev/null 2>&1 &)
fi

# Garantir porta livre e iniciar servidor
kill_by_port 4000
echo "🔧 Iniciando servidor na porta 4000 (0.0.0.0) usando DB_TARGET=$DB_TARGET..."
npm start

