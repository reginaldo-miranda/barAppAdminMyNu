
import { getActivePrisma } from '../lib/prisma.js';

async function main() {
  const prisma = getActivePrisma();
  
  try {
    const result = await prisma.$queryRawUnsafe(`SHOW INDEX FROM ProductSetorImpressao`);
    console.log(JSON.stringify(result, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));
    
    const constraints = await prisma.$queryRawUnsafe(`
      SELECT * 
      FROM information_schema.KEY_COLUMN_USAGE 
      WHERE TABLE_NAME = 'ProductSetorImpressao' AND TABLE_SCHEMA = DATABASE()
    `);
    console.log('CONSTRAINTS:', JSON.stringify(constraints, (key, value) => 
      typeof value === 'bigint' ? value.toString() : value
    , 2));

  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
