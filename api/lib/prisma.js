import { PrismaClient } from "@prisma/client";

// Exporta uma instância única do Prisma para ser reutilizada nas rotas
const prisma = new PrismaClient();

export default prisma;