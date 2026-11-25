import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsBoolean,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import { CreateAutoPartDto } from './create-auto-part.dto.js';

export class CompatibilityCodeDto {
  @ApiProperty({
    description: 'OEM-код сумісності, від 4 до 60 символів',
    example: 'P85020-OEM',
    minLength: 4,
    maxLength: 60,
  })
  @IsString()
  @Length(4, 60)
  code!: string;

  @ApiProperty({
    description: 'Виробник, який підтверджує взаємозамінність',
    example: 'Brembo',
    maxLength: 100,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  manufacturer!: string;

  @ApiPropertyOptional({
    description: 'Чи можна замінити деталь на аналог іншого виробника',
    example: true,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  isInterchangeable?: boolean;

  @ApiPropertyOptional({
    description: 'Додаткові примітки менеджера щодо сумісності',
    example: 'Підходить лише для передньої осі з вентильованими дисками',
    maxLength: 500,
  })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class CreateAutoPartTransactionalDto extends CreateAutoPartDto {
  @ApiPropertyOptional({
    description:
      'Код сумісності 1:1, який зберігається в тій самій транзакції, що й запчастина',
    type: () => CompatibilityCodeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompatibilityCodeDto)
  compatibilityCode?: CompatibilityCodeDto;

  /**
   * Імітація збою бізнес-логіки після збереження частини даних.
   * Використовується для демонстрації відкату транзакції.
   */
  @ApiPropertyOptional({
    description:
      'Службовий прапорець: імітує збій після часткового збереження, щоб показати відкат транзакції',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
