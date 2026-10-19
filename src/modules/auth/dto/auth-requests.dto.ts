import {
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

export class GoogleSignInDto {
  /** ID token from Google Sign-In on the device. */
  @IsString()
  @IsNotEmpty()
  idToken: string;
}

export class AppleSignInDto {
  /** Identity token from Sign in with Apple on the device. */
  @IsString()
  @IsNotEmpty()
  idToken: string;

  /** Apple only gives the name on the very first sign-in, so the app sends it. */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}

export class LoginDto {
  /**
   * Phone number (merchants) or email (admins).
   * @example "0910000001"
   */
  @IsString()
  @IsNotEmpty()
  @MaxLength(254)
  identifier: string;

  /** @example "Merchant123!" */
  @IsString()
  @IsNotEmpty()
  @MaxLength(128)
  password: string;
}

export class RefreshTokenDto {
  @IsString()
  @IsNotEmpty()
  refreshToken: string;
}

export class ChangePasswordDto {
  @IsString()
  @IsNotEmpty()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword: string;
}

export class DevCustomerLoginDto {
  /**
   * Any name; the same name always logs into the same test customer.
   * @example "Test Customer"
   */
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;
}
