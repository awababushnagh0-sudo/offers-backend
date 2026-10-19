import { Injectable } from '@nestjs/common';
import { hash, verify } from '@node-rs/argon2';

@Injectable()
export class PasswordService {
  // Verified against when the user doesn't exist, so a wrong phone number
  // takes as long as a wrong password and doesn't reveal which accounts exist.
  private dummyHash?: Promise<string>;

  hash(password: string): Promise<string> {
    return hash(password);
  }

  async verify(passwordHash: string | null | undefined, password: string) {
    if (!passwordHash) {
      this.dummyHash ??= hash('dummy-password-for-timing');
      await verify(await this.dummyHash, password);
      return false;
    }
    return verify(passwordHash, password);
  }
}
