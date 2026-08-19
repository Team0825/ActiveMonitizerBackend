import { Body, Controller, Get, HttpCode, Post, Req, UseGuards } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Throttle } from '@nestjs/throttler';
import { Request } from 'express';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { ChangePasswordDto } from './dto/change-password.dto';
import { JwtPayload } from './jwt.strategy';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  // Rate-limited: this is the single most attacked endpoint in the whole system.
  @Throttle({ default: { limit: 5, ttl: 60_000 } })
  @Post('login')
  @HttpCode(200)
  async login(@Body() dto: LoginDto) {
    return this.authService.login(dto);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('keep-session')
  @HttpCode(200)
  async keepSession(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { challengeId?: string },
  ) {
    return this.authService.keepSession(req.user.sub, dto.challengeId);
  }

  @Post('check-challenge')
  @HttpCode(200)
  async checkChallenge(@Body() dto: { challengeId: string }) {
    return this.authService.checkChallengeStatus(dto.challengeId);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('change-password')
  @HttpCode(200)
  async changePassword(@Req() req: AuthenticatedRequest, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(
      req.user.sub,
      dto.currentPassword,
      dto.newPassword,
      dto.confirmPassword,
    );
  }

  @UseGuards(AuthGuard('jwt'))
  @Get('me')
  async getProfileGet(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @HttpCode(200)
  @Post('me')
  async getProfilePost(@Req() req: AuthenticatedRequest) {
    return this.authService.getProfile(req.user.sub);
  }

  @UseGuards(AuthGuard('jwt'))
  @Post('update-profile')
  @HttpCode(200)
  async updateProfile(
    @Req() req: AuthenticatedRequest,
    @Body() body: { name?: string; email?: string; mobile?: string },
  ) {
    return this.authService.updateProfile(req.user.sub, body);
  }
}

