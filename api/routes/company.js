import express from "express";
import prisma from "../lib/prisma.js";

const router = express.Router();

// GET: Retornar dados da empresa (único registro)
router.get("/", async (req, res) => {
  try {
    const company = await prisma.company.findFirst();
    res.json(company || {}); // Retorna objeto vazio se não houver cadastro ainda
  } catch (error) {
    console.error("Erro ao buscar dados da empresa:", error);
    res.status(500).json({ error: "Erro interno ao buscar empresa" });
  }
});

// POST: Criar ou Atualizar (Upsert logic - garantindo apenas 1 registro)
router.post("/", async (req, res) => {
  const data = req.body;
  
  // Converter tipos decimais/numéricos se necessário
  if (data.valorMensalidade) data.valorMensalidade = Number(data.valorMensalidade);
  if (data.serieNfce) data.serieNfce = Number(data.serieNfce);
  if (data.numeroInicialNfce) data.numeroInicialNfce = Number(data.numeroInicialNfce);
  if (data.diaVencimento) data.diaVencimento = Number(data.diaVencimento);
  if (data.diasAtraso) data.diasAtraso = Number(data.diasAtraso);

  try {
    // Verifica se já existe
    const existing = await prisma.company.findFirst();

    if (existing) {
      // Atualiza
      const updated = await prisma.company.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() }
      });
      return res.json({ message: "Dados atualizados com sucesso", company: updated });
    } else {
      // Cria
      const created = await prisma.company.create({
        data: data
      });
      return res.status(201).json({ message: "Empresa cadastrada com sucesso", company: created });
    }
  } catch (error) {
    console.error("Erro ao salvar dados da empresa:", error);
    res.status(500).json({ error: "Erro interno ao salvar empresa" });
  }
});

// PUT: Atualizar (mesma lógica do POST para simplificar frontend, mas explicito)
router.put("/", async (req, res) => {
  // Redireciona para lógica de POST que já faz upsert
  // Mas vamos manter separado se quiser lógica específica
  // Por enquanto, vou redirecionar a chamada internamente ou copiar lógica.
  // Melhor expor a rota e deixar o frontend chamar POST ou PUT.
  // Vamos implementar PUT igual Update.
  const data = req.body;
  if (data.valorMensalidade) data.valorMensalidade = Number(data.valorMensalidade);

  try {
    const existing = await prisma.company.findFirst();
    if (!existing) {
      return res.status(404).json({ message: "Cadastro não encontrado para atualização" });
    }

    const updated = await prisma.company.update({
        where: { id: existing.id },
        data: { ...data, updatedAt: new Date() }
    });
    res.json({ message: "Dados atualizados com sucesso", company: updated });

  } catch (error) {
    console.error("Erro ao atualizar empresa:", error);
    res.status(500).json({ error: "Erro interno" });
  }
});

export default router;
