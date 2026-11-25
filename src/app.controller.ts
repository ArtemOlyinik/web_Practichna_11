import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Public } from './auth/decorators/public.decorator.js';
import { AppService } from './app.service.js';

@ApiTags('Службові')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Public()
  @Get()
  @ApiOperation({ summary: 'Перевірка працездатності сервісу' })
  @ApiResponse({ status: 200, description: 'Сервіс відповідає' })
  getHello(): string {
    return this.appService.getHello();
  }
}
