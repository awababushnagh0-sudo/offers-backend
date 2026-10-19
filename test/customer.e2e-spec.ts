import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import {
  ClaimStatus,
  OfferStatus,
  OfferType,
} from './../src/generated/prisma/enums.js';
import { ClaimsExpiryService } from './../src/modules/claims/claims-expiry.service.js';
import { configureApp } from './../src/setup/app.setup.js';

const HOUR = 3_600_000;
const tripoli = { lat: 32.8872, lng: 13.1913 };

// Creates its own stores, offers and customers and deletes them afterwards.
describe('Customer API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const run = Math.floor(10_000_000 + Math.random() * 89_999_999);
  const tag = `E2E Cust ${run}`;
  let categoryId: string;
  const storeIds: string[] = [];
  let storeId: string;
  let farStoreId: string;
  let branchNear: string;
  let branchFar: string;
  let productId: string;

  const api = () => request(app.getHttpServer());
  const customers = new Map<string, { id: string; token: string }>();

  async function customer(name: string) {
    const existing = customers.get(name);
    if (existing) return existing;
    const res = await api()
      .post('/api/v1/auth/dev/customer')
      .send({ name: `${tag} ${name}` })
      .expect(200);
    const created = { id: res.body.user.id, token: res.body.accessToken };
    customers.set(name, created);
    return created;
  }

  /** Claims an offer as a test customer and checks the status code. */
  async function claim(name: string, offerId: string, status?: number) {
    const { token } = await customer(name);
    const res = await api()
      .post(`/api/v1/offers/${offerId}/claim`)
      .set('Authorization', `Bearer ${token}`);
    if (status) expect(res.status, JSON.stringify(res.body)).toBe(status);
    return res;
  }

  async function offer(
    overrides: Partial<{
      storeId: string;
      type: OfferType;
      quantity: number | null;
      offerPrice: string;
      startsAt: Date;
      endsAt: Date;
      maxPerUser: number;
      branchIds: string[];
      title: string;
    }> = {},
  ) {
    const type = overrides.type ?? OfferType.LIMITED;
    const quantity = overrides.quantity === undefined ? 10 : overrides.quantity;
    const sid = overrides.storeId ?? storeId;
    const branchIds =
      overrides.branchIds ??
      (await prisma.branch.findMany({ where: { storeId: sid } })).map(
        (b) => b.id,
      );
    const product =
      sid === storeId
        ? productId
        : (
            await prisma.product.create({
              data: { storeId: sid, title: 'Item', regularPrice: '10' },
            })
          ).id;
    return prisma.offer.create({
      data: {
        storeId: sid,
        productId: product,
        title: overrides.title ?? `${tag} offer`,
        originalPrice: '10.000',
        offerPrice: overrides.offerPrice ?? '5.000',
        type,
        totalQuantity: type === OfferType.LIMITED ? quantity : null,
        remainingQuantity: type === OfferType.LIMITED ? quantity : null,
        maxPerUser: overrides.maxPerUser ?? 1,
        claimWindowMinutes: 60,
        startsAt: overrides.startsAt ?? new Date(Date.now() - 60_000),
        endsAt: overrides.endsAt ?? new Date(Date.now() + 24 * HOUR),
        branches: { create: branchIds.map((branchId) => ({ branchId })) },
      },
    });
  }

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();
    prisma = app.get(PrismaService);

    categoryId = (
      await prisma.category.create({
        data: { slug: `e2e-cust-${run}`, nameAr: 'تجربة', nameEn: 'E2E' },
      })
    ).id;

    const store = await prisma.store.create({
      data: {
        categoryId,
        name: `${tag} Sweets`,
        branches: {
          create: [
            {
              name: 'Near',
              city: 'Tripoli',
              latitude: 32.888,
              longitude: 13.192,
            },
            {
              name: 'Far side',
              city: 'Tripoli',
              latitude: 32.85,
              longitude: 13.05,
            },
          ],
        },
      },
      include: { branches: { orderBy: { name: 'desc' } } },
    });
    storeId = store.id;
    [branchNear, branchFar] = store.branches.map((b) => b.id);

    const far = await prisma.store.create({
      data: {
        categoryId,
        name: `${tag} Benghazi`,
        branches: {
          create: {
            name: 'B',
            city: 'Benghazi',
            latitude: 32.1167,
            longitude: 20.0667,
          },
        },
      },
    });
    farStoreId = far.id;
    const disabled = await prisma.store.create({
      data: {
        categoryId,
        name: `${tag} Disabled`,
        isActive: false,
        branches: {
          create: {
            name: 'D',
            city: 'Tripoli',
            latitude: 32.88,
            longitude: 13.19,
          },
        },
      },
    });
    storeIds.push(storeId, farStoreId, disabled.id);

    productId = (
      await prisma.product.create({
        data: { storeId, title: 'Cake', regularPrice: '10' },
      })
    ).id;
  });

  afterAll(async () => {
    await prisma.store.deleteMany({ where: { id: { in: storeIds } } });
    await prisma.user.deleteMany({
      where: { email: { startsWith: `e2e-cust-${run}` } },
    });
    await prisma.category.deleteMany({ where: { id: categoryId } });
    await app.close();
  });

  describe('browsing', () => {
    let nearOffer: string;
    let hidden: string[];

    beforeAll(async () => {
      nearOffer = (await offer({ offerPrice: '6.000' })).id;
      await offer({ offerPrice: '2.000', title: `${tag} big discount` });
      await offer({ storeId: farStoreId });
      hidden = [
        (await offer({ startsAt: new Date(Date.now() + HOUR) })).id,
        (await offer({ quantity: 0 })).id,
        (await offer({ storeId: storeIds[2] })).id,
      ];
    });

    it('lists live offers near me, closest branch first', async () => {
      const res = await api()
        .get('/api/v1/offers')
        .query({ ...tripoli, categoryId, pageSize: 100 })
        .expect(200);
      const ids = res.body.items.map((o: { id: string }) => o.id);
      expect(ids).toContain(nearOffer);
      for (const id of hidden) expect(ids).not.toContain(id);
      // Benghazi is ~650 km away, outside the default 25 km radius
      expect(
        res.body.items.every(
          (o: { store: { id: string } }) => o.store.id !== farStoreId,
        ),
      ).toBe(true);

      const item = res.body.items.find(
        (o: { id: string }) => o.id === nearOffer,
      );
      expect(item).toMatchObject({
        state: 'LIVE',
        discountPercent: 40,
        offerPrice: '6.000',
        branchCount: 2,
        nearestBranch: { id: branchNear },
      });
      expect(item.nearestBranch.distanceKm).toBeLessThan(1);

      const distances = res.body.items.map(
        (o: { nearestBranch: { distanceKm: number } }) =>
          o.nearestBranch.distanceKm,
      );
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
    });

    it('includes far stores with a big enough radius', async () => {
      const res = await api()
        .get('/api/v1/offers')
        .query({ ...tripoli, categoryId, radiusKm: 100, storeId: farStoreId })
        .expect(200);
      expect(res.body.meta.total).toBe(0);
      const all = await api()
        .get('/api/v1/offers')
        .query({ storeId: farStoreId })
        .expect(200);
      expect(all.body.meta.total).toBe(1);
    });

    it('validates location parameters', async () => {
      await api().get('/api/v1/offers').query({ lat: 32.8 }).expect(400);
      await api().get('/api/v1/offers').query({ sort: 'nearest' }).expect(400);
      await api().get('/api/v1/offers').query({ radiusKm: 10 }).expect(400);
    });

    it('searches and sorts by biggest discount', async () => {
      const res = await api()
        .get('/api/v1/offers')
        .query({
          search: `${tag} Sweets`,
          sort: 'biggest_discount',
          pageSize: 100,
        })
        .expect(200);
      expect(res.body.items.length).toBeGreaterThan(0);
      expect(
        res.body.items.every(
          (o: { store: { id: string } }) => o.store.id === storeId,
        ),
      ).toBe(true);
      expect(res.body.items[0].title).toBe(`${tag} big discount`);
    });

    it('shows offer details with all branches and counts views', async () => {
      const res = await api()
        .get(`/api/v1/offers/${nearOffer}`)
        .query(tripoli)
        .expect(200);
      expect(res.body.branches.map((b: { id: string }) => b.id)).toEqual([
        branchNear,
        branchFar,
      ]);
      expect(res.body.myActiveClaimId).toBeNull();

      await new Promise((resolve) => setTimeout(resolve, 100));
      const stored = await prisma.offer.findUniqueOrThrow({
        where: { id: nearOffer },
      });
      expect(stored.viewCount).toBe(1);
    });

    it('hides scheduled offers and disabled stores', async () => {
      await api().get(`/api/v1/offers/${hidden[0]}`).expect(404);
      await api().get(`/api/v1/offers/${hidden[2]}`).expect(404);
      await api().get(`/api/v1/stores/${storeIds[2]}`).expect(404);
    });

    it('shows the store page with live offers', async () => {
      const res = await api()
        .get(`/api/v1/stores/${storeId}`)
        .query(tripoli)
        .expect(200);
      expect(res.body).toMatchObject({ followerCount: 0, isFollowing: null });
      expect(res.body.branches[0].id).toBe(branchNear);
      const ids = res.body.offers.map((o: { id: string }) => o.id);
      expect(ids).toContain(nearOffer);
      expect(ids).not.toContain(hidden[0]);
    });
  });

  describe('claiming', () => {
    it('needs a customer account', async () => {
      const o = await offer();
      await api().post(`/api/v1/offers/${o.id}/claim`).expect(401);
    });

    it('reserves a piece for the claim window', async () => {
      const o = await offer({ quantity: 2 });
      const res = await claim('alice', o.id, 201);
      expect(res.body).toMatchObject({
        status: 'RESERVED',
        canCancel: true,
        offer: { id: o.id },
      });
      expect(res.body.code).toMatch(/^[A-HJKMNP-Z2-9]{8}$/);
      const minutes =
        (new Date(res.body.expiresAt).getTime() - Date.now()) / 60_000;
      expect(minutes).toBeGreaterThan(59);
      expect(minutes).toBeLessThanOrEqual(60);

      const after = await prisma.offer.findUniqueOrThrow({
        where: { id: o.id },
      });
      expect(after.remainingQuantity).toBe(1);

      const again = await claim('alice', o.id, 409);
      expect(again.body.message).toBe(
        'You already have an active reservation for this offer',
      );

      const { token } = await customer('alice');
      const detail = await api()
        .get(`/api/v1/offers/${o.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(detail.body.myActiveClaimId).toBe(res.body.id);
    });

    it('sells exactly the quantity, even when everyone taps at once', async () => {
      const o = await offer({ quantity: 3 });
      const names = ['r1', 'r2', 'r3', 'r4', 'r5', 'r6'];
      await Promise.all(names.map((n) => customer(n)));
      const results = await Promise.all(
        names.map(async (n) => claim(n, o.id).then((r) => r.status)),
      );

      expect(results.filter((s) => s === 201)).toHaveLength(3);
      expect(results.filter((s) => s === 409)).toHaveLength(3);
      const after = await prisma.offer.findUniqueOrThrow({
        where: { id: o.id },
      });
      expect(after.remainingQuantity).toBe(0);
      expect(await prisma.claim.count({ where: { offerId: o.id } })).toBe(3);
    });

    it('gives a double tap only one claim', async () => {
      const o = await offer({ quantity: 10, maxPerUser: 5 });
      await customer('tapper');
      const results = await Promise.all(
        [1, 2, 3].map(async () => claim('tapper', o.id).then((r) => r.status)),
      );
      expect(results.filter((s) => s === 201)).toHaveLength(1);
      expect(await prisma.claim.count({ where: { offerId: o.id } })).toBe(1);
    });

    it('limits customers to 3 reservations at a time', async () => {
      const offers = await Promise.all([1, 2, 3, 4].map(() => offer()));
      for (const o of offers.slice(0, 3)) await claim('hoarder', o.id, 201);
      const res = await claim('hoarder', offers[3].id, 409);
      expect(res.body.message).toMatch(/at most 3 reservations/);
    });

    it('gives unlimited offers a code valid until the offer ends, up to maxPerUser', async () => {
      const o = await offer({
        type: OfferType.UNLIMITED,
        maxPerUser: 2,
        branchIds: [branchFar],
      });
      const first = await claim('bob', o.id, 201);
      expect(new Date(first.body.expiresAt).getTime()).toBe(o.endsAt.getTime());
      expect(first.body.branches.map((b: { id: string }) => b.id)).toEqual([
        branchFar,
      ]);

      await prisma.claim.update({
        where: { id: first.body.id },
        data: { status: ClaimStatus.REDEEMED },
      });
      const second = await claim('bob', o.id, 201);
      await prisma.claim.update({
        where: { id: second.body.id },
        data: { status: ClaimStatus.REDEEMED },
      });
      const third = await claim('bob', o.id, 409);
      expect(third.body.message).toMatch(/maximum number of times/);
    });

    it('explains why an offer cannot be claimed', async () => {
      const soldOut = await offer({ quantity: 0 });
      expect((await claim('carol', soldOut.id, 409)).body.message).toBe(
        'Sold out',
      );
      const later = await offer({ startsAt: new Date(Date.now() + HOUR) });
      expect((await claim('carol', later.id, 409)).body.message).toBe(
        "This offer hasn't started yet",
      );
      const paused = await offer();
      await prisma.offer.update({
        where: { id: paused.id },
        data: { status: OfferStatus.PAUSED },
      });
      expect((await claim('carol', paused.id, 409)).body.message).toBe(
        'This offer is no longer available',
      );
    });
  });

  describe('my claims', () => {
    it('lists active claims and cancels one, giving the piece back', async () => {
      const o = await offer({ quantity: 5 });
      const myClaim = (await claim('dave', o.id, 201)).body;
      const { token } = await customer('dave');

      const list = await api()
        .get('/api/v1/me/claims')
        .query({ active: 'true' })
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(list.body.items.map((c: { id: string }) => c.id)).toEqual([
        myClaim.id,
      ]);

      const cancelled = await api()
        .post(`/api/v1/me/claims/${myClaim.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);
      expect(cancelled.body).toMatchObject({
        status: 'CANCELLED',
        canCancel: false,
      });
      expect(
        (await prisma.offer.findUniqueOrThrow({ where: { id: o.id } }))
          .remainingQuantity,
      ).toBe(5);

      await api()
        .post(`/api/v1/me/claims/${myClaim.id}/cancel`)
        .set('Authorization', `Bearer ${token}`)
        .expect(409);
    });

    it("hides other customers' claims", async () => {
      const o = await offer();
      const myClaim = (await claim('erin', o.id, 201)).body;
      const { token } = await customer('frank');
      await api()
        .get(`/api/v1/me/claims/${myClaim.id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);
    });
  });

  describe('expiry job', () => {
    it('expires claims, gives pieces back and bans after 3 no-shows', async () => {
      const o = await offer({ quantity: 5 });
      const { id: userId } = await customer('noshow');
      await prisma.user.update({
        where: { id: userId },
        data: { noShowCount: 2 },
      });
      const myClaim = (await claim('noshow', o.id, 201)).body;
      await prisma.claim.update({
        where: { id: myClaim.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });

      const result = await app.get(ClaimsExpiryService).run();
      expect(result.expired).toBeGreaterThanOrEqual(1);

      expect(
        (await prisma.claim.findUniqueOrThrow({ where: { id: myClaim.id } }))
          .status,
      ).toBe(ClaimStatus.EXPIRED);
      expect(
        (await prisma.offer.findUniqueOrThrow({ where: { id: o.id } }))
          .remainingQuantity,
      ).toBe(5);
      const user = await prisma.user.findUniqueOrThrow({
        where: { id: userId },
      });
      expect(user.noShowCount).toBe(3);
      expect(user.claimBannedUntil!.getTime()).toBeGreaterThan(
        Date.now() + 6 * 24 * HOUR,
      );

      const banned = await claim('noshow', (await offer()).id, 403);
      expect(banned.body.error).toBe('ClaimBanned');
    });

    it("doesn't give strikes for unlimited offers", async () => {
      const o = await offer({ type: OfferType.UNLIMITED });
      const { id: userId } = await customer('relaxed');
      const myClaim = (await claim('relaxed', o.id, 201)).body;
      await prisma.claim.update({
        where: { id: myClaim.id },
        data: { expiresAt: new Date(Date.now() - 1000) },
      });
      await app.get(ClaimsExpiryService).run();
      expect(
        (await prisma.user.findUniqueOrThrow({ where: { id: userId } }))
          .noShowCount,
      ).toBe(0);
    });

    it('ends offers whose time is up', async () => {
      const o = await offer();
      await prisma.offer.update({
        where: { id: o.id },
        data: { endsAt: new Date(Date.now() - 1000) },
      });
      await app.get(ClaimsExpiryService).run();
      expect(
        (await prisma.offer.findUniqueOrThrow({ where: { id: o.id } })).status,
      ).toBe(OfferStatus.ENDED);
    });
  });

  describe('following and profile', () => {
    it('follows and unfollows stores', async () => {
      const { token } = await customer('fan');
      const auth = { Authorization: `Bearer ${token}` };
      await api()
        .post(`/api/v1/stores/${storeId}/follow`)
        .set(auth)
        .expect(204);
      await api()
        .post(`/api/v1/stores/${storeId}/follow`)
        .set(auth)
        .expect(204);

      const page = await api()
        .get(`/api/v1/stores/${storeId}`)
        .set(auth)
        .expect(200);
      expect(page.body).toMatchObject({ isFollowing: true, followerCount: 1 });

      const follows = await api()
        .get('/api/v1/me/follows')
        .set(auth)
        .expect(200);
      expect(follows.body).toEqual([
        expect.objectContaining({
          id: storeId,
          liveOfferCount: expect.any(Number),
        }),
      ]);

      await api()
        .delete(`/api/v1/stores/${storeId}/follow`)
        .set(auth)
        .expect(204);
      const after = await api()
        .get(`/api/v1/stores/${storeId}`)
        .set(auth)
        .expect(200);
      expect(after.body).toMatchObject({
        isFollowing: false,
        followerCount: 0,
      });
    });

    it('updates the contact phone', async () => {
      const { token } = await customer('phone');
      const res = await api()
        .patch('/api/v1/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .send({ contactPhone: '091 234 5678' })
        .expect(200);
      expect(res.body.contactPhone).toBe('+218912345678');
    });
  });
});
