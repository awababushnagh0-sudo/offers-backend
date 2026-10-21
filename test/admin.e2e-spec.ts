import { randomUUID } from 'node:crypto';
import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import {
  ClaimStatus,
  OfferType,
  UserRole,
} from './../src/generated/prisma/enums.js';
import { PasswordService } from './../src/modules/auth/password.service.js';
import { configureApp } from './../src/setup/app.setup.js';

// Uses its own admin, stores and users (random identifiers) and deletes them afterwards.
describe('Admin API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let adminToken: string;
  let adminId: string;
  let customerToken: string;

  const run = Math.floor(10_000_000 + Math.random() * 89_999_999);
  const admin = {
    email: `e2e-admin-${run}@offers.local`,
    password: 'Admin-Pass-1',
  };
  const ownerPhone = { local: `09${run}`, e164: `+2189${run}` };
  const staffRun = (run + 1) % 100_000_000;
  const staffPhone = `09${String(staffRun).padStart(8, '1')}`;
  const customerName = `E2E Admin Customer ${run}`;
  const categorySlug = `e2e-cat-${run}`;
  const hiddenSlug = `e2e-hidden-${run}`;
  const createdStoreIds: string[] = [];

  const api = () => request(app.getHttpServer());
  const asAdmin = (req: request.Test) =>
    req.set('Authorization', `Bearer ${adminToken}`);

  let categoryId: string;
  let storeId: string;
  let branchId: string;
  let ownerId: string;
  let ownerTempPassword: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    const created = await prisma.user.create({
      data: {
        role: UserRole.ADMIN,
        email: admin.email,
        name: 'E2E Admin',
        passwordHash: await app.get(PasswordService).hash(admin.password),
      },
    });
    adminId = created.id;
    const login = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: admin.email, password: admin.password })
      .expect(200);
    adminToken = login.body.accessToken;

    const customer = await api()
      .post('/api/v1/auth/dev/customer')
      .send({ name: customerName })
      .expect(200);
    customerToken = customer.body.accessToken;
  });

  afterAll(async () => {
    await prisma.store.deleteMany({ where: { id: { in: createdStoreIds } } });
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: admin.email },
          { phone: ownerPhone.e164 },
          {
            phone: { startsWith: `+2189${String(staffRun).padStart(8, '1')}` },
          },
          { name: customerName },
        ],
      },
    });
    await prisma.category.deleteMany({
      where: { slug: { in: [categorySlug, hiddenSlug] } },
    });
    await app.close();
  });

  describe('access control', () => {
    it('rejects anonymous users', async () => {
      await api().get('/api/v1/admin/stores').expect(401);
    });

    it('rejects customers', async () => {
      await api()
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);
    });
  });

  describe('categories', () => {
    it('creates categories and rejects duplicate slugs with 409', async () => {
      const res = await asAdmin(api().post('/api/v1/admin/categories'))
        .send({
          slug: categorySlug,
          nameAr: 'تجربة',
          nameEn: 'E2E',
          sortOrder: 99,
        })
        .expect(201);
      categoryId = res.body.id;

      const dup = await asAdmin(api().post('/api/v1/admin/categories'))
        .send({ slug: categorySlug, nameAr: 'x', nameEn: 'x' })
        .expect(409);
      expect(dup.body.error).toBe('Conflict');
    });

    it('hides inactive categories from the public list', async () => {
      const hidden = await asAdmin(api().post('/api/v1/admin/categories'))
        .send({ slug: hiddenSlug, nameAr: 'مخفي', nameEn: 'Hidden' })
        .expect(201);
      await asAdmin(api().patch(`/api/v1/admin/categories/${hidden.body.id}`))
        .send({ isActive: false })
        .expect(200);

      const res = await api().get('/api/v1/categories').expect(200);
      const slugs = res.body.map((c: { slug: string }) => c.slug);
      expect(slugs).toContain(categorySlug);
      expect(slugs).not.toContain(hiddenSlug);
    });
  });

  describe('stores', () => {
    const newStore = () => ({
      categoryId,
      name: `E2E Sweets ${run}`,
      branches: [
        { name: 'Main', city: 'TRIPOLI', latitude: 32.88, longitude: 13.19 },
      ],
      owner: { name: 'E2E Owner', phone: ownerPhone.local },
    });

    it('validates the store body', async () => {
      const res = await asAdmin(api().post('/api/v1/admin/stores'))
        .send({
          ...newStore(),
          branches: [],
          owner: { name: 'x', phone: '123' },
        })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'branches must contain at least 1 elements',
          'owner.phone must be a valid Libyan mobile number',
        ]),
      );
    });

    it('takes cities from the list only, and a valid email', async () => {
      const res = await asAdmin(api().post('/api/v1/admin/stores'))
        .send({
          ...newStore(),
          email: 'not-an-email',
          branches: [
            {
              name: 'Main',
              city: 'Tripoli',
              latitude: 32.88,
              longitude: 13.19,
            },
          ],
        })
        .expect(400);
      expect(res.body.message).toEqual(
        expect.arrayContaining([
          'email must be an email',
          'branches.0.city must be one of the following values: TRIPOLI',
        ]),
      );
    });

    it('rejects an unknown category', async () => {
      await asAdmin(api().post('/api/v1/admin/stores'))
        .send({ ...newStore(), categoryId: randomUUID() })
        .expect(400);
    });

    it('creates a store with branches and an owner account', async () => {
      const res = await asAdmin(api().post('/api/v1/admin/stores'))
        .send({ ...newStore(), email: 'hello@sahel-sweets.ly' })
        .expect(201);
      expect(res.body.store.email).toBe('hello@sahel-sweets.ly');
      expect(res.body.store.branches[0].city).toBe('TRIPOLI');
      storeId = res.body.store.id;
      createdStoreIds.push(storeId);
      branchId = res.body.store.branches[0].id;
      ownerId = res.body.owner.userId;
      ownerTempPassword = res.body.owner.temporaryPassword;

      expect(res.body.owner.phone).toBe(ownerPhone.e164);
      expect(ownerTempPassword).toMatch(/^[a-zA-Z2-9]{10}$/);
      expect(res.body.store.members).toEqual([
        expect.objectContaining({
          userId: ownerId,
          role: 'OWNER',
          mustChangePassword: true,
        }),
      ]);
    });

    it('lets the new owner log in, but not into admin routes', async () => {
      const login = await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: ownerTempPassword })
        .expect(200);
      expect(login.body.user.mustChangePassword).toBe(true);

      const me = await api()
        .get('/api/v1/auth/me')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(200);
      expect(me.body.memberships).toEqual([
        expect.objectContaining({
          role: 'OWNER',
          store: expect.objectContaining({ id: storeId }),
        }),
      ]);

      await api()
        .get('/api/v1/admin/stores')
        .set('Authorization', `Bearer ${login.body.accessToken}`)
        .expect(403);
    });

    it('links an existing merchant instead of creating a second account', async () => {
      const res = await asAdmin(api().post('/api/v1/admin/stores'))
        .send({ ...newStore(), name: `E2E Second Store ${run}` })
        .expect(201);
      createdStoreIds.push(res.body.store.id);
      expect(res.body.owner).toEqual({
        userId: ownerId,
        phone: ownerPhone.e164,
        temporaryPassword: null,
      });
    });

    it('returns 404 for unknown stores and 400 for bad ids', async () => {
      await asAdmin(api().get(`/api/v1/admin/stores/${randomUUID()}`)).expect(
        404,
      );
      await asAdmin(api().get('/api/v1/admin/stores/not-a-uuid')).expect(400);
    });

    it('deletes a store without offers, keeping the owner account', async () => {
      const created = await asAdmin(api().post('/api/v1/admin/stores'))
        .send({ ...newStore(), name: `E2E Doomed Store ${run}` })
        .expect(201);
      const doomedId: string = created.body.store.id;
      createdStoreIds.push(doomedId);
      await prisma.product.create({
        data: { storeId: doomedId, title: 'E2E Bread', regularPrice: '1.000' },
      });

      await api().delete(`/api/v1/admin/stores/${doomedId}`).expect(401);
      await api()
        .delete(`/api/v1/admin/stores/${doomedId}`)
        .set('Authorization', `Bearer ${customerToken}`)
        .expect(403);

      await asAdmin(api().delete(`/api/v1/admin/stores/${doomedId}`)).expect(
        204,
      );
      await asAdmin(api().get(`/api/v1/admin/stores/${doomedId}`)).expect(404);
      await asAdmin(api().delete(`/api/v1/admin/stores/${doomedId}`)).expect(
        404,
      );
      expect(await prisma.product.count({ where: { storeId: doomedId } })).toBe(
        0,
      );
      expect(await prisma.user.count({ where: { id: ownerId } })).toBe(1);
    });

    it('answers 400, not 500, to null for a required field', async () => {
      const res = await asAdmin(api().patch(`/api/v1/admin/stores/${storeId}`))
        .send({ name: null, isActive: true })
        .expect(400);
      expect(res.body.message).toBe('Some fields have invalid values');
    });

    it('lists, searches and disables stores', async () => {
      await asAdmin(api().patch(`/api/v1/admin/stores/${storeId}`))
        .send({ isActive: false })
        .expect(200);

      const res = await asAdmin(
        api()
          .get('/api/v1/admin/stores')
          .query({ search: `sweets ${run}`, isActive: 'false' }),
      ).expect(200);
      expect(res.body.meta).toMatchObject({ page: 1, pageSize: 20, total: 1 });
      expect(res.body.items[0]).toMatchObject({
        id: storeId,
        isActive: false,
        branchCount: 1,
      });
    });

    it('adds and edits branches', async () => {
      const added = await asAdmin(
        api().post(`/api/v1/admin/stores/${storeId}/branches`),
      )
        .send({
          name: 'Second',
          city: 'TRIPOLI',
          latitude: 32.9,
          longitude: 13.2,
          phone: '0921234567',
        })
        .expect(201);
      expect(added.body.phone).toBe('+218921234567');

      const edited = await asAdmin(
        api().patch(
          `/api/v1/admin/stores/${storeId}/branches/${added.body.id}`,
        ),
      )
        .send({
          isActive: false,
          openingHours: { sat: [{ open: '08:00', close: '22:00' }] },
        })
        .expect(200);
      expect(edited.body).toMatchObject({
        isActive: false,
        openingHours: { sat: [{ open: '08:00', close: '22:00' }] },
      });

      await asAdmin(
        api().patch(`/api/v1/admin/stores/${storeId}/branches/${randomUUID()}`),
      )
        .send({ name: 'x' })
        .expect(404);
    });
  });

  describe('locations', () => {
    const resolve = (link: string) =>
      asAdmin(api().post('/api/v1/admin/locations/resolve')).send({ link });

    it('reads coordinates and full links', async () => {
      const res = await resolve('32.8872, 13.1913').expect(200);
      expect(res.body).toEqual({ latitude: 32.8872, longitude: 13.1913 });
      await resolve('https://www.google.com/maps/@32.8872,13.1913,17z').expect(
        200,
      );
    });

    it('explains what it could not read', async () => {
      const unreadable = await resolve('Hay Al Andalus').expect(400);
      expect(unreadable.body.error).toBe('UnreadableLocation');
      const abroad = await resolve('48.85, 2.35').expect(400);
      expect(abroad.body.error).toBe('LocationOutsideLibya');
    });

    it('is for admins only', async () => {
      await api()
        .post('/api/v1/admin/locations/resolve')
        .set('Authorization', `Bearer ${customerToken}`)
        .send({ link: '32.8872, 13.1913' })
        .expect(403);
    });
  });

  describe('store members', () => {
    let staffId: string;

    it('adds staff limited to a branch', async () => {
      const res = await asAdmin(
        api().post(`/api/v1/admin/stores/${storeId}/members`),
      )
        .send({ name: 'E2E Staff', phone: staffPhone, role: 'STAFF', branchId })
        .expect(201);
      staffId = res.body.member.userId;
      expect(res.body.member).toMatchObject({ role: 'STAFF', branchId });
      expect(res.body.account.temporaryPassword).toEqual(expect.any(String));
    });

    it('rejects adding the same person twice', async () => {
      await asAdmin(api().post(`/api/v1/admin/stores/${storeId}/members`))
        .send({ name: 'E2E Staff', phone: staffPhone, role: 'STAFF' })
        .expect(409);
    });

    it('rejects branch-limited owners and branches from other stores', async () => {
      await asAdmin(api().post(`/api/v1/admin/stores/${storeId}/members`))
        .send({ name: 'x', phone: '0919999990', role: 'OWNER', branchId })
        .expect(400);
      await asAdmin(api().post(`/api/v1/admin/stores/${storeId}/members`))
        .send({
          name: 'x',
          phone: '0919999990',
          role: 'STAFF',
          branchId: randomUUID(),
        })
        .expect(404);
    });

    it('never removes the last owner', async () => {
      const res = await asAdmin(
        api().delete(`/api/v1/admin/stores/${storeId}/members/${ownerId}`),
      ).expect(400);
      expect(res.body.message).toBe('A store needs at least one owner');
    });

    it('removes staff', async () => {
      await asAdmin(
        api().delete(`/api/v1/admin/stores/${storeId}/members/${staffId}`),
      ).expect(204);
      const store = await asAdmin(
        api().get(`/api/v1/admin/stores/${storeId}`),
      ).expect(200);
      expect(store.body.members).toHaveLength(1);
    });
  });

  describe('users', () => {
    it('finds users by phone in any format', async () => {
      const res = await asAdmin(
        api()
          .get('/api/v1/admin/users')
          .query({ search: ownerPhone.local, role: 'MERCHANT' }),
      ).expect(200);
      expect(res.body.items.map((u: { id: string }) => u.id)).toEqual([
        ownerId,
      ]);
    });

    it('resets a password and logs the user out', async () => {
      const before = await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: ownerTempPassword })
        .expect(200);

      const res = await asAdmin(
        api().post(`/api/v1/admin/users/${ownerId}/reset-password`),
      ).expect(200);
      const newPassword = res.body.temporaryPassword;

      await api()
        .post('/api/v1/auth/refresh')
        .send({ refreshToken: before.body.refreshToken })
        .expect(401);
      await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: ownerTempPassword })
        .expect(401);
      await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: newPassword })
        .expect(200);
      ownerTempPassword = newPassword;
    });

    it('disables and re-enables accounts', async () => {
      await asAdmin(api().patch(`/api/v1/admin/users/${ownerId}/status`))
        .send({ isActive: false })
        .expect(200);
      const blocked = await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: ownerTempPassword })
        .expect(403);
      expect(blocked.body.message).toBe('Account is disabled');

      await asAdmin(api().patch(`/api/v1/admin/users/${ownerId}/status`))
        .send({ isActive: true })
        .expect(200);
      await api()
        .post('/api/v1/auth/login')
        .send({ identifier: ownerPhone.local, password: ownerTempPassword })
        .expect(200);
    });

    it('stops admins from disabling themselves', async () => {
      await asAdmin(api().patch(`/api/v1/admin/users/${adminId}/status`))
        .send({ isActive: false })
        .expect(400);
    });
  });

  describe('offers and stats', () => {
    it('removes an offer and cancels its reservations', async () => {
      const customer = await prisma.user.findFirstOrThrow({
        where: { name: customerName },
      });
      const product = await prisma.product.create({
        data: { storeId, title: 'E2E Cake', regularPrice: '8.000' },
      });
      const offer = await prisma.offer.create({
        data: {
          storeId,
          productId: product.id,
          title: 'E2E Cake',
          originalPrice: '8.000',
          offerPrice: '4.000',
          type: OfferType.LIMITED,
          totalQuantity: 10,
          remainingQuantity: 9,
          endsAt: new Date(Date.now() + 3_600_000),
        },
      });
      const claim = await prisma.claim.create({
        data: {
          offerId: offer.id,
          userId: customer.id,
          code: `e2e-${run}`,
          expiresAt: new Date(Date.now() + 3_600_000),
        },
      });

      const list = await asAdmin(
        api().get('/api/v1/admin/offers').query({ storeId }),
      ).expect(200);
      expect(list.body.items[0]).toMatchObject({
        id: offer.id,
        offerPrice: '4.000',
        originalPrice: '8.000',
        claimCount: 1,
      });

      const res = await asAdmin(
        api().post(`/api/v1/admin/offers/${offer.id}/remove`),
      ).expect(200);
      expect(res.body.status).toBe('REMOVED');
      const after = await prisma.claim.findUniqueOrThrow({
        where: { id: claim.id },
      });
      expect(after.status).toBe(ClaimStatus.CANCELLED);
    });

    it('refuses to delete a store with offers', async () => {
      const res = await asAdmin(
        api().delete(`/api/v1/admin/stores/${storeId}`),
      ).expect(409);
      expect(res.body.error).toBe('StoreHasOffers');
      await asAdmin(api().get(`/api/v1/admin/stores/${storeId}`)).expect(200);
    });

    it('returns dashboard stats', async () => {
      const res = await asAdmin(api().get('/api/v1/admin/stats')).expect(200);
      expect(res.body).toMatchObject({
        stores: { total: expect.any(Number), active: expect.any(Number) },
        users: { customers: expect.any(Number), merchants: expect.any(Number) },
        offers: { live: expect.any(Number), total: expect.any(Number) },
        claims: { total: expect.any(Number) },
      });
      expect(res.body.stores.total).toBeGreaterThanOrEqual(2);
    });
  });
});
