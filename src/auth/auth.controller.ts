import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { CookieOptions, Request, Response } from 'express';
import { AuthService, type PublicUser } from './auth.service.js';
import { CurrentUser } from './decorators/current-user.decorator.js';
import { Public } from './decorators/public.decorator.js';
import { LoginDto } from './dto/login.dto.js';
import { RegisterDto } from './dto/register.dto.js';
import type { AuthenticatedUser } from './types/authenticated-user.js';

const REFRESH_COOKIE = 'refreshToken';
const REFRESH_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

type RequestWithCookies = Request & {
  cookies?: Record<string, string | undefined>;
};

@ApiTags('Автентифікація')
@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Public()
  @Post('register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({
    summary: 'Реєстрація покупця',
    description: 'Створює користувача з роллю DRIVER. Пароль зберігається у вигляді bcrypt-хешу.',
  })
  @ApiResponse({ status: 201, description: 'Користувача створено' })
  @ApiResponse({ status: 400, description: 'Некоректні дані або пошта вже зайнята' })
  register(@Body() dto: RegisterDto): Promise<PublicUser> {
    return this.authService.register(dto);
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Вхід у систему',
    description:
      'Повертає access-токен у тілі відповіді та встановлює refresh-токен в httpOnly-cookie. ' +
      'Отриманий accessToken вставляють у кнопку Authorize.',
  })
  @ApiResponse({ status: 200, description: 'Access-токен і профіль користувача' })
  @ApiResponse({ status: 401, description: 'Невірна пошта або пароль' })
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string; user: PublicUser }> {
    const { accessToken, refreshToken, user } =
      await this.authService.login(dto);

    res.cookie(REFRESH_COOKIE, refreshToken, this.refreshCookieOptions());

    return { accessToken, user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Оновлення access-токена',
    description: 'Бере refresh-токен із httpOnly-cookie і повертає нову пару токенів.',
  })
  @ApiResponse({ status: 200, description: 'Новий access-токен' })
  @ApiResponse({ status: 401, description: 'Refresh-токен відсутній або недійсний' })
  async refresh(
    @Req() req: RequestWithCookies,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshToken = req.cookies?.[REFRESH_COOKIE];
    if (!refreshToken) {
      throw new UnauthorizedException('Refresh token відсутній');
    }

    const tokens = await this.authService.refresh(refreshToken);
    res.cookie(REFRESH_COOKIE, tokens.refreshToken, this.refreshCookieOptions());

    return { accessToken: tokens.accessToken };
  }

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Профіль поточного користувача' })
  @ApiResponse({ status: 200, description: 'Дані профілю без хешів пароля й токена' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  me(@CurrentUser() user: AuthenticatedUser): Promise<PublicUser> {
    return this.authService.getProfile(user.id);
  }

  @Post('logout')
  @HttpCode(HttpStatus.OK)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Вихід із системи',
    description: 'Скидає збережений refresh-токен і очищає cookie.',
  })
  @ApiResponse({ status: 200, description: 'Сесію завершено' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  async logout(
    @CurrentUser('id') userId: string,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ message: string }> {
    await this.authService.logout(userId);
    res.clearCookie(REFRESH_COOKIE, { path: '/auth' });
    return { message: 'Сесію завершено' };
  }

  private refreshCookieOptions(): CookieOptions {
    return {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/auth',
      maxAge: REFRESH_COOKIE_MAX_AGE_MS,
    };
  }
}
