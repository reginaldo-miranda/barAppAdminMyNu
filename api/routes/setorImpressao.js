import express from 'express';
import { getActivePrisma } from '../lib/prisma.js';

const router = express.Router();

router.get('/list', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const rows = await prisma.$queryRawUnsafe('SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM `SetorImpressao` WHERE `ativo` = true ORDER BY `nome` ASC');
    res.json(rows);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar setores de impressão' });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`);
    const setor = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    if (!setor) return res.status(404).json({ error: 'Setor não encontrado' });
    res.json(setor);
  } catch (error) {
    res.status(500).json({ error: 'Erro ao buscar setor' });
  }
});

router.post('/create', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { nome, descricao, modoEnvio, whatsappDestino, ativo } = req.body;
    const n = String(nome || '').trim();
    if (!n) return res.status(400).json({ error: 'Nome é obrigatório' });
    const mv = String(modoEnvio || 'impressora').toLowerCase();
    const m = mv === 'whatsapp' ? 'whatsapp' : 'impressora';
    const w = whatsappDestino ? String(whatsappDestino) : null;
    const a = ativo === undefined ? true : !!ativo;
    await prisma.$executeRawUnsafe(`INSERT INTO \`SetorImpressao\` (nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao) VALUES ('${n.replace(/'/g, "''")}', ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : 'NULL'}, '${m}', ${w ? `'${w.replace(/'/g, "''")}'` : 'NULL'}, ${a ? 1 : 0}, NOW())`);
    const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE nome = '${n.replace(/'/g, "''")}' ORDER BY id DESC LIMIT 1`);
    const created = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.status(201).json({ message: 'Setor cadastrado com sucesso', setor: created });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao cadastrar setor' });
  }
});

router.put('/update/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    const { nome, descricao, modoEnvio, whatsappDestino, ativo } = req.body;
    const fields = [];
    if (nome !== undefined) fields.push(`nome = '${String(nome).replace(/'/g, "''")}'`);
    if (descricao !== undefined) fields.push(`descricao = ${descricao ? `'${String(descricao).replace(/'/g, "''")}'` : 'NULL'}`);
    if (modoEnvio !== undefined) {
      const mv = String(modoEnvio).toLowerCase();
      const m = mv === 'whatsapp' ? 'whatsapp' : 'impressora';
      fields.push(`modoEnvio = '${m}'`);
    }
    if (whatsappDestino !== undefined) fields.push(`whatsappDestino = ${whatsappDestino ? `'${String(whatsappDestino).replace(/'/g, "''")}'` : 'NULL'}`);
    if (ativo !== undefined) fields.push(`ativo = ${!!ativo ? 1 : 0}`);
    if (fields.length === 0) {
      return res.status(400).json({ error: 'Nenhum campo para atualizar' });
    }
    await prisma.$executeRawUnsafe(`UPDATE \`SetorImpressao\` SET ${fields.join(', ')} WHERE id = ${id}`);
    const rows = await prisma.$queryRawUnsafe(`SELECT id, nome, descricao, modoEnvio, whatsappDestino, ativo, dataInclusao FROM \`SetorImpressao\` WHERE id = ${id}`);
    const updated = Array.isArray(rows) && rows.length > 0 ? rows[0] : null;
    res.json({ message: 'Setor atualizado com sucesso', setor: updated });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao atualizar setor' });
  }
});

router.delete('/delete/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }
    await prisma.$executeRawUnsafe(`UPDATE \`SetorImpressao\` SET ativo = 0 WHERE id = ${id}`);
    res.json({ message: 'Setor removido com sucesso' });
  } catch (error) {
    res.status(500).json({ error: 'Erro ao remover setor' });
  }
});

export default router;