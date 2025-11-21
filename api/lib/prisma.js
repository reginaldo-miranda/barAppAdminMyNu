import dotenv from "dotenv";
dotenv.config();
import { PrismaClient } from "@prisma/client";

// Helper para construir URL do banco com base no alvo (local/railway)
const buildDatabaseUrl = (target) => {
  const envLocal = process.env.DATABASE_URL_LOCAL;
  const envRailway = process.env.DATABASE_URL_RAILWAY;
  const envDefault = process.env.DATABASE_URL;

  if (target === "local") {
    return envLocal || (envDefault && envDefault.includes("localhost") ? envDefault : envLocal) || envDefault;
  }
  if (target === "railway") {
    return envRailway || (envDefault && !envDefault.includes("localhost") ? envDefault : envRailway) || envDefault;
  }
  return envDefault || envLocal || envRailway;
};

// Determinar URLs e instanciar clientes dedicados
const urlLocal = buildDatabaseUrl("local");
const urlRailway = buildDatabaseUrl("railway");
const prismaLocal = new PrismaClient({ datasources: { db: { url: urlLocal } } });
const prismaRailway = new PrismaClient({ datasources: { db: { url: urlRailway } } });

let prisma = (process.env.DB_TARGET === "railway" ? prismaRailway : prismaLocal);

// Exporta função para alternar dinamicamente o alvo do banco
export const switchDbTarget = async (target) => {
  try {
    const nextTarget = target === "railway" ? "railway" : "local";
    prisma = nextTarget === "railway" ? prismaRailway : prismaLocal;
    process.env.DB_TARGET = nextTarget;
    await prisma.$connect().catch(() => {});
    return { ok: true, target: nextTarget };
  } catch (err) {
    console.error("Erro ao alternar DB_TARGET (Prisma):", err);
    return { ok: false, error: "Falha ao alternar DB_TARGET" };
  }
};

export const getCurrentDbInfo = () => {
  try {
    const urlStr = (process.env.DB_TARGET === "railway" ? urlRailway : urlLocal) || "";
    const u = new URL(urlStr);
    const provider = (u.protocol || "").replace(":", "") || "unknown";
    const host = u.hostname || "";
    const port = u.port || "";
    const database = (u.pathname || "").replace(/^\//, "") || "";
    const info = { provider, host };
    if (port) info.port = port;
    if (database) info.database = database;
    return info;
  } catch {
    return { provider: "unknown" };
  }
};

export const getProductsForTarget = async (target) => {
  const nextTarget = target === "local" ? "local" : target === "railway" ? "railway" : initialTarget;
  const nextUrl = buildDatabaseUrl(nextTarget);
  const client = new PrismaClient({ datasources: { db: { url: nextUrl } } });
  try {
    const prods = await client.product.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { id: "asc" }, take: 50 });
    return prods;
  } finally {
    await client.$disconnect().catch(() => {});
  }
};

export default prisma;
export const getPrisma = () => prisma;
export const getActivePrisma = () => (process.env.DB_TARGET === "railway" ? prismaRailway : prismaLocal);

// Schema helpers (MySQL)
export const getColumnsForTarget = async (target, table) => {
  const client = target === "railway" ? prismaRailway : prismaLocal;
  try {
    const rows = await client.$queryRawUnsafe(`SHOW COLUMNS FROM \`${table}\``);
    return rows.map(r => ({
      field: r.Field || r.field || r.COLUMN_NAME,
      type: r.Type || r.type || r.COLUMN_TYPE,
      nullable: (r.Null || r.IS_NULLABLE || '').toString().toUpperCase() === 'YES',
      key: r.Key || r.COLUMN_KEY || '',
      default: r.Default ?? r.COLUMN_DEFAULT ?? null,
      extra: r.Extra || r.EXTRA || ''
    }));
  } catch (e) {
    return [];
  }
};

export const getSchemaSummaryForTarget = async (target) => {
  const tables = [
    'Product', 'categoria', 'tipo', 'productGroup', 'unidadeMedida'
  ];
  const summary = {};
  for (const t of tables) {
    summary[t] = await getColumnsForTarget(target, t);
  }
  return summary;
};