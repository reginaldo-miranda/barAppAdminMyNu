import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  console.log('Starting migration...');
  
  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE Product ADD COLUMN permiteMeioAMeio BOOLEAN NOT NULL DEFAULT false`);
    console.log('✅ Added permiteMeioAMeio');
  } catch (e) {
    if (e.message.includes('Duplicate column')) console.log('⚠️ permiteMeioAMeio already exists');
    else console.error('❌ Failed to add permiteMeioAMeio:', e.message);
  }

  try {
    // Check if ENUM exists or if we need to define it inline
    await prisma.$executeRawUnsafe(`ALTER TABLE Product ADD COLUMN regraVariacao ENUM('mais_caro', 'media', 'fixo') NOT NULL DEFAULT 'mais_caro'`);
    console.log('✅ Added regraVariacao');
  } catch (e) {
     if (e.message.includes('Duplicate column')) console.log('⚠️ regraVariacao already exists');
     else console.error('❌ Failed to add regraVariacao:', e.message);
  }

  try {
    await prisma.$executeRawUnsafe(`ALTER TABLE Product ADD COLUMN precoFixoVariacao DECIMAL(10, 2)`);
    console.log('✅ Added precoFixoVariacao');
  } catch (e) {
     if (e.message.includes('Duplicate column')) console.log('⚠️ precoFixoVariacao already exists');
     else console.error('❌ Failed to add precoFixoVariacao:', e.message);
  }
}

main()
  .catch(e => console.error(e))
  .finally(async () => {
    await prisma.$disconnect();
    console.log('Done.');
  });
