import express from 'express';

import { getActivePrisma } from '../lib/prisma.js';
import { enqueuePrintJob, buildPrintContent } from '../lib/print.js';
import { queueWhatsAppMessage, formatWhatsappMessage } from '../lib/whatsapp.js';
import { recordSaleUpdate } from '../lib/events.js';

const router = express.Router();

// Criar nova venda
router.post('/create', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { funcionario, cliente, mesa, tipoVenda, nomeComanda, valorTotal, observacoes } = req.body;

    // Verificar se funcionário foi informado
    if (funcionario === undefined || funcionario === null || String(funcionario).trim() === '') {
      return res.status(400).json({ error: 'Funcionário é obrigatório' });
    }

    // Resolver funcionarioId (suporta 'admin-fixo' ou ID numérico)
    let funcionarioId = null;
    if (typeof funcionario === 'string' && funcionario === 'admin-fixo') {
      let admin = await prisma.employee.findFirst({ where: { nome: 'Administrador' } });
      if (!admin) {
        admin = await prisma.employee.create({
          data: {
            nome: 'Administrador',
            telefone: '(00) 00000-0000',
            cargo: 'Gerente',
            salario: 0,
            ativo: true,
            dataAdmissao: new Date(),
          },
        });
      }
      funcionarioId = admin.id;
    } else {
      const funcionarioNum = Number(funcionario);
      if (!Number.isFinite(funcionarioNum) || !Number.isInteger(funcionarioNum) || funcionarioNum <= 0) {
        return res.status(400).json({ error: 'Funcionário inválido' });
      }
      const func = await prisma.employee.findUnique({ where: { id: funcionarioNum } });
      if (!func) {
        return res.status(400).json({ error: 'Funcionário não encontrado' });
      }
      funcionarioId = func.id;
    }

    // Validar cliente (opcional)
    let clienteId = null;
    if (cliente !== undefined && cliente !== null && !(typeof cliente === 'string' && cliente.trim() === '')) {
      const clienteNum = Number(cliente);
      if (!Number.isFinite(clienteNum) || !Number.isInteger(clienteNum) || clienteNum <= 0) {
        return res.status(400).json({ error: 'Cliente inválido' });
      }
      const cli = await prisma.customer.findUnique({ where: { id: clienteNum } });
      if (!cli) {
        return res.status(400).json({ error: 'Cliente não encontrado' });
      }
      clienteId = cli.id;
    }

    // Validar mesa se tipo for mesa
    let mesaId = null;
    const tipoFinal = tipoVenda ? String(tipoVenda) : 'balcao';
    if (tipoFinal === 'mesa' && mesa !== undefined && mesa !== null) {
      const mesaNum = Number(mesa);
      if (!Number.isFinite(mesaNum) || !Number.isInteger(mesaNum) || mesaNum <= 0) {
        return res.status(400).json({ error: 'Mesa inválida' });
      }
      const mesaReg = await prisma.mesa.findUnique({
        where: { id: mesaNum },
        include: { vendaAtual: true },
      });
      if (!mesaReg) {
        return res.status(400).json({ error: 'Mesa não encontrada' });
      }
      // Verificar se a mesa já tem uma venda ativa
      if (mesaReg.status === 'ocupada' && mesaReg.vendaAtualId) {
        const vendaAtual = await prisma.sale.findUnique({ where: { id: mesaReg.vendaAtualId } });
        if (vendaAtual && vendaAtual.status === 'aberta') {
          return res.status(400).json({ error: 'Mesa já possui uma venda em aberto' });
        }
      }
      mesaId = mesaReg.id;
    }

    // Montar dados e criar venda com Prisma
    const venda = await prisma.sale.create({
      data: {
        status: 'aberta',
        tipoVenda: tipoFinal,
        funcionarioId: funcionarioId ?? null,
        clienteId: clienteId ?? null,
        mesaId: mesaId ?? null,
        nomeComanda: typeof nomeComanda === 'string' && nomeComanda.trim() !== '' ? nomeComanda.trim() : null,
        subtotal: 0,
        desconto: 0,
        total: Number(valorTotal || 0),
        formaPagamento: 'dinheiro',
        observacoes: typeof observacoes === 'string' && observacoes.trim() !== '' ? observacoes.trim() : null,
        dataVenda: new Date(),
      },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    // Se for venda de mesa, atualizar status e vendaAtual
    if (tipoFinal === 'mesa' && venda.mesaId) {
      await prisma.mesa.update({
        where: { id: venda.mesaId },
        data: {
          status: 'ocupada',
          vendaAtualId: venda.id,
          horaAbertura: new Date(),
        },
      });
    }

    res.status(201).json(mapSaleResponse(normalizeSale(venda)));
    try { recordSaleUpdate(venda.id); } catch {}
  } catch (error) {
    console.error('Erro ao criar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Helper para normalizar tipos numéricos em vendas e itens
const toNum = (v) => Number(v);
const normalizeSale = (venda) => {
  if (!venda) return venda;
  const itensNorm = Array.isArray(venda.itens)
    ? venda.itens.map((item) => ({
        ...item,
        precoUnitario: toNum(item.precoUnitario),
        subtotal: toNum(item.subtotal),
        product: item.product
          ? { ...item.product, precoVenda: toNum(item.product.precoVenda) }
          : item.product,
      }))
    : venda.itens;
  return {
    ...venda,
    subtotal: toNum(venda.subtotal),
    desconto: toNum(venda.desconto),
    total: toNum(venda.total),
    itens: itensNorm,
  };
};
const normalizeSales = (arr) => (Array.isArray(arr) ? arr.map(normalizeSale) : arr);

// Compatibilidade: alias _id e renomear product -> produto nas respostas
const mapSaleResponse = (venda) => {
  if (!venda) return venda;
  const base = { ...venda, _id: String(venda.id), id: venda.id };
  // Mapear itens e produto
    const itens = Array.isArray(venda.itens)
    ? venda.itens.map((item) => {
        const { product, ...restItem } = item;
        const produto = product
          ? {
              _id: String(product.id),
              id: product.id,
              nome: product.nome,
              preco: Number(product.precoVenda),
            }
          : undefined;
        return {
          ...restItem,
          _id: String(item.id),
          id: item.id,
          produto,
          nomeProduto: restItem.nomeProduto || (produto ? produto.nome : restItem.nomeProduto),
          precoUnitario: Number(restItem.precoUnitario),
          subtotal: Number(restItem.subtotal),
          origem: String(restItem.origem || 'default'),
          variacao: restItem.variacaoTipo
            ? {
                tipo: restItem.variacaoTipo,
                regraPreco: restItem.variacaoRegraPreco,
                opcoes: Array.isArray(restItem.variacaoOpcoes) ? restItem.variacaoOpcoes : []
              }
            : undefined,
        };
      })
    : venda.itens;
  base.itens = itens;
  // Mapear mesa
  if (venda.mesa) {
    const fr = venda.mesa.funcionarioResponsavel
      ? {
          _id: String(venda.mesa.funcionarioResponsavel.id),
          id: venda.mesa.funcionarioResponsavel.id,
          nome: venda.mesa.funcionarioResponsavel.nome,
        }
      : undefined;
    base.mesa = { ...venda.mesa, _id: String(venda.mesa.id), id: venda.mesa.id, funcionarioResponsavel: fr };
  }
  // Mapear funcionario e cliente
  if (venda.funcionario) {
    base.funcionario = { _id: String(venda.funcionario.id), id: venda.funcionario.id, nome: venda.funcionario.nome };
  }
  if (venda.cliente) {
    base.cliente = { _id: String(venda.cliente.id), id: venda.cliente.id, nome: venda.cliente.nome };
  }
  return base;
};
const mapSales = (arr) => (Array.isArray(arr) ? arr.map(mapSaleResponse) : arr);

// Listar vendas abertas (Prisma)
router.get('/open', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const vendasAbertas = await prisma.sale.findMany({
      where: { status: 'aberta' },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
      orderBy: { dataVenda: 'desc' },
    });
    res.json(mapSales(normalizeSales(vendasAbertas)));
  } catch (error) {
    console.error('Erro ao buscar vendas abertas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Versão mínima e rápida das vendas abertas com totais agregados
router.get('/open-min', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const vendas = await prisma.sale.findMany({
      where: { status: 'aberta' },
      select: {
        id: true,
        status: true,
        tipoVenda: true,
        nomeComanda: true,
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        desconto: true,
        itens: { select: { quantidade: true, precoUnitario: true, subtotal: true } },
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });
    // agregar total e itensCount
    const results = vendas.map(v => {
      const itens = Array.isArray(v.itens) ? v.itens : [];
      const subtotal = itens.reduce((acc, it) => acc + Number(it.subtotal ?? (Number(it.quantidade) * Number(it.precoUnitario))), 0);
      const descontoNum = Number(v.desconto || 0);
      const total = Math.max(0, subtotal - descontoNum);
      return {
        _id: String(v.id),
        id: v.id,
        status: v.status,
        tipoVenda: v.tipoVenda,
        nomeComanda: v.nomeComanda,
        funcionario: v.funcionario ? { nome: v.funcionario.nome } : null,
        cliente: v.cliente ? { nome: v.cliente.nome } : null,
        itensCount: itens.length,
        total,
      };
    });
    res.json(results);
  } catch (error) {
    console.error('Erro ao buscar vendas abertas (min):', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar todas as vendas (com filtros opcionais) - Prisma
router.get('/list', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { status, funcionario, cliente, dataInicio, dataFim } = req.query;
    const where = {};

    if (status) where.status = String(status);
    if (funcionario) where.funcionarioId = Number(funcionario);
    if (cliente) where.clienteId = Number(cliente);

    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio));
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim));
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar vendas finalizadas por período (Prisma)
router.get('/finalizadas', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { dataInicio, dataFim } = req.query;

    const where = { status: 'finalizada' };
    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio) + 'T00:00:00-03:00');
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim) + 'T23:59:59-03:00');
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
      },
      orderBy: { dataVenda: 'desc' },
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas finalizadas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar vendas por mesa (Prisma)
router.get('/mesa/:mesaId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const mesaId = Number(req.params.mesaId);
    if (!Number.isInteger(mesaId) || mesaId <= 0) {
      return res.status(400).json({ error: 'Mesa inválida' });
    }

    const vendas = await prisma.sale.findMany({
      where: { mesaId },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
      orderBy: { dataVenda: 'desc' },
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas da mesa:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Buscar venda por ID (Prisma)
router.get('/:id', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { select: { numero: true, nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    res.json(mapSaleResponse(normalizeSale(venda)));
  } catch (error) {
    console.error('Erro ao buscar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Adicionar item à venda (Prisma)
  router.post('/:id/item', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { produtoId, quantidade } = req.body;
    const variacao = req.body?.variacao || null;
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] POST /:id/item', { id, produtoId, quantidade });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] addItem rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível adicionar itens a uma venda finalizada' });
    }

    const prodId = Number(produtoId);
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }
    const produto = await prisma.product.findUnique({ where: { id: prodId } });
    if (!produto) {
      return res.status(404).json({ error: 'Produto não encontrado' });
    }
    if (!produto.ativo) {
      return res.status(400).json({ error: 'Produto inativo' });
    }

    const itemExistente = Array.isArray(venda.itens)
      ? venda.itens.find((i) => Number(i.productId) === prodId)
      : null;
    const shouldMerge = !variacao && itemExistente && origem !== 'tablet';
    if (shouldMerge) {
      const novaQtd = Number(itemExistente.quantidade || 0) + Number(quantidade || 1);
      await prisma.saleItem.update({
        where: { id: itemExistente.id },
        data: {
          quantidade: novaQtd,
          subtotal: String((Number(novaQtd) * Number(itemExistente.precoUnitario ?? produto.precoVenda)).toFixed(2)),
          status: 'pendente'
        }
      });
    } else {
      let precoUnit = produto.precoVenda;
      let variacaoTipo = null;
      let variacaoRegra = null;
      let variacaoOpcoes = null;
      if (variacao) {
        try {
          const tipoId = Number(variacao?.tipoId);
          const tipoNome = String(variacao?.tipoNome || '').trim();
          let vt = null;
          if (Number.isInteger(tipoId) && tipoId > 0) {
            vt = await prisma.variationType.findUnique({ where: { id: tipoId } });
          } else if (tipoNome) {
            vt = await prisma.variationType.findFirst({ where: { nome: tipoNome } });
          }
          if (vt && vt.ativo === false) vt = null;
          const opcoesArr = Array.isArray(variacao?.opcoes) ? variacao.opcoes : [];
          const opcoesIds = opcoesArr.map((o) => Number(o?.productId ?? o)).filter((n) => Number.isInteger(n) && n > 0);
          const maxAllowed = Number(vt?.maxOpcoes || variacao?.maxOpcoes || 1);
          if (opcoesIds.length === 0 || opcoesIds.length > maxAllowed) {
            return res.status(400).json({ error: 'Quantidade de opções inválida para a variação' });
          }
          const prods = await prisma.product.findMany({ where: { id: { in: opcoesIds }, ativo: true } });
          if (prods.length !== opcoesIds.length) {
            return res.status(400).json({ error: 'Opções de variação inválidas' });
          }
          if (vt && Array.isArray(vt.categoriasIds) && vt.categoriasIds.length > 0) {
            const invalid = prods.some((p) => {
              const cid = Number(p.categoriaId || 0);
              return !vt.categoriasIds.includes(cid);
            });
            if (invalid) {
              return res.status(400).json({ error: 'Opção fora das categorias aplicáveis' });
            }
          }
          const precos = prods.map((p) => Number(p.precoVenda));
          const fractions = opcoesArr.map((o) => Number(o?.fracao || 0)).filter((f) => Number.isFinite(f) && f > 0);
          const regra = String(vt?.regraPreco || variacao?.regraPreco || 'mais_caro');
          if (regra === 'mais_caro') {
            precoUnit = Math.max(...precos);
          } else if (regra === 'media') {
            if (fractions.length === precos.length && fractions.length > 0) {
              const wsum = precos.reduce((acc, n, i) => acc + n * fractions[i], 0);
              const fsum = fractions.reduce((acc, f) => acc + f, 0);
              precoUnit = fsum > 0 ? (wsum / fsum) : produto.precoVenda;
            } else {
              const sum = precos.reduce((acc, n) => acc + n, 0);
              precoUnit = precos.length > 0 ? (sum / precos.length) : produto.precoVenda;
            }
          } else if (regra === 'fixo') {
            const pf = vt?.precoFixo !== null && vt?.precoFixo !== undefined ? Number(vt.precoFixo) : Number(variacao?.precoFixo || 0);
            precoUnit = pf > 0 ? pf : produto.precoVenda;
          }
          variacaoTipo = vt ? vt.nome : (tipoNome || null);
          variacaoRegra = vt ? vt.regraPreco : regra;
          variacaoOpcoes = prods.map((p, idx) => ({ productId: p.id, nome: p.nome, preco: Number(p.precoVenda), fracao: fractions[idx] || undefined }));
        } catch (e) {
          return res.status(400).json({ error: 'Erro ao processar variação' });
        }
      }
      const qty = Number(quantidade || 1);
      await prisma.saleItem.create({
        data: {
          saleId: venda.id,
          productId: prodId,
          nomeProduto: produto.nome,
          quantidade: qty,
          precoUnitario: String(Number(precoUnit).toFixed(2)),
          subtotal: String(Number(qty * precoUnit).toFixed(2)),
          status: 'pendente',
          createdAt: new Date(),
          origem,
          variacaoTipo: variacaoTipo || undefined,
          variacaoRegraPreco: variacaoRegra || undefined,
          variacaoOpcoes: variacaoOpcoes || undefined
        },
      });
    }

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    try {
      const setores = await prisma.$queryRawUnsafe(`SELECT s.id AS id, s.nome AS nome, s.modoEnvio AS modo, s.whatsappDestino AS whatsappDestino, s.printerId AS printerId FROM \`SetorImpressao\` s INNER JOIN \`ProductSetorImpressao\` psi ON psi.setorId = s.id WHERE psi.productId = ${prodId} AND s.ativo = 1`);
      let cozinha = false;
      let bar = false;
      const saleRef = { mesa: vendaAtualizada?.mesa || null, comanda: vendaAtualizada?.nomeComanda || null };
      const it = Array.isArray(vendaAtualizada?.itens) ? vendaAtualizada.itens.find((i) => Number(i.productId) === prodId && Number(i.quantidade) === Number(quantidade || 1)) : null;
      const qty = Number(quantidade || 1);
      for (const s of Array.isArray(setores) ? setores : []) {
        const nome = String(s.nome || '').toLowerCase();
        const modo = String(s.modo || '').toLowerCase();
        if (nome === 'comandas' || nome === 'mesas' || nome === 'cozinha') cozinha = true;
        if (nome === 'balcão' || nome === 'balcao' || nome === 'bar') bar = true;
        if (modo === 'impressora' && s.printerId) {
          const content = buildPrintContent({ setorNome: s.nome, saleRef, productNome: it?.product?.nome || produto?.nome || '', quantidade: qty, observacao: it?.observacao || '' });
          enqueuePrintJob({ saleId: id, productId: prodId, setorId: Number(s.id), printerId: Number(s.printerId), content }).catch(() => {});
        }
        if (modo === 'whatsapp' && s.whatsappDestino) {
          const text = formatWhatsappMessage({ sale: vendaAtualizada, itens: vendaAtualizada?.itens || [] });
          queueWhatsAppMessage({ saleId: id, to: String(s.whatsappDestino), text }).catch(() => {});
        }
      }
      if (cozinha || bar) {
        await prisma.sale.update({ where: { id }, data: { impressaoCozinha: cozinha ? true : undefined, impressaoBar: bar ? true : undefined } });
      }
    } catch {}

    const payload = mapSaleResponse(normalizeSale(vendaAtualizada));
    try {
      const hasSetorVinculo = Array.isArray(setores) ? setores.length > 0 : false;
      payload.validacaoSetor = {
        productId: Number(prodId),
        vinculado: !!hasSetorVinculo,
        setores: (Array.isArray(setores) ? setores.map((s) => s?.nome).filter(Boolean) : [])
      };
      if (!hasSetorVinculo) {
        payload.warnings = [...(Array.isArray(payload.warnings) ? payload.warnings : []), 'Produto sem vínculo com setor de impressão'];
      }
    } catch {}
    res.json(payload);
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao adicionar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Remover item da venda (Prisma)
router.delete('/:id/item/:produtoId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const prodId = Number(req.params.produtoId);
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] DELETE /:id/item/:produtoId', { id, produtoId: prodId, origem });
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }

    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] removeItem rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível remover itens de uma venda finalizada' });
    }

    let item = venda.itens.find(i => i.productId === prodId);
    if (origem === 'tablet') {
      const tabletItens = venda.itens.filter(i => i.productId === prodId && String(i.origem || '') === 'tablet');
      if (tabletItens.length > 0) {
        item = tabletItens.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).pop();
      }
    }
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na venda' });
    }

    await prisma.saleItem.delete({ where: { id: item.id } });

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao remover item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Atualizar quantidade de item (Prisma)
  router.put('/:id/item/:produtoId', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const prodId = Number(req.params.produtoId);
    const { quantidade, itemId } = req.body;
    const origemRaw = (req.body?.origem || req.headers['x-client-mode'] || '').toString().toLowerCase();
    const origem = origemRaw === 'tablet' ? 'tablet' : 'default';
    console.log('[SALE] PUT /:id/item/:produtoId', { id, produtoId: prodId, quantidade, origem, itemId });

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'Venda inválida' });
    }
    if (!Number.isInteger(prodId) || prodId <= 0) {
      return res.status(400).json({ error: 'Produto inválido' });
    }
    const qnt = Number(quantidade);
    if (!Number.isInteger(qnt) || qnt <= 0) {
      return res.status(400).json({ error: 'Quantidade deve ser maior que zero' });
    }

    const venda = await prisma.sale.findUnique({ where: { id }, include: { itens: true } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      console.warn('[SALE] updateItemQuantity rejeitado: venda não está aberta', { id, status: venda.status });
      return res.status(400).json({ error: 'Não é possível alterar itens de uma venda finalizada' });
    }

    let item = venda.itens.find(i => i.productId === prodId);
    if (origem === 'tablet') {
      const tabletItens = venda.itens.filter(i => i.productId === prodId && String(i.origem || '') === 'tablet');
      if (itemId) {
        const byId = venda.itens.find(i => i.id === Number(itemId));
        if (byId && byId.productId === prodId) item = byId;
      } else if (tabletItens.length > 0) {
        item = tabletItens.sort((a,b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()).pop();
      }
    }
    if (!item) {
      return res.status(404).json({ error: 'Item não encontrado na venda' });
    }

    const prevQty = Number(item.quantidade || 0);

    const delta = qnt - prevQty;
    if (delta <= 0) {
      await prisma.saleItem.update({
        where: { id: item.id },
        data: { quantidade: qnt, subtotal: qnt * item.precoUnitario },
      });
    } else {
      await prisma.saleItem.update({
        where: { id: item.id },
        data: { quantidade: qnt, subtotal: qnt * item.precoUnitario, status: 'pendente' },
      });
    }

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });
    try {
      const setores = await prisma.$queryRawUnsafe(`SELECT s.id AS id, s.nome AS nome, s.modoEnvio AS modo, s.whatsappDestino AS whatsappDestino, s.printerId AS printerId FROM \`SetorImpressao\` s INNER JOIN \`ProductSetorImpressao\` psi ON psi.setorId = s.id WHERE psi.productId = ${prodId} AND s.ativo = 1`);
      const saleRef = { mesa: vendaAtualizada?.mesa || null, comanda: vendaAtualizada?.nomeComanda || null };
      const it = Array.isArray(vendaAtualizada?.itens) ? vendaAtualizada.itens.find((i) => Number(i.productId) === prodId) : null;
      const deltaNow = qnt - prevQty;
      if (deltaNow > 0) {
        for (const s of Array.isArray(setores) ? setores : []) {
          const modo = String(s.modo || '').toLowerCase();
          if (modo === 'impressora' && s.printerId) {
            const content = buildPrintContent({ setorNome: s.nome, saleRef, productNome: it?.product?.nome || '', quantidade: deltaNow, observacao: it?.observacao || '' });
            enqueuePrintJob({ saleId: id, productId: prodId, setorId: Number(s.id), printerId: Number(s.printerId), content }).catch(() => {});
          }
          if (modo === 'whatsapp' && s.whatsappDestino) {
            const text = formatWhatsappMessage({ sale: vendaAtualizada, itens: vendaAtualizada?.itens || [] });
            queueWhatsAppMessage({ saleId: id, to: String(s.whatsappDestino), text }).catch(() => {});
          }
        }
      }
    } catch {}

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao atualizar item:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Aplicar desconto (Prisma)
router.put('/:id/discount', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    const { desconto } = req.body;

    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const descontoNum = Number(desconto);
    if (!Number.isFinite(descontoNum) || descontoNum < 0) {
      return res.status(400).json({ error: 'Desconto não pode ser negativo' });
    }

    const venda = await prisma.sale.findUnique({ where: { id } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      return res.status(400).json({ error: 'Não é possível alterar desconto de uma venda finalizada' });
    }

    await prisma.sale.update({ where: { id }, data: { desconto: descontoNum } });

    const vendaAtualizada = await prisma.sale.findUnique({
      where: { id },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    res.json(mapSaleResponse(normalizeSale(vendaAtualizada)));
    try { recordSaleUpdate(vendaAtualizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao aplicar desconto:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Finalizar venda
router.put('/:id/finalize', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const { formaPagamento } = req.body;

    const venda = await prisma.sale.findUnique({
      where: { id },
      include: {
        itens: true,
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { id: true, nome: true } } } },
      },
    });

    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }
    if (venda.status !== 'aberta') {
      return res.status(400).json({ error: 'Venda já foi finalizada ou cancelada' });
    }
    if (!venda.itens || venda.itens.length === 0) {
      return res.status(400).json({ error: 'Não é possível finalizar uma venda sem itens' });
    }

    const formaPagamentoNormalizada = String(formaPagamento || venda.formaPagamento || 'dinheiro')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    const formaFinal = ['dinheiro', 'cartao', 'pix'].includes(formaPagamentoNormalizada)
      ? formaPagamentoNormalizada
      : 'dinheiro';

    const subtotal = Number(
      venda.itens.reduce(
        (acc, item) => acc + Number(item.subtotal ?? (Number(item.quantidade) * Number(item.precoUnitario))),
        0
      )
    );
    const descontoNum = Number(venda.desconto || 0);
    const total = Math.max(0, subtotal - descontoNum);

    let responsavelNome = venda.responsavelNome || null;
    let funcionarioNome = venda.funcionarioNome || null;
    let funcionarioAberturaNome = venda.funcionarioAberturaNome || null;
    let funcionarioAberturaId = venda.funcionarioAberturaId || null;
    let funcionarioId = venda.funcionarioId || null;

    if (venda.mesaId && venda.mesa) {
      const nomeRespMesa = (venda.mesa.nomeResponsavel || '').trim();
      responsavelNome = (nomeRespMesa && nomeRespMesa) || (venda.nomeComanda || '') || responsavelNome || null;
      const atendente = venda.mesa.funcionarioResponsavel || null;
      if (atendente) {
        funcionarioNome = atendente.nome;
        funcionarioId = atendente.id;
        funcionarioAberturaNome = funcionarioAberturaNome || atendente.nome;
        funcionarioAberturaId = funcionarioAberturaId || atendente.id;
      } else if (venda.funcionario) {
        funcionarioNome = venda.funcionario.nome;
        funcionarioId = venda.funcionarioId || funcionarioId;
      }
    } else {
      responsavelNome = (venda.nomeComanda || '') || responsavelNome || null;
      if (venda.funcionario) {
        funcionarioNome = venda.funcionario.nome;
        funcionarioId = venda.funcionarioId || funcionarioId;
      }
    }

    if (!funcionarioNome && !funcionarioAberturaNome) {
      funcionarioAberturaNome = 'Administrador';
    }

    const vendaFinalizada = await prisma.sale.update({
      where: { id },
      data: {
        formaPagamento: formaFinal,
        subtotal,
        total,
        status: 'finalizada',
        dataFinalizacao: new Date(),
        responsavelNome,
        funcionarioNome,
        funcionarioAberturaNome,
        funcionarioAberturaId,
        funcionarioId,
      },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        mesa: { include: { funcionarioResponsavel: { select: { nome: true } } } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    let caixaAberto = await prisma.caixa.findFirst({ where: { status: 'aberto' } });
    if (!caixaAberto) {
      let funcIdToUse = vendaFinalizada.funcionarioId || vendaFinalizada.funcionarioAberturaId || null;
      if (!funcIdToUse) {
        const func = await prisma.employee.findFirst({ where: { ativo: true } });
        if (func) {
          funcIdToUse = func.id;
        } else {
          const admin = await prisma.employee.create({
            data: {
              nome: 'Administrador',
              telefone: '(00) 00000-0000',
              cargo: 'Gerente',
              salario: 0,
              ativo: true,
              dataAdmissao: new Date(),
            },
          });
          funcIdToUse = admin.id;
        }
      }
      caixaAberto = await prisma.caixa.create({
        data: {
          funcionarioAberturaId: funcIdToUse,
          valorAbertura: 0,
          observacoes: 'Caixa aberto automaticamente pelo sistema',
        },
      });
    }

    const valorVenda = Number(vendaFinalizada.total);
    const forma = formaFinal;

    await prisma.caixaVenda.create({
      data: {
        caixaId: caixaAberto.id,
        vendaId: vendaFinalizada.id,
        valor: valorVenda,
        formaPagamento: forma,
        dataVenda: new Date(),
      },
    });

    const novoTotalVendas = Number(caixaAberto.totalVendas || 0) + valorVenda;
    const novoDinheiro = Number(caixaAberto.totalDinheiro || 0) + (forma === 'dinheiro' ? valorVenda : 0);
    const novoCartao = Number(caixaAberto.totalCartao || 0) + (forma === 'cartao' ? valorVenda : 0);
    const novoPix = Number(caixaAberto.totalPix || 0) + (forma === 'pix' ? valorVenda : 0);

    await prisma.caixa.update({
      where: { id: caixaAberto.id },
      data: {
        totalVendas: novoTotalVendas,
        totalDinheiro: novoDinheiro,
        totalCartao: novoCartao,
        totalPix: novoPix,
      },
    });

    if (vendaFinalizada.mesaId) {
      const mesa = await prisma.mesa.findUnique({ where: { id: vendaFinalizada.mesaId } });
      if (mesa) {
        await prisma.mesa.update({
          where: { id: mesa.id },
          data: {
            status: 'livre',
            vendaAtualId: null,
            clientesAtuais: 0,
            horaAbertura: null,
            observacoes: '',
            funcionarioResponsavelId: null,
            nomeResponsavel: '',
          },
        });
      }
    }

    res.json(mapSaleResponse(vendaFinalizada));
    try { recordSaleUpdate(vendaFinalizada.id); } catch {}
  } catch (error) {
    console.error('Erro ao finalizar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});
// Cancelar venda (Prisma)
router.put('/:id/cancel', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({ error: 'ID inválido' });
    }

    const venda = await prisma.sale.findUnique({ where: { id } });
    if (!venda) {
      return res.status(404).json({ error: 'Venda não encontrada' });
    }

    if (venda.status === 'finalizada') {
      return res.status(400).json({ error: 'Não é possível cancelar uma venda finalizada' });
    }

    const vendaCancelada = await prisma.sale.update({
      where: { id },
      data: { status: 'cancelada', dataFinalizacao: new Date() },
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
        itens: { include: { product: { select: { nome: true, precoVenda: true } } } },
      },
    });

    // Se mesa vinculada estiver apontando para esta venda, limpar vínculo/estado
    if (venda.mesaId) {
      const mesa = await prisma.mesa.findUnique({ where: { id: venda.mesaId } });
      if (mesa && mesa.vendaAtualId === id) {
        await prisma.mesa.update({
          where: { id: venda.mesaId },
          data: {
            vendaAtualId: null,
            clientesAtuais: 0,
            horaAbertura: null,
            observacoes: '',
            funcionarioResponsavelId: null,
            nomeResponsavel: '',
          },
        });
      }
    }

    res.json(mapSaleResponse(normalizeSale(vendaCancelada)));
    try { recordSaleUpdate(vendaCancelada.id); } catch {}
  } catch (error) {
    console.error('Erro ao cancelar venda:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

// Listar todas as vendas (rota alternativa) com Prisma
router.get('/', async (req, res) => {
  try {
    const prisma = getActivePrisma();
    const { status, funcionario, cliente, dataInicio, dataFim } = req.query;
    const where = {};

    if (status) where.status = String(status);
    if (funcionario) where.funcionarioId = Number(funcionario);
    if (cliente) where.clienteId = Number(cliente);

    if (dataInicio || dataFim) {
      where.dataVenda = {};
      if (dataInicio) where.dataVenda.gte = new Date(String(dataInicio));
      if (dataFim) where.dataVenda.lte = new Date(String(dataFim));
    }

    const vendas = await prisma.sale.findMany({
      where,
      include: {
        funcionario: { select: { nome: true } },
        cliente: { select: { nome: true } },
      },
      orderBy: { dataVenda: 'desc' },
      take: 100,
    });

    res.json(mapSales(normalizeSales(vendas)));
  } catch (error) {
    console.error('Erro ao buscar vendas:', error);
    res.status(500).json({ error: 'Erro interno do servidor' });
  }
});

export default router;