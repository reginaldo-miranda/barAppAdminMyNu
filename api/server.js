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

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
prisma.$connect()
  .then(() => console.log("✅ Conectado ao MySQL (db: appBar)"))
  .catch(err => console.error("❌ Erro ao conectar MySQL:", err));
