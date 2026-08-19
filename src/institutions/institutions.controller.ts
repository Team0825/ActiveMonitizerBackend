import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  UseGuards,
  Req,
} from '@nestjs/common';
import { InstitutionsService } from './institutions.service';
import { CreateInstitutionDto, UpdateInstitutionDto } from './dto/institution.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('institutions')
export class InstitutionsController {
  constructor(private readonly institutionsService: InstitutionsService) {}

  @Get('branding')
  async getBranding(@Req() req: any) {
    return this.institutionsService.getBranding(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch('branding')
  async updateBranding(@Body() dto: any, @Req() req: any) {
    return this.institutionsService.updateBranding(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get()
  async listAll(@Req() req: any) {
    return this.institutionsService.listAll(req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.institutionsService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateInstitutionDto, @Req() req: any) {
    return this.institutionsService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateInstitutionDto,
    @Req() req: any,
  ) {
    return this.institutionsService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.institutionsService.delete(id, req.user);
  }
}
