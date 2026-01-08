
import { getActivePrisma } from '../lib/prisma.js';

async function main() {
  const prisma = getActivePrisma();
  
  try {
    const result = await prisma.$queryRawUnsafe(`SHOW TABLES`);
    console.log(JSON.stringify(result, null, 2));
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
