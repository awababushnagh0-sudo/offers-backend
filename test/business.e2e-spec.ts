import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { generateClaimCode } from './../src/common/utils/claim-code.js';
import { PrismaService } from './../src/database/prisma.service.js';
import {
  City,
  ClaimStatus,
  OfferStatus,
  StoreMemberRole,
  UserRole,
} from './../src/generated/prisma/enums.js';
import { PasswordService } from './../src/modules/auth/password.service.js';
import { configureApp } from './../src/setup/app.setup.js';
import { StorageService } from './../src/storage/storage.service.js';

const PNG = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  Buffer.alloc(200),
]);
const JPEG = Buffer.concat([
  Buffer.from([0xff, 0xd8, 0xff, 0xe0]),
  Buffer.alloc(200),
]);
const PASSWORD = 'Merchant-Pass-1';
const HOUR = 3_600_000;

// Creates its own stores and users and deletes them afterwards.
// Uploads go to a temp folder (see vitest.config.e2e.ts).
describe('Business API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let uploadsDir: string;

  const run = Math.floor(10_000_000 + Math.random() * 89_999_999);
  const phone = (n: number) =>
    `+2189${String((run + n) % 100_000_000).padStart(8, '0')}`;
  const phones = {
    owner: phone(0),
    staff: phone(1),
    temp: phone(2),
    other: phone(3),
  };
  const customerName = `E2E Business Customer ${run}`;

  let categoryId: string;
  let storeId: string;
  let otherStoreId: string;
  let branchA: string;
  let branchB: string;
  let otherBranch: string;
  const tokens = { owner: '', staff: '', temp: '', other: '', customer: '' };
  let customerId: string;

  const api = () => request(app.getHttpServer());
  const as = (who: keyof typeof tokens, req: request.Test) =>
    req.set('Authorization', `Bearer ${tokens[who]}`);
  const url = (path = '') => `/api/v1/business/stores/${storeId}${path}`;

  async function merchant(phoneNumber: string, mustChangePassword = false) {
    return prisma.user.create({
      data: {
        role: UserRole.MERCHANT,
        name: `E2E ${phoneNumber}`,
        phone: phoneNumber,
        passwordHash: await app.get(PasswordService).hash(PASSWORD),
        mustChangePassword,
      },
    });
  }

  async function login(phoneNumber: string) {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: phoneNumber, password: PASSWORD })
      .expect(200);
    return res.body.accessToken as string;
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);
    // Set to a temp folder by vitest.config.e2e.ts
    uploadsDir = app.get(StorageService).rootDir;
    expect(uploadsDir).toContain('offers-e2e-uploads');

    const category = await prisma.category.create({
      data: { slug: `e2e-biz-${run}`, nameAr: 'تجربة', nameEn: 'E2E' },
    });
    categoryId = category.id;

    const [owner, staff, temp, other] = [
      await merchant(phones.owner),
      await merchant(phones.staff),
      await merchant(phones.temp, true),
      await merchant(phones.other),
    ];

    const store = await prisma.store.create({
      data: {
        categoryId,
        name: `E2E Biz Store ${run}`,
        branches: {
          create: [
            { name: 'A', city: 'TRIPOLI', latitude: 32.88, longitude: 13.19 },
            { name: 'B', city: 'TRIPOLI', latitude: 32.89, longitude: 13.2 },
          ],
        },
      },
      include: { branches: { orderBy: { name: 'asc' } } },
    });
    storeId = store.id;
    [branchA, branchB] = store.branches.map((b) => b.id);
    await prisma.storeMember.createMany({
      data: [
        { storeId, userId: owner.id, role: StoreMemberRole.OWNER },
        {
          storeId,
          userId: staff.id,
          role: StoreMemberRole.STAFF,
          branchId: branchA,
        },
        { storeId, userId: temp.id, role: StoreMemberRole.OWNER },
      ],
    });

    const otherStore = await prisma.store.create({
      data: {
        categoryId,
        name: `E2E Other Store ${run}`,
        branches: {
          create: {
            name: 'X',
            city: City.TRIPOLI,
            latitude: 32.37,
            longitude: 15.09,
          },
        },
        members: { create: { userId: other.id, role: StoreMemberRole.OWNER } },
      },
      include: { branches: true },
    });
    otherStoreId = otherStore.id;
    otherBranch = otherStore.branches[0].id;

    tokens.owner = await login(phones.owner);
    tokens.staff = await login(phones.staff);
    tokens.temp = await login(phones.temp);
    tokens.other = await login(phones.other);
    const customer = await api()
      .post('/api/v1/auth/dev/customer')
      .send({ name: customerName })
      .expect(200);
    tokens.customer = customer.body.accessToken;
    customerId = customer.body.user.id;
  });

  afterAll(async () => {
    await prisma.store.deleteMany({
      where: { id: { in: [storeId, otherStoreId] } },
    });
    await prisma.user.deleteMany({
      where: {
        OR: [{ phone: { in: Object.values(phones) } }, { id: customerId }],
      },
    });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await app.close();
    await rm(uploadsDir, { recursive: true, force: true });
  });

  describe('access', () => {
    it('rejects customers', async () => {
      await as('customer', api().get(url())).expect(403);
    });

    it("hides other stores from merchants who don't belong to them", async () => {
      await as('other', api().get(url())).expect(404);
      await as('owner', api().get('/api/v1/business/stores/not-a-uuid')).expect(
        404,
      );
    });

    it('blocks merchants on a temporary password', async () => {
      const res = await as('temp', api().get(url())).expect(403);
      expect(res.body.error).toBe('PasswordChangeRequired');
      // ...but they can still see their profile to change it
      await as('temp', api().get('/api/v1/auth/me')).expect(200);
    });

    it('limits staff to read-only and redeeming', async () => {
      await as('staff', api().get(url('/offers'))).expect(200);
      await as('staff', api().post(url('/products')))
        .send({ title: 'x', regularPrice: '1' })
        .expect(403);
    });
  });

  describe('store profile', () => {
    it('shows the store with branches', async () => {
      const res = await as('owner', api().get(url())).expect(200);
      expect(res.body.branches).toHaveLength(2);
    });

    it('lets owners edit contact details but not the name', async () => {
      const res = await as('owner', api().patch(url()))
        .send({ description: 'Best sweets', phone: '0911111111' })
        .expect(200);
      expect(res.body).toMatchObject({
        description: 'Best sweets',
        phone: '+218911111111',
      });

      await as('owner', api().patch(url()))
        .send({ name: 'Hacked' })
        .expect(400);
    });

    it('uploads a logo and serves it', async () => {
      const res = await as('owner', api().put(url('/images/logo')))
        .attach('image', PNG, {
          filename: 'logo.png',
          contentType: 'image/png',
        })
        .expect(200);
      expect(res.body.logoUrl).toMatch(
        new RegExp(
          `^http://localhost:3000/uploads/stores/${storeId}/[0-9a-f-]+\\.png$`,
        ),
      );
      const path = new URL(res.body.logoUrl).pathname;
      expect(existsSync(join(uploadsDir, path.replace('/uploads/', '')))).toBe(
        true,
      );
      await api().get(path).expect(200);
    });

    it('rejects files that are not images, whatever their name', async () => {
      const res = await as('owner', api().put(url('/images/cover')))
        .attach('image', Buffer.from('<?php evil ?>'), {
          filename: 'cover.png',
          contentType: 'image/png',
        })
        .expect(400);
      expect(res.body.message).toBe('Image must be a JPEG, PNG or WebP file');
    });

    it('rejects images over 1 MB', async () => {
      await as('owner', api().put(url('/images/cover')))
        .attach('image', Buffer.concat([JPEG, Buffer.alloc(1024 * 1024)]), {
          filename: 'big.jpg',
          contentType: 'image/jpeg',
        })
        .expect(413);
    });
  });

  let productId: string;

  describe('products', () => {
    it('validates prices', async () => {
      for (const regularPrice of ['0', '8.1234', '-1', 'abc']) {
        await as('owner', api().post(url('/products')))
          .send({ title: 'Cake', regularPrice })
          .expect(400);
      }
      const res = await as('owner', api().post(url('/products')))
        .send({ title: 'Kunafa', regularPrice: 12.5 })
        .expect(201);
      expect(res.body.regularPrice).toBe('12.500');
    });

    it('creates a product and uploads its photo and thumbnail', async () => {
      const created = await as('owner', api().post(url('/products')))
        .send({ title: 'كيكة كراميل', regularPrice: '8' })
        .expect(201);
      productId = created.body.id;
      expect(created.body.regularPrice).toBe('8.000');

      await as('owner', api().put(url(`/products/${productId}/image`)))
        .attach('image', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .expect(400);

      const res = await as(
        'owner',
        api().put(url(`/products/${productId}/image`)),
      )
        .attach('image', JPEG, { filename: 'a.jpg', contentType: 'image/jpeg' })
        .attach('thumb', JPEG, { filename: 'b.jpg', contentType: 'image/jpeg' })
        .expect(200);
      expect(res.body.imageUrl).toMatch(/\/uploads\/products\/.+\.jpg$/);
      expect(res.body.thumbUrl).toMatch(/\/uploads\/products\/.+\.jpg$/);
    });

    it('archives products', async () => {
      const created = await as('owner', api().post(url('/products')))
        .send({ title: 'Old item', regularPrice: '5' })
        .expect(201);
      await as('owner', api().patch(url(`/products/${created.body.id}`)))
        .send({ isArchived: true })
        .expect(200);

      const active = await as('owner', api().get(url('/products'))).expect(200);
      const archived = await as(
        'owner',
        api().get(url('/products')).query({ archived: 'true' }),
      ).expect(200);
      expect(active.body.items.map((p: { id: string }) => p.id)).not.toContain(
        created.body.id,
      );
      expect(archived.body.items.map((p: { id: string }) => p.id)).toEqual([
        created.body.id,
      ]);

      await as('owner', api().post(url('/offers')))
        .send({
          productId: created.body.id,
          offerPrice: '2',
          type: 'UNLIMITED',
          endsAt: new Date(Date.now() + HOUR),
        })
        .expect(400);
    });

    it("can't touch another store's products", async () => {
      await as('other', api().get(url(`/products/${productId}`))).expect(404);
      await as(
        'other',
        api().get(
          `/api/v1/business/stores/${otherStoreId}/products/${productId}`,
        ),
      ).expect(404);
    });
  });

  let offerId: string;

  describe('offers', () => {
    const offer = (overrides: Record<string, unknown> = {}) => ({
      productId,
      offerPrice: '4',
      type: 'LIMITED',
      totalQuantity: 20,
      endsAt: new Date(Date.now() + 24 * HOUR),
      ...overrides,
    });

    it('posts a limited offer valid at all branches', async () => {
      const res = await as('owner', api().post(url('/offers')))
        .send(offer())
        .expect(201);
      offerId = res.body.id;
      expect(res.body).toMatchObject({
        title: 'كيكة كراميل',
        originalPrice: '8.000',
        offerPrice: '4.000',
        discountPercent: 50,
        state: 'LIVE',
        remainingQuantity: 20,
        maxPerUser: 1,
        claimWindowMinutes: 60,
        claims: { reserved: 0, redeemed: 0, expired: 0, cancelled: 0 },
      });
      expect(res.body.branchIds.sort()).toEqual([branchA, branchB].sort());
      expect(res.body.thumbUrl).toMatch(/\.jpg$/);
    });

    it.each([
      ['price not lower than regular', { offerPrice: '8' }],
      ['limited without quantity', { totalQuantity: undefined }],
      ['unlimited with quantity', { type: 'UNLIMITED' }],
      ['ending in the past', { endsAt: new Date(Date.now() - HOUR) }],
      [
        'longer than 30 days',
        { endsAt: new Date(Date.now() + 31 * 24 * HOUR) },
      ],
      ["another store's branch", { branchIds: [otherBranch] }],
      ['unknown product', { productId: randomUUID() }],
    ])('rejects offers with %s', async (_name, overrides) => {
      await as('owner', api().post(url('/offers')))
        .send(offer(overrides))
        .expect(400);
    });

    it('shows future offers as scheduled', async () => {
      const res = await as('owner', api().post(url('/offers')))
        .send(
          offer({
            startsAt: new Date(Date.now() + 2 * HOUR),
            branchIds: [branchB],
          }),
        )
        .expect(201);
      expect(res.body.state).toBe('SCHEDULED');
      expect(res.body.branchIds).toEqual([branchB]);
    });

    it('pauses, resumes and ends offers', async () => {
      const created = await as('owner', api().post(url('/offers')))
        .send(offer())
        .expect(201);
      const id = created.body.id;

      const paused = await as(
        'owner',
        api().post(url(`/offers/${id}/pause`)),
      ).expect(200);
      expect(paused.body.state).toBe('PAUSED');
      await as('owner', api().post(url(`/offers/${id}/pause`))).expect(400);

      const resumed = await as(
        'owner',
        api().post(url(`/offers/${id}/resume`)),
      ).expect(200);
      expect(resumed.body.state).toBe('LIVE');

      const ended = await as(
        'owner',
        api().post(url(`/offers/${id}/end`)),
      ).expect(200);
      expect(ended.body.state).toBe('ENDED');
      await as('owner', api().post(url(`/offers/${id}/resume`))).expect(400);
      await as('owner', api().patch(url(`/offers/${id}`)))
        .send({ title: 'x' })
        .expect(400);
    });

    it('blocks changes to offers an admin took down', async () => {
      const created = await as('owner', api().post(url('/offers')))
        .send(offer())
        .expect(201);
      await prisma.offer.update({
        where: { id: created.body.id },
        data: { status: OfferStatus.REMOVED },
      });
      await as(
        'owner',
        api().post(url(`/offers/${created.body.id}/resume`)),
      ).expect(403);
    });

    it('blocks disabled stores from posting', async () => {
      await prisma.store.update({
        where: { id: storeId },
        data: { isActive: false },
      });
      const res = await as('owner', api().post(url('/offers')))
        .send(offer())
        .expect(403);
      expect(res.body.message).toContain('disabled');
      await prisma.store.update({
        where: { id: storeId },
        data: { isActive: true },
      });
    });
  });

  describe('claims at the counter', () => {
    async function claim(
      overrides: { offerId?: string; expiresAt?: Date } = {},
    ) {
      return prisma.claim.create({
        data: {
          offerId: overrides.offerId ?? offerId,
          userId: customerId,
          code: generateClaimCode(),
          expiresAt: overrides.expiresAt ?? new Date(Date.now() + HOUR),
        },
      });
    }

    it('lists reserved claims and looks up codes in any format', async () => {
      const c = await claim();
      const list = await as('staff', api().get(url('/claims'))).expect(200);
      expect(list.body.items.map((i: { id: string }) => i.id)).toContain(c.id);

      const messy = `${c.code.slice(0, 4).toLowerCase()}-${c.code.slice(4)}`;
      const res = await as(
        'staff',
        api().get(url(`/claims/code/${messy}`)),
      ).expect(200);
      expect(res.body).toMatchObject({
        code: c.code,
        customerName,
        canRedeem: true,
        problem: null,
        offer: { offerPrice: '4.000' },
      });
    });

    it('asks owners which branch, then redeems once', async () => {
      const c = await claim();
      const noBranch = await as('owner', api().post(url('/claims/redeem')))
        .send({ code: c.code })
        .expect(400);
      expect(noBranch.body.message).toBe(
        'Choose the branch where this is being redeemed',
      );

      const res = await as('owner', api().post(url('/claims/redeem')))
        .send({ code: c.code, branchId: branchB })
        .expect(200);
      expect(res.body).toMatchObject({
        status: 'REDEEMED',
        redeemedBranchId: branchB,
        canRedeem: false,
      });

      const again = await as('owner', api().post(url('/claims/redeem')))
        .send({ code: c.code, branchId: branchB })
        .expect(409);
      expect(again.body.message).toMatch(/^Already redeemed/);
    });

    it('redeems at the staff member’s own branch', async () => {
      const c = await claim();
      const res = await as('staff', api().post(url('/claims/redeem')))
        .send({ code: c.code, branchId: branchB })
        .expect(200);
      expect(res.body.redeemedBranchId).toBe(branchA);
    });

    it('rejects offers not valid at the staff member’s branch', async () => {
      const onlyB = await as('owner', api().post(url('/offers')))
        .send({
          productId,
          offerPrice: '5',
          type: 'UNLIMITED',
          endsAt: new Date(Date.now() + HOUR),
          branchIds: [branchB],
        })
        .expect(201);
      const c = await claim({ offerId: onlyB.body.id });

      const lookup = await as(
        'staff',
        api().get(url(`/claims/code/${c.code}`)),
      ).expect(200);
      expect(lookup.body).toMatchObject({
        canRedeem: false,
        problem: 'This offer is not valid at your branch',
      });
      await as('staff', api().post(url('/claims/redeem')))
        .send({ code: c.code })
        .expect(409);
    });

    it('rejects expired claims, even before the cleanup job runs', async () => {
      const c = await claim({ expiresAt: new Date(Date.now() - 1000) });
      const res = await as('owner', api().post(url('/claims/redeem')))
        .send({ code: c.code, branchId: branchA })
        .expect(409);
      expect(res.body.message).toBe('This claim has expired');
      const stored = await prisma.claim.findUniqueOrThrow({
        where: { id: c.id },
      });
      expect(stored.status).toBe(ClaimStatus.RESERVED);
    });

    it("can't redeem another store's codes", async () => {
      const c = await claim();
      await as(
        'other',
        api().get(
          `/api/v1/business/stores/${otherStoreId}/claims/code/${c.code}`,
        ),
      ).expect(404);
    });
  });

  describe('stats', () => {
    it('counts today’s redemptions and top offers', async () => {
      const res = await as('owner', api().get(url('/stats'))).expect(200);
      expect(res.body.today.redeemed).toBeGreaterThanOrEqual(2);
      expect(res.body.liveOffers).toBeGreaterThanOrEqual(1);
      expect(res.body.topOffers[0]).toMatchObject({ offerId, redeemed: 2 });
    });
  });
});
