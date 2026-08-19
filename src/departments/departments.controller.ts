import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { DepartmentsService } from './departments.service';
import { CreateDepartmentDto, UpdateDepartmentDto } from './dto/department.dto';
import { JwtAuthGuard } from '../auth/jwt.strategy';

@Controller('departments')
export class DepartmentsController {
  constructor(private readonly departmentsService: DepartmentsService) {}

  @Get()
  async listDepartments(
    @Req() req: any,
    @Query('institutionId') institutionId?: string,
  ) {
    return this.departmentsService.listDepartments(req.user, institutionId);
  }

  @Get(':id')
  async getById(@Param('id') id: string) {
    return this.departmentsService.getById(id);
  }

  @UseGuards(JwtAuthGuard)
  @Post()
  async create(@Body() dto: CreateDepartmentDto, @Req() req: any) {
    return this.departmentsService.create(dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Patch(':id')
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateDepartmentDto,
    @Req() req: any,
  ) {
    return this.departmentsService.update(id, dto, req.user);
  }

  @UseGuards(JwtAuthGuard)
  @Delete(':id')
  async delete(@Param('id') id: string, @Req() req: any) {
    return this.departmentsService.delete(id, req.user);
  }
}
