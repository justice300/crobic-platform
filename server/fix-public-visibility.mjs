import { prisma } from "./src/db.js";

async function main() {
  await prisma.book.updateMany({ data: { published: true } });
  await prisma.course.updateMany({ data: { published: true } });
  await prisma.gallery.updateMany({ data: { published: true } });
  await prisma.announcement.updateMany({ data: { published: true } });
  await prisma.slide.updateMany({ data: { active: true } });

  console.log("Public visibility restored");

  const books = await prisma.book.findMany({
    select: { id: true, title: true, published: true }
  });

  console.table(books);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
