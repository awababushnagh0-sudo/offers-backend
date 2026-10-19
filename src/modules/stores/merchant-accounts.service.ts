import { ConflictException, Injectable } from '@nestjs/common';
import { generateTemporaryPassword } from '../../common/utils/temporary-password.js';
import { PrismaService } from '../../database/prisma.service.js';
import type { Prisma, User } from '../../generated/prisma/client.js';
import { UserRole } from '../../generated/prisma/enums.js';
import { PasswordService } from '../auth/password.service.js';
import type { NewMerchantDto } from './dto/store-requests.dto.js';

/** A merchant account that will be created (or reused) inside a transaction. */
export interface PreparedMerchant {
  existing: User | null;
  phone: string;
  name: string;
  temporaryPassword: string | null;
  passwordHash: string | null;
}

/**
 * Merchant accounts are identified by phone. One person can own or work at
 * several stores, so an existing merchant is linked instead of duplicated.
 */
@Injectable()
export class MerchantAccountsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
  ) {}

  /** Runs before the transaction, since hashing a password is slow. */
  async prepare({ name, phone }: NewMerchantDto): Promise<PreparedMerchant> {
    const existing = await this.prisma.user.findUnique({ where: { phone } });
    if (existing && existing.role !== UserRole.MERCHANT) {
      throw new ConflictException(
        'This phone number belongs to a non-merchant account',
      );
    }
    if (existing) {
      return {
        existing,
        phone,
        name,
        temporaryPassword: null,
        passwordHash: null,
      };
    }
    const temporaryPassword = generateTemporaryPassword();
    return {
      existing: null,
      phone,
      name,
      temporaryPassword,
      passwordHash: await this.passwords.hash(temporaryPassword),
    };
  }

  async findOrCreate(
    tx: Prisma.TransactionClient,
    prepared: PreparedMerchant,
  ): Promise<User> {
    if (prepared.existing) return prepared.existing;
    return tx.user.create({
      data: {
        role: UserRole.MERCHANT,
        name: prepared.name,
        phone: prepared.phone,
        passwordHash: prepared.passwordHash,
        mustChangePassword: true,
      },
    });
  }
}
