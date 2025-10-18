import { PrismaClient } from "@prisma/client";

// Prisma Client instance with logging
const prisma = new PrismaClient({
	log:
		process.env.NODE_ENV === "development"
			? ["query", "error", "warn"]
			: ["error"],
});

// Graceful shutdown handler
process.on("SIGINT", async () => {
	await prisma.$disconnect();
	process.exit(0);
});

process.on("SIGTERM", async () => {
	await prisma.$disconnect();
	process.exit(0);
});

export default prisma;
