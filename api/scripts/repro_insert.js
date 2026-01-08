
import { getActivePrisma } from '../lib/prisma.js';

async function main() {
  const prisma = getActivePrisma();
  
  try {
    // 1. Create a dummy product
    const product = await prisma.product.findFirst({ where: { ativo: true } });
    if (!product) throw new Error('No active product found');
    console.log('Product found:', product.id, product.nome);

    // 2. Create a dummy sale (mesa)
    const sale = await prisma.sale.create({
      data: {
        tipoVenda: 'mesa',
        status: 'aberta',
        subtotal: 0,
        desconto: 0,
        total: 0,
        formaPagamento: 'dinheiro',
        responsavelFuncionarioId: 1 // Assuming ID 1 exists
      }
    });
    console.log('Sale created:', sale.id);

    // 3. Try to add item (logic similar to route)
    const prodId = product.id;
    const quantidade = 1;
    const precoUnit = Number(product.precoVenda);
    
    console.log('Adding item...');
    const item = await prisma.saleItem.create({
        data: {
          saleId: sale.id,
          productId: prodId,
          nomeProduto: product.nome,
          quantidade: quantidade,
          precoUnitario: String(precoUnit.toFixed(2)),
          subtotal: String((quantidade * precoUnit).toFixed(2)),
          status: 'pendente',
          createdAt: new Date(),
          origem: 'default',
          // variacao fields...
        },
    });
    console.log('Item created successfully:', item.id);

  } catch (error) {
    console.error('ERROR REPRODUCING:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
