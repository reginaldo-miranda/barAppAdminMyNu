// primeiro server funcionando

/*import express from "express";
import cors from "cors";

const app = express();
app.use(cors());
app.use(express.json());

// Rota raiz
app.get("/", (req, res) => {
  res.send("Servidor Express está rodando 🚀");
});

// Rota de teste
app.get("/api/hello", (req, res) => {
  res.json({ message: "API funcionando 🚀" });
});


const PORT = 4000; // usei 4000 só pra garantir que não tem conflito
app.listen(PORT, () => {
  console.log(`✅ API rodando em: http://localhost:${PORT}`);
});
*/

import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import jwt from "jsonwebtoken";
import authRoutes from "./routes/auth.js";
import customerRoutes from "./routes/customer.js";
import productRoutes from "./routes/product.js";
import productGroupRoutes from "./routes/productGroup.js";
import employeeRoutes from "./routes/employee.js";
import saleRoutes from "./routes/sale.js";
import mesaRoutes from "./routes/mesa.js";
import userRoutes from "./routes/user.js";
import tipoRoutes from "./routes/tipo.js";
import unidadeMedidaRoutes from "./routes/unidadeMedida.js";
import categoriaRoutes from "./routes/categoria.js";
import caixaRoutes from "./routes/caixa.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

// Rota de saúde pública para teste de conexão
app.get('/api/health', (req, res) => {
  // Determina alvo do banco (local vs railway) com base nas variáveis atuais
  const dbTarget = process.env.DB_TARGET || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? 'local' : 'railway');

  // Extrai informações seguras do DATABASE_URL sem expor credenciais
  const getDbInfo = () => {
    try {
      const urlStr = process.env.DATABASE_URL || '';
      const u = new URL(urlStr);
      const provider = (u.protocol || '').replace(':', '') || 'unknown';
      const host = u.hostname || '';
      const port = u.port || '';
      const database = (u.pathname || '').replace(/^\//, '') || '';
      const info = { provider, host };
      if (port) info.port = port;
      if (database) info.database = database;
      return info;
    } catch {
      return { provider: 'unknown' };
    }
  };

  const db = getDbInfo();
  res.json({ ok: true, status: 'healthy', timestamp: Date.now(), dbTarget, db });
});

// Novo endpoint: alternar alvo do banco (local/railway) dinamicamente
import prisma, { switchDbTarget, getProductsForTarget, getSchemaSummaryForTarget } from "./lib/prisma.js";
import { getSaleUpdates, onSaleUpdate } from "./lib/events.js";
app.post('/api/admin/db-target', async (req, res) => {
  try {
    const raw = (req.body?.target || '').toString().toLowerCase();
    const target = raw === 'local' ? 'local' : raw === 'railway' ? 'railway' : '';
    if (!target) {
      return res.status(400).json({ ok: false, message: 'Alvo inválido. Use "local" ou "railway".' });
    }
    const result = await switchDbTarget(target);

    // Monta informações do banco para resposta
    const getDbInfo = () => {
      try {
        const urlStr = process.env.DATABASE_URL || '';
        const u = new URL(urlStr);
        const provider = (u.protocol || '').replace(':', '') || 'unknown';
        const host = u.hostname || '';
        const port = u.port || '';
        const database = (u.pathname || '').replace(/^\//, '') || '';
        const info = { provider, host };
        if (port) info.port = port;
        if (database) info.database = database;
        return info;
      } catch {
        return { provider: 'unknown' };
      }
    };

    return res.json({ ok: true, message: 'Base alternada com sucesso.', dbTarget: result.target, db: getDbInfo() });
  } catch (err) {
    console.error('Erro ao alternar DB_TARGET:', err);
    return res.status(500).json({ ok: false, message: 'Erro ao alternar base.' });
  }
});

app.get('/api/admin/compare/products', async (req, res) => {
  try {
    const local = await getProductsForTarget('local');
    const railway = await getProductsForTarget('railway');
    const pick = (arr) => arr.map((p) => p.nome).slice(0, 10);
    res.json({
      ok: true,
      local: { count: local.length, sample: pick(local) },
      railway: { count: railway.length, sample: pick(railway) }
    });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/admin/schema/diff', async (req, res) => {
  try {
    const local = await getSchemaSummaryForTarget('local');
    const railway = await getSchemaSummaryForTarget('railway');
    const diff = {};
    const allTables = Array.from(new Set([...Object.keys(local), ...Object.keys(railway)]));
    for (const table of allTables) {
      const lc = (local[table] || []).map(c => c.field);
      const rw = (railway[table] || []).map(c => c.field);
      const missingInRailway = lc.filter(f => !rw.includes(f));
      const extraInRailway = rw.filter(f => !lc.includes(f));
      diff[table] = { missingInRailway, extraInRailway };
    }
    res.json({ ok: true, diff, local, railway });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

app.get('/api/sale/updates', (req, res) => {
  try {
    const since = req.query.since || 0;
    const updates = getSaleUpdates(since);
    res.json({ ok: true, now: Date.now(), updates });
  } catch (e) {
    res.status(500).json({ ok: false });
  }
});

const sseClients = [];
app.get('/api/sale/stream', (req, res) => {
  try {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders && res.flushHeaders();
    res.write(`retry: 1000\n\n`);
    sseClients.push(res);
    const unsubscribe = onSaleUpdate((payload) => {
      try { res.write(`data: ${JSON.stringify(payload)}\n\n`); } catch {}
    });
    req.on('close', () => {
      unsubscribe && unsubscribe();
      const idx = sseClients.indexOf(res);
      if (idx >= 0) sseClients.splice(idx, 1);
      try { res.end(); } catch {}
    });
  } catch {
    res.status(500).end();
  }
});

// Middleware de autenticação JWT para proteger todas as rotas (exceto /api/auth)
const authenticate = (req, res, next) => {
  if (req.method === "OPTIONS") return next();
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return res.status(401).json({ message: "Token ausente" });
  }
  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    return next();
  } catch (err) {
    return res.status(401).json({ message: "Token inválido" });
  }
};

// Rotas
app.use("/api/auth", authRoutes); // rotas públicas
app.use("/api/customer", authenticate, customerRoutes);
app.use("/api/product", authenticate, productRoutes);
app.use("/api/product-group", authenticate, productGroupRoutes);
app.use("/api/employee", authenticate, employeeRoutes);
app.use("/api/sale", authenticate, saleRoutes);
app.use("/api/mesa", authenticate, mesaRoutes);
app.use("/api/user", authenticate, userRoutes);
app.use("/api/tipo", authenticate, tipoRoutes);
app.use("/api/unidade-medida", authenticate, unidadeMedidaRoutes);
app.use("/api/categoria", authenticate, categoriaRoutes);
app.use("/api/caixa", authenticate, caixaRoutes);

const PORT = process.env.PORT || 4000;
app.listen(PORT, '0.0.0.0', () => console.log(`✅ API rodando em: http://0.0.0.0:${PORT}`));

// Conexão única com Prisma após iniciar servidor
const dbTarget = process.env.DB_TARGET || (process.env.DATABASE_URL && process.env.DATABASE_URL.includes('localhost') ? 'local' : 'railway');
prisma.$connect()
  .then(() => console.log(`✅ Conectado ao MySQL (${dbTarget})`))
  .catch(err => console.error("❌ Erro ao conectar MySQL:", err));

// WebSocket server para eventos em tempo real (LAN, sem localhost)
(async () => {
  try {
    const { WebSocketServer } = await import('ws');
    const WS_PORT = process.env.WS_PORT || 4001;
    const wss = new WebSocketServer({ port: WS_PORT, host: '0.0.0.0' });
    const sockets = new Set();
    wss.on('connection', (ws) => {
      sockets.add(ws);
      ws.on('close', () => sockets.delete(ws));
    });
    onSaleUpdate((payload) => {
      try {
        const msg = JSON.stringify({ type: 'sale:update', payload });
        sockets.forEach((ws) => { try { ws.send(msg); } catch {} });
      } catch {}
    });
    console.log(`🔌 WebSocket ativo em ws://0.0.0.0:${WS_PORT}`);
  } catch (e) {
    console.warn('WS desativado:', e?.message || e);
  }
})();
