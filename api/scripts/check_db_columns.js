
import { getColumnsForTarget, getActivePrisma } from '../lib/prisma.js';

async function main() {
  const prisma = getActivePrisma();
  console.log('Checking columns for SaleItem...');
  
  try {
    const columns = await getColumnsForTarget('local', 'SaleItem');
    console.log(JSON.stringify(columns, null, 2));

    const missing = [];
    const required = ['origem', 'variacaoOpcoes', 'variacaoRegraPreco', 'variacaoTipo'];
    const columnNames = columns.map(c => c.field);
    
    for (const req of required) {
      if (!columnNames.includes(req)) {
        missing.push(req);
      }
    }

    if (missing.length > 0) {
      console.log('MISSING COLUMNS DETECTED:', missing);
    } else {
      console.log('All expected columns are present.');
    }

  } catch (error) {
    console.error('Error checking columns:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
