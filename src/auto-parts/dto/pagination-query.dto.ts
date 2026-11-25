import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class PaginationQueryDto {
  @ApiPropertyOptional({
    description: 'Номер сторінки, починаючи з 1',
    example: 1,
    default: 1,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page: number = 1;

  @ApiPropertyOptional({
    description: 'Кількість записів на сторінці',
    example: 10,
    default: 10,
    minimum: 1,
  })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  limit: number = 10;

  @ApiPropertyOptional({
    description: 'Пошук за назвою запчастини без урахування регістру',
    example: 'колодки',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({
    description: 'Фільтр за маркою або назвою сумісної моделі авто',
    example: 'Toyota',
  })
  @IsOptional()
  @IsString()
  carModel?: string;

  @ApiPropertyOptional({
    description: 'Фільтр за назвою вузла або агрегата',
    example: 'Гальмівна система',
  })
  @IsOptional()
  @IsString()
  specification?: string;

  @ApiPropertyOptional({
    description: 'Мінімальна ціна в гривнях',
    example: 1000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  minPrice?: number;

  @ApiPropertyOptional({
    description: 'Максимальна ціна в гривнях',
    example: 5000,
    minimum: 0,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  maxPrice?: number;
}
