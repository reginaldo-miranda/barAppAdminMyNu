
import { getActivePrisma } from '../lib/prisma.js';

async function main() {
  const prisma = getActivePrisma();
  
  try {
    // Try to select the 'origem' column specifically
    const result = await prisma.$queryRawUnsafe(`SELECT origem FROM SaleItem LIMIT 1`);
    console.log('Column "origem" exists! Result:', result);
  } catch (error) {
    console.error('Column "origem" DOES NOT exist or error:', error.message);
  } finally {
    await prisma.$disconnect();
  }
}

main();
