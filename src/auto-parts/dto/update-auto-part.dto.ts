import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEnum,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsPositive,
  IsString,
  IsUUID,
  Length,
  MaxLength,
} from 'class-validator';
import { PartCondition } from '../entities/auto-part.entity.js';

export class UpdateAutoPartDto {
  @ApiPropertyOptional({
    description: 'Нова назва автозапчастини',
    example: 'Гальмівні колодки передні Brembo P85020 (комплект)',
    maxLength: 120,
  })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title?: string;

  @ApiPropertyOptional({
    description: 'Нова ціна в гривнях',
    example: 2590,
    minimum: 0.01,
  })
  @IsOptional()
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price?: number;

  @ApiPropertyOptional({
    description: 'Новий OEM-код виробника',
    example: 'P85020X',
    minLength: 6,
    maxLength: 20,
  })
  @IsOptional()
  @IsString()
  @Length(6, 20)
  oemCode?: string;

  @ApiPropertyOptional({
    description: 'Стан деталі після оновлення',
    enum: PartCondition,
    enumName: 'PartCondition',
    example: PartCondition.Refurbished,
  })
  @IsOptional()
  @IsEnum(PartCondition)
  condition?: PartCondition;

  @ApiPropertyOptional({
    description: 'UUID нової сумісної моделі автомобіля',
    format: 'uuid',
    example: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
  })
  @IsOptional()
  @IsUUID()
  carModelId?: string;

  @ApiPropertyOptional({
    description: 'Повний перелік вузлів, що замінює попередній',
    type: [String],
    maxItems: 10,
    example: ['Гальмівна система'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specificationNames?: string[];
}
