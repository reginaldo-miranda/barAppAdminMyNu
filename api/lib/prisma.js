import { PrismaClient } from "@prisma/client";
import dotenv from "dotenv";

dotenv.config();

// Seleciona a URL efetiva conforme DB_TARGET e variáveis do .env
function resolveDatabaseUrl(targetOverride) {
  const target = targetOverride || process.env.DB_TARGET || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? 'local' : 'railway');
  const localUrl = process.env.DATABASE_URL_LOCAL;
  const railwayUrl = process.env.DATABASE_URL_RAILWAY;

  if (target === 'local' && localUrl) return localUrl;
  if (target === 'railway' && railwayUrl) return railwayUrl;
  return process.env.DATABASE_URL; // fallback para variável padrão
}

const effectiveUrl = resolveDatabaseUrl();
if (effectiveUrl) {
  // Garante que Prisma use a URL efetiva
  process.env.DATABASE_URL = effectiveUrl;
}

// Exporta uma instância que pode ser reatribuída para permitir troca dinâmica
let prisma = new PrismaClient();

// Proxy para garantir que rotas sempre usem a instância atual de prisma
const prismaProxy = new Proxy({}, {
  get(_, prop) {
    const val = prisma[prop];
    if (typeof val === 'function') return val.bind(prisma);
    return val;
  }
});

export async function switchDbTarget(target) {
  const desired = target === 'local' ? 'local' : 'railway';
  const nextUrl = resolveDatabaseUrl(desired);
  if (!nextUrl) {
    throw new Error(`DATABASE_URL para alvo '${desired}' não encontrado (.env)`);
  }
  // Atualiza variáveis de ambiente
  process.env.DB_TARGET = desired;
  process.env.DATABASE_URL = nextUrl;

  // Desconecta cliente atual, se existir
  try { await prisma.$disconnect(); } catch {}

  // Recria cliente com nova URL
  prisma = new PrismaClient();
  await prisma.$connect();
  return { ok: true, target: desired, url: nextUrl };
}

export default prismaProxy;