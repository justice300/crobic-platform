import { prisma } from "./src/db.js";

await prisma.user.update({
  where: { email: "designhub353@gmail.com" },
  data: { name: "Justice FULL SURNAME HERE" }
});

console.log("Student full name updated.");
await prisma.$disconnect();
