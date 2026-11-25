import {
  Body,
  Controller,
  Delete,
  Get,
  Header,
  HttpCode,
  HttpStatus,
  Logger,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { RequestIdService } from '../shared/request-id.service.js';
import { Public } from '../auth/decorators/public.decorator.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { Role } from '../users/entities/user.entity.js';
import { AutoPartsService } from './auto-parts.service.js';
import { CompatibilityCodeDto } from './dto/create-auto-part-transactional.dto.js';
import { CreateAutoPartDto } from './dto/create-auto-part.dto.js';
import { CreateAutoPartTransactionalDto } from './dto/create-auto-part-transactional.dto.js';
import { PaginationQueryDto } from './dto/pagination-query.dto.js';
import { UpdateAutoPartDto } from './dto/update-auto-part.dto.js';
import { UpdateAutoPartTransactionalDto } from './dto/update-auto-part-transactional.dto.js';

@ApiTags('Автозапчастини та вузли')
@Controller('auto-parts')
export class AutoPartsController {
  private readonly logger = new Logger(AutoPartsController.name);

  constructor(
    private readonly autoPartsService: AutoPartsService,
    private readonly requestIdService: RequestIdService,
  ) {}

  private logRequest(method: string): void {
    this.logger.log(`${method} requestId=${this.requestIdService.getId()}`);
  }

  @Public()
  @Get()
  @Header('X-API-Version', '1.0')
  @Header('X-Service-Status', 'operational')
  @ApiOperation({
    summary: 'Список запчастин із фільтрами та пагінацією',
    description:
      'Публічний маршрут. Підтримує пошук за назвою, фільтр за моделлю авто, ' +
      'вузлом і діапазоном ціни. Повертає дані разом із метаданими пагінації.',
  })
  @ApiResponse({ status: 200, description: 'Сторінка запчастин із метаданими пагінації' })
  @ApiResponse({ status: 400, description: 'Некоректні параметри запиту' })
  findAll(@Query() query: PaginationQueryDto) {
    this.logRequest('GET /auto-parts');
    return this.autoPartsService.findAll(query);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post('transactional')
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Атомарне створення запчастини з кодом сумісності',
    description:
      'Запчастина, код сумісності 1:1 та вузли M:N зберігаються в одній транзакції. ' +
      'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiResponse({ status: 201, description: 'Агрегат запчастини створено' })
  @ApiResponse({ status: 400, description: 'Помилка валідації або відкат транзакції' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Модель авто не знайдена' })
  createTransactional(@Body() dto: CreateAutoPartTransactionalDto) {
    this.logRequest('POST /auto-parts/transactional');
    return this.autoPartsService.createTransactional(dto);
  }

  @Public()
  @Get(':id/aggregate')
  @ApiOperation({
    summary: 'Повний агрегат запчастини',
    description: 'Повертає запчастину разом із моделлю авто, вузлами та кодом сумісності.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Агрегат знайдено' })
  @ApiResponse({ status: 404, description: 'Запчастину не знайдено' })
  findAggregate(@Param('id') id: string) {
    return this.autoPartsService.findAggregate(id);
  }

  @Public()
  @Get(':id')
  @ApiOperation({ summary: 'Запчастина за ідентифікатором' })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Запчастину знайдено' })
  @ApiResponse({ status: 404, description: 'Запчастину не знайдено' })
  findOne(@Param('id') id: string) {
    return this.autoPartsService.findOne(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Post()
  @HttpCode(HttpStatus.CREATED)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Створення нової запчастини',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiResponse({ status: 201, description: 'Запчастину додано до каталогу' })
  @ApiResponse({ status: 400, description: 'Некоректні вхідні дані' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Модель авто не знайдена' })
  create(@Body() createAutoPartDto: CreateAutoPartDto) {
    this.logRequest('POST /auto-parts');
    return this.autoPartsService.create(createAutoPartDto);
  }

  /**
   * Додавання або оновлення 1:1-коду сумісності.
   * Привілейована операція варіанта 7: MECHANIC та ADMIN.
   */
  @Roles(Role.Admin, Role.Mechanic)
  @Post(':id/compatibility-code')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Створення або оновлення коду сумісності',
    description:
      'Якщо код для запчастини вже існує, він оновлюється. Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 201, description: 'Код сумісності збережено' })
  @ApiResponse({ status: 400, description: 'Некоректні дані коду' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Запчастину не знайдено' })
  upsertCompatibilityCode(
    @Param('id') id: string,
    @Body() dto: CompatibilityCodeDto,
  ) {
    this.logRequest('POST /auto-parts/:id/compatibility-code');
    return this.autoPartsService.upsertCompatibilityCode(id, dto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Patch(':id/restore')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Відновлення мʼяко видаленої запчастини',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Запчастину відновлено' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Запчастину не знайдено' })
  restore(@Param('id') id: string) {
    return this.autoPartsService.restore(id);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Put(':id/transactional')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Повне оновлення агрегата в транзакції',
    description:
      'Оновлює поля запчастини, модель авто, вузли та код сумісності атомарно. ' +
      'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Агрегат оновлено' })
  @ApiResponse({ status: 400, description: 'Помилка валідації або відкат транзакції' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Запчастину або модель не знайдено' })
  updateTransactional(
    @Param('id') id: string,
    @Body() dto: UpdateAutoPartTransactionalDto,
  ) {
    this.logRequest('PUT /auto-parts/:id/transactional');
    return this.autoPartsService.updateTransactional(id, dto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Patch(':id')
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Часткове оновлення запчастини',
    description: 'Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 200, description: 'Запчастину оновлено' })
  @ApiResponse({ status: 400, description: 'Некоректні вхідні дані' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Запчастину або модель не знайдено' })
  update(
    @Param('id') id: string,
    @Body() updateAutoPartDto: UpdateAutoPartDto,
  ) {
    return this.autoPartsService.update(id, updateAutoPartDto);
  }

  @Roles(Role.Admin, Role.Mechanic)
  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiBearerAuth()
  @ApiOperation({
    summary: 'Мʼяке видалення запчастини',
    description: 'Запис залишається в базі з позначкою deletedAt. Доступно ролям ADMIN і MECHANIC.',
  })
  @ApiParam({ name: 'id', description: 'UUID запчастини', format: 'uuid' })
  @ApiResponse({ status: 204, description: 'Запчастину видалено' })
  @ApiResponse({ status: 401, description: 'Токен відсутній або недійсний' })
  @ApiResponse({ status: 403, description: 'Недостатньо прав' })
  @ApiResponse({ status: 404, description: 'Запчастину не знайдено' })
  async remove(@Param('id') id: string): Promise<void> {
    await this.autoPartsService.remove(id);
  }
}
