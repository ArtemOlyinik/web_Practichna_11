import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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

export class CreateAutoPartDto {
  @ApiProperty({
    description: 'Назва автозапчастини разом із виробником',
    example: 'Гальмівні колодки передні Brembo P85020',
    maxLength: 120,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  title!: string;

  @ApiProperty({
    description: 'Ціна в гривнях, додатне число з двома знаками після коми',
    example: 2450.5,
    minimum: 0.01,
  })
  @IsNumber({ maxDecimalPlaces: 2 })
  @IsPositive()
  price!: number;

  @ApiProperty({
    description: 'OEM-код виробника, від 6 до 20 символів',
    example: 'P85020',
    minLength: 6,
    maxLength: 20,
  })
  @IsString()
  @Length(6, 20)
  oemCode!: string;

  @ApiProperty({
    description: 'Стан деталі: нова або відновлена',
    enum: PartCondition,
    enumName: 'PartCondition',
    example: PartCondition.New,
  })
  @IsEnum(PartCondition)
  condition!: PartCondition;

  @ApiProperty({
    description: 'UUID сумісної моделі автомобіля з довідника /car-models',
    format: 'uuid',
    example: '3f1c2b7a-9d4e-4a61-8b2f-1c7d5e9a0b3c',
  })
  @IsUUID()
  carModelId!: string;

  @ApiPropertyOptional({
    description:
      'Назви вузлів і агрегатів. Наявні підключаються, відсутні створюються автоматично',
    type: [String],
    maxItems: 10,
    example: ['Гальмівна система', 'Підвіска'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(10)
  @IsString({ each: true })
  @MaxLength(100, { each: true })
  specificationNames?: string[];
}
