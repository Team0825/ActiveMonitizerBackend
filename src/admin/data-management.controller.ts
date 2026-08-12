import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { JwtPayload } from '../auth/jwt.strategy';
import { Roles, RolesGuard } from '../auth/roles.guard';
import { DataManagementService } from './data-management.service';

type AuthenticatedRequest = Request & { user: JwtPayload };

@Controller('admin/data')
@UseGuards(RolesGuard)
@Roles('ADMIN')
export class DataManagementController {
  constructor(private readonly dataService: DataManagementService) {}

  @Post('clear-cache')
  clearCache() {
    return this.dataService.clearCache();
  }

  @Get('categories')
  getCategories() {
    return this.dataService.getDataCategories();
  }

  @Post('clear-data')
  clearData(
    @Req() req: AuthenticatedRequest,
    @Body() dto: { categories: string[]; reason?: string },
  ) {
    return this.dataService.initiateClearData(req.user.sub, dto.categories, dto.reason);
  }

  @Get('recovery')
  getRecoveryList() {
    return this.dataService.getRecoveryWindowList();
  }

  @Post('restore/:id')
  restoreBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.dataService.restoreBatch(id, req.user.sub);
  }

  @Delete('permanent/:id')
  permanentDeleteBatch(
    @Req() req: AuthenticatedRequest,
    @Param('id') id: string,
  ) {
    return this.dataService.permanentDeleteNow(id, req.user.sub);
  }
}
