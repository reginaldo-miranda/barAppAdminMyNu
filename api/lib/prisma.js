import dotenv from "dotenv";
dotenv.config();
import pkg from "@prisma/client";
const { PrismaClient } = pkg;

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

const urlLocal = buildDatabaseUrl("local");
const urlRailway = buildDatabaseUrl("railway");
const prismaLocal = new PrismaClient({ datasources: { db: { url: urlLocal } } });
const prismaRailway = new PrismaClient({ datasources: { db: { url: urlRailway } } });

const initialTarget = ((process.env.DB_TARGET || '').toLowerCase() === 'railway' && urlRailway) ? 'railway' : 'local';
let prisma = initialTarget === 'railway' ? prismaRailway : prismaLocal;
process.env.DB_TARGET = initialTarget;
process.env.DATABASE_URL = initialTarget === 'railway' ? urlRailway : urlLocal;

// Alternar dinamicamente o alvo do banco (local/railway)
export const switchDbTarget = async (next) => {
  try {
    const target = String(next || '').toLowerCase() === 'railway' && urlRailway ? 'railway' : 'local';
    await prisma.$disconnect().catch(() => {});
    prisma = target === 'railway' ? prismaRailway : prismaLocal;
    process.env.DB_TARGET = target;
    process.env.DATABASE_URL = target === 'railway' ? urlRailway : urlLocal;
    await prisma.$connect();
    return { ok: true, target };
  } catch (err) {
    return { ok: false };
  }
};

export const getCurrentDbInfo = () => {
  try {
    // Usar base local por padrão
    const urlStr = process.env.DATABASE_URL || urlLocal || "";
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
  const t = String(target || '').toLowerCase();
  const client = t === 'railway' ? prismaRailway : prismaLocal;
  const prods = await client.product.findMany({ where: { ativo: true }, select: { id: true, nome: true }, orderBy: { id: "asc" }, take: 50 });
  return prods;
};

export default prisma;
export const getPrisma = () => prisma;
export const getActivePrisma = () => prisma;

// Schema helpers (MySQL)
export const getColumnsForTarget = async (target, table) => {
  const t = String(target || '').toLowerCase();
  const client = t === 'railway' ? prismaRailway : prismaLocal;
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