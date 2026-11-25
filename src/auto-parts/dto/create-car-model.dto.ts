import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export class CreateCarModelDto {
  @ApiProperty({
    description: 'Назва моделі автомобіля',
    example: 'Camry XV70',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiProperty({
    description: 'Марка автомобіля',
    example: 'Toyota',
    maxLength: 80,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(80)
  brand!: string;

  @ApiProperty({
    description: 'Рік початку випуску моделі',
    example: 2017,
    minimum: 1950,
    maximum: 2100,
  })
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearFrom!: number;

  @ApiPropertyOptional({
    description: 'Рік завершення випуску. Для моделей, що випускаються досі, не вказується',
    example: 2024,
    minimum: 1950,
    maximum: 2100,
  })
  @IsOptional()
  @IsInt()
  @Min(1950)
  @Max(2100)
  yearTo?: number;
}
