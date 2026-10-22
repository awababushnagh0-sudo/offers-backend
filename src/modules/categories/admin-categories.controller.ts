import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import {
  DASHBOARD_ROLES,
  Roles,
} from '../../common/decorators/roles.decorator.js';
import { CategoriesService } from './categories.service.js';
import {
  CategoryDto,
  CreateCategoryDto,
  UpdateCategoryDto,
} from './dto/category.dto.js';

@ApiTags('Admin: Categories')
@ApiBearerAuth()
@Roles(...DASHBOARD_ROLES)
@Controller('admin/categories')
export class AdminCategoriesController {
  constructor(private readonly categories: CategoriesService) {}

  @Get()
  @ApiOperation({ summary: 'All categories, including hidden ones' })
  list(): Promise<CategoryDto[]> {
    return this.categories.list({ activeOnly: false });
  }

  @Post()
  @ApiOperation({ summary: 'Create a category' })
  create(@Body() dto: CreateCategoryDto): Promise<CategoryDto> {
    return this.categories.create(dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Edit or hide a category' })
  update(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateCategoryDto,
  ): Promise<CategoryDto> {
    return this.categories.update(id, dto);
  }
}
