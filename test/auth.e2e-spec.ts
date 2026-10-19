import { INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import request from 'supertest';
import { AppModule } from './../src/app.module.js';
import { PrismaService } from './../src/database/prisma.service.js';
import { UserRole } from './../src/generated/prisma/enums.js';
import { PasswordService } from './../src/modules/auth/password.service.js';
import { configureApp } from './../src/setup/app.setup.js';

// Uses its own users (random phone/email) and deletes them afterwards.
describe('Auth (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const suffix = Math.floor(10_000_000 + Math.random() * 89_999_999);
  const merchant = {
    phone: `+2189${suffix}`,
    localPhone: `09${suffix}`,
    password: 'Correct-Password-1',
  };
  const devCustomerName = `E2E Customer ${suffix}`;
  const devCustomerEmail = `e2e-customer-${suffix}@dev.local`;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    configureApp(app);
    await app.init();

    prisma = app.get(PrismaService);
    const passwords = app.get(PasswordService);
    await prisma.user.create({
      data: {
        role: UserRole.MERCHANT,
        name: 'E2E Merchant',
        phone: merchant.phone,
        passwordHash: await passwords.hash(merchant.password),
        mustChangePassword: true,
      },
    });
  });

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: { OR: [{ phone: merchant.phone }, { email: devCustomerEmail }] },
    });
    await app.close();
  });

  const login = (password = merchant.password) =>
    api()
      .post('/api/v1/auth/login')
      .send({ identifier: merchant.localPhone, password });

  it('rejects a wrong password', async () => {
    const res = await login('wrong-password').expect(401);
    expect(res.body.message).toBe('Wrong phone/email or password');
  });

  it('rejects unknown phone numbers with the same message', async () => {
    const res = await api()
      .post('/api/v1/auth/login')
      .send({ identifier: '0999999999', password: 'whatever' })
      .expect(401);
    expect(res.body.message).toBe('Wrong phone/email or password');
  });

  it('validates the request body', async () => {
    const res = await api().post('/api/v1/auth/login').send({}).expect(400);
    expect(Array.isArray(res.body.message)).toBe(true);
  });

  it('logs in a merchant with a local phone format and returns tokens', async () => {
    const res = await login().expect(200);
    expect(res.body.accessToken).toEqual(expect.any(String));
    expect(res.body.refreshToken).toEqual(expect.any(String));
    expect(res.body.user).toMatchObject({
      role: 'MERCHANT',
      phone: merchant.phone,
      mustChangePassword: true,
    });
    expect(res.body.user.passwordHash).toBeUndefined();
  });

  it('requires a token for /auth/me', async () => {
    await api().get('/api/v1/auth/me').expect(401);
    await api()
      .get('/api/v1/auth/me')
      .set('Authorization', 'Bearer not-a-real-token')
      .expect(401);
  });

  it('returns the current user from /auth/me', async () => {
    const { body } = await login().expect(200);
    const res = await api()
      .get('/api/v1/auth/me')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .expect(200);
    expect(res.body).toMatchObject({ role: 'MERCHANT', memberships: [] });
  });

  it('rotates refresh tokens and rejects the old one', async () => {
    const { body: first } = await login().expect(200);

    const { body: second } = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);
    expect(second.refreshToken).not.toBe(first.refreshToken);

    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);

    // Within the grace period the reuse is treated as a retry:
    // the new token keeps working.
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(200);
  });

  it('logs out everywhere when an old refresh token is reused later', async () => {
    const { body: first } = await login().expect(200);
    const { body: second } = await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(200);

    // Pretend the first token was rotated a while ago.
    await prisma.refreshToken.updateMany({
      where: { replacedById: { not: null }, user: { phone: merchant.phone } },
      data: { revokedAt: new Date(Date.now() - 60_000) },
    });

    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: first.refreshToken })
      .expect(401);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: second.refreshToken })
      .expect(401);
  });

  it('logout revokes the refresh token', async () => {
    const { body } = await login().expect(200);
    await api()
      .post('/api/v1/auth/logout')
      .send({ refreshToken: body.refreshToken })
      .expect(204);
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(401);
  });

  it('changes the password and clears mustChangePassword', async () => {
    const { body } = await login().expect(200);
    const newPassword = 'New-Password-2';
    const res = await api()
      .post('/api/v1/auth/change-password')
      .set('Authorization', `Bearer ${body.accessToken}`)
      .send({ currentPassword: merchant.password, newPassword })
      .expect(200);
    expect(res.body.user.mustChangePassword).toBe(false);

    // Old sessions are logged out
    await api()
      .post('/api/v1/auth/refresh')
      .send({ refreshToken: body.refreshToken })
      .expect(401);

    await login(newPassword).expect(200);
    merchant.password = newPassword;
  });

  it('dev customer login creates a customer (non-production only)', async () => {
    const res = await api()
      .post('/api/v1/auth/dev/customer')
      .send({ name: devCustomerName })
      .expect(200);
    expect(res.body.user).toMatchObject({
      role: 'CUSTOMER',
      email: devCustomerEmail,
    });
  });

  it('rejects invalid Google tokens', async () => {
    const res = await api()
      .post('/api/v1/auth/google')
      .send({ idToken: 'not-a-real-token' });
    // 503 until GOOGLE_CLIENT_IDS is configured, 401 after.
    expect([401, 503]).toContain(res.status);
  });
});
