import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { LicensingService } from './licensing.service';
import { ActivateLicenseDto, ValidateLicenseDto, CreateLicenseDto } from './dto/license.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('licensing')
export class LicensingController {
  constructor(private readonly licensingService: LicensingService) {}

  /**
   * Public/Protected: Get licensing status
   */
  @Get('status')
  async getStatus(
    @Query('machineFingerprint') machineFingerprint?: string,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.licensingService.getStatus(machineFingerprint, institutionId);
  }

  /**
   * Public/Staff: Activate license with machine fingerprint
   */
  @Post('activate')
  async activate(@Body() dto: ActivateLicenseDto) {
    return this.licensingService.activate(dto);
  }

  /**
   * Public/Staff: Validate existing activation
   */
  @Post('validate')
  async validate(@Body() dto: ValidateLicenseDto) {
    return this.licensingService.refresh(dto.activationKey || '', dto.machineFingerprint);
  }

  /**
   * Protected: Refresh license
   */
  @UseGuards(JwtAuthGuard)
  @Post('refresh')
  async refresh(@Body() body: { activationKey: string; machineFingerprint: string }) {
    return this.licensingService.refresh(body.activationKey, body.machineFingerprint);
  }

  /**
   * Protected (Admin/Super Admin): List licenses
   */
  @UseGuards(JwtAuthGuard)
  @Get('all')
  async listAll(@Req() req: any) {
    return this.licensingService.listAll(req.user);
  }

  /**
   * Protected (Super Admin only): Create new license
   */
  @UseGuards(JwtAuthGuard)
  @Post('create')
  async create(@Body() dto: CreateLicenseDto, @Req() req: any) {
    return this.licensingService.create(dto, req.user);
  }

  /**
   * Protected (Super Admin only): Deactivate / Reassign license
   */
  @UseGuards(JwtAuthGuard)
  @Post('deactivate')
  async deactivate(
    @Body() body: { licenseId?: string; licenseNumber?: string; resetMachineBinding?: boolean },
    @Req() req: any,
  ) {
    const identifier = body.licenseId || body.licenseNumber;
    return this.licensingService.deactivate(identifier || '', !!body.resetMachineBinding, req.user);
  }
}
