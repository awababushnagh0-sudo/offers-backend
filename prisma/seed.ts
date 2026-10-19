import 'dotenv/config';
import { PrismaPg } from '@prisma/adapter-pg';
import { OfferType, PrismaClient } from '../src/generated/prisma/client.js';

// Safe to run many times: everything is upserted by a fixed id or slug.

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL'] }),
});

const categories = [
  { slug: 'sweets', nameAr: 'حلويات', nameEn: 'Sweets', sortOrder: 1 },
  { slug: 'cafes', nameAr: 'مقاهي', nameEn: 'Cafés', sortOrder: 2 },
  { slug: 'bakeries', nameAr: 'مخابز', nameEn: 'Bakeries', sortOrder: 3 },
];

const DEMO = {
  storeId: '01990000-0000-7000-8000-000000000001',
  branchAndalusId: '01990000-0000-7000-8000-000000000011',
  branchBenAshourId: '01990000-0000-7000-8000-000000000012',
  caramelCakeId: '01990000-0000-7000-8000-000000000021',
  baklavaId: '01990000-0000-7000-8000-000000000022',
  caramelOfferId: '01990000-0000-7000-8000-000000000031',
  baklavaOfferId: '01990000-0000-7000-8000-000000000032',
};

const hoursFromNow = (hours: number) =>
  new Date(Date.now() + hours * 60 * 60 * 1000);

async function main() {
  for (const category of categories) {
    await prisma.category.upsert({
      where: { slug: category.slug },
      update: category,
      create: category,
    });
  }

  const sweets = await prisma.category.findUniqueOrThrow({
    where: { slug: 'sweets' },
  });

  const store = {
    categoryId: sweets.id,
    name: 'حلويات تجريبية',
    description: 'Demo store for development',
  };
  await prisma.store.upsert({
    where: { id: DEMO.storeId },
    update: store,
    create: { id: DEMO.storeId, ...store },
  });

  const branches = [
    {
      id: DEMO.branchAndalusId,
      name: 'حي الأندلس',
      city: 'Tripoli',
      area: 'Hay Al Andalus',
      latitude: 32.871,
      longitude: 13.115,
    },
    {
      id: DEMO.branchBenAshourId,
      name: 'بن عاشور',
      city: 'Tripoli',
      area: 'Ben Ashour',
      latitude: 32.879,
      longitude: 13.203,
    },
  ];
  for (const { id, ...branch } of branches) {
    await prisma.branch.upsert({
      where: { id },
      update: branch,
      create: { id, storeId: DEMO.storeId, ...branch },
    });
  }

  const products = [
    { id: DEMO.caramelCakeId, title: 'كيكة كراميل', regularPrice: '8.000' },
    { id: DEMO.baklavaId, title: 'بقلاوة (نص كيلو)', regularPrice: '25.000' },
  ];
  for (const { id, ...product } of products) {
    await prisma.product.upsert({
      where: { id },
      update: product,
      create: { id, storeId: DEMO.storeId, ...product },
    });
  }

  const offers = [
    {
      id: DEMO.caramelOfferId,
      productId: DEMO.caramelCakeId,
      title: 'كيكة كراميل',
      originalPrice: '8.000',
      offerPrice: '4.000',
      type: OfferType.LIMITED,
      totalQuantity: 20,
      remainingQuantity: 20,
      endsAt: hoursFromNow(24),
    },
    {
      id: DEMO.baklavaOfferId,
      productId: DEMO.baklavaId,
      title: 'بقلاوة (نص كيلو)',
      originalPrice: '25.000',
      offerPrice: '18.000',
      type: OfferType.UNLIMITED,
      endsAt: hoursFromNow(72),
    },
  ];
  for (const { id, ...offer } of offers) {
    await prisma.offer.upsert({
      where: { id },
      update: offer,
      create: {
        id,
        storeId: DEMO.storeId,
        ...offer,
        branches: {
          create: branches.map((branch) => ({ branchId: branch.id })),
        },
      },
    });
  }

  console.log(
    `Seeded ${categories.length} categories, 1 store, ${branches.length} branches, ${products.length} products, ${offers.length} offers`,
  );
}

try {
  await main();
} finally {
  await prisma.$disconnect();
}
