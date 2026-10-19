import {
  Body,
  Controller,
  Get,
  Headers,
  HttpCode,
  HttpStatus,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNoContentResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/auth/auth-user.js';
import { AllowTemporaryPassword } from '../../common/decorators/allow-temporary-password.decorator.js';
import { CurrentUser } from '../../common/decorators/current-user.decorator.js';
import { Public } from '../../common/decorators/public.decorator.js';
import { AuthProvider } from '../../generated/prisma/enums.js';
import { AuthService } from './auth.service.js';
import {
  AppleSignInDto,
  ChangePasswordDto,
  DevCustomerLoginDto,
  GoogleSignInDto,
  LoginDto,
  RefreshTokenDto,
} from './dto/auth-requests.dto.js';
import { AuthResponseDto, MeDto } from './dto/auth-responses.dto.js';
import { SocialTokenVerifier } from './social-token.verifier.js';

const MINUTE_MS = 60_000;

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly socialTokens: SocialTokenVerifier,
  ) {}

  @Public()
  @Post('google')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  @ApiOperation({ summary: 'Customer sign-in with a Google ID token' })
  async google(
    @Body() dto: GoogleSignInDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    const profile = await this.socialTokens.verifyGoogle(dto.idToken);
    return this.auth.signInWithSocial(AuthProvider.GOOGLE, profile, userAgent);
  }

  @Public()
  @Post('apple')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 10, ttl: MINUTE_MS } })
  @ApiOperation({ summary: 'Customer sign-in with an Apple identity token' })
  async apple(
    @Body() dto: AppleSignInDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    const profile = await this.socialTokens.verifyApple(dto.idToken);
    return this.auth.signInWithSocial(
      AuthProvider.APPLE,
      { ...profile, name: dto.name },
      userAgent,
    );
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: 'Merchant (phone) or admin (email) login with a password',
  })
  login(
    @Body() dto: LoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.loginWithPassword(dto.identifier, dto.password, userAgent);
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @Throttle({ default: { limit: 30, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: 'Get a new access token. The refresh token is replaced too.',
  })
  refresh(
    @Body() dto: RefreshTokenDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.refresh(dto.refreshToken, userAgent);
  }

  @Public()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Log out this device (revokes the refresh token)' })
  @ApiNoContentResponse()
  logout(@Body() dto: RefreshTokenDto): Promise<void> {
    return this.auth.logout(dto.refreshToken);
  }

  @Get('me')
  @ApiBearerAuth()
  @AllowTemporaryPassword()
  @ApiOperation({ summary: 'The logged-in user and the stores they work at' })
  me(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.auth.me(user.id);
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @AllowTemporaryPassword()
  @Throttle({ default: { limit: 5, ttl: MINUTE_MS } })
  @ApiOperation({
    summary: 'Change password (logs out other devices, returns new tokens)',
  })
  changePassword(
    @CurrentUser() user: AuthUser,
    @Body() dto: ChangePasswordDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.changePassword(
      user.id,
      dto.currentPassword,
      dto.newPassword,
      userAgent,
    );
  }

  @Public()
  @Post('dev/customer')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary:
      'DEVELOPMENT ONLY: log in as a test customer (404 unless DEV_AUTH_ENABLED=true)',
  })
  devCustomer(
    @Body() dto: DevCustomerLoginDto,
    @Headers('user-agent') userAgent?: string,
  ): Promise<AuthResponseDto> {
    return this.auth.devCustomerLogin(dto.name, userAgent);
  }
}
