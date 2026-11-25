import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CatalogService } from './catalog.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import { CreateCarModelDto } from './dto/create-car-model.dto.js';
import { CreateSpecificationDto } from './dto/create-specification.dto.js';

@ApiTags('Довідники')
@Controller()
export class CatalogController {
  constructor(private readonly catalogService: CatalogService) {}

  @Public()
  @Get('car-models')
  @ApiOperation({ summary: 'Довідник моделей автомобілів' })
  @ApiResponse({ status: 200, description: 'Список моделей із марками та роками випуску' })
  findCarModels() {
    return this.catalogService.findAllCarModels();
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Delete('car-models/:id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Видалення моделі автомобіля',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID моделі', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Модель видалено' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Модель не знайдена' })
  async removeCarModel(@Param('id') id: string): Promise<void> {
    await this.catalogService.removeCarModel(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('car-models')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Додавання моделі автомобіля',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiResponse({ status: 201, description: 'Модель створено' })
  @ApiResponse({ status: 400, description: 'Некоректні дані моделі' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  createCarModel(@Body() dto: CreateCarModelDto) {
    return this.catalogService.createCarModel(dto);
  }

  @Public()
  @Get('specifications')
  @ApiOperation({ summary: 'Довідник вузлів і агрегатів' })
  @ApiResponse({ status: 200, description: 'Список вузлів із описами' })
  findSpecifications() {
    return this.catalogService.findAllSpecifications();
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('specifications')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Додавання вузла або агрегата',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiResponse({ status: 201, description: 'Вузол створено' })
  @ApiResponse({ status: 400, description: 'Некоректні дані вузла' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  createSpecification(@Body() dto: CreateSpecificationDto) {
    return this.catalogService.createSpecification(dto);
  }
}
