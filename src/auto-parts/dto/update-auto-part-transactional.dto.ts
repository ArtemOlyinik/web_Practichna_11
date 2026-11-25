import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsBoolean, IsOptional, ValidateNested } from 'class-validator';
import { CompatibilityCodeDto } from './create-auto-part-transactional.dto.js';
import { UpdateAutoPartDto } from './update-auto-part.dto.js';

export class UpdateAutoPartTransactionalDto extends UpdateAutoPartDto {
  @ApiPropertyOptional({
    description:
      'Нові дані коду сумісності. Наявний запис оновлюється, відсутній створюється',
    type: () => CompatibilityCodeDto,
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => CompatibilityCodeDto)
  compatibilityCode?: CompatibilityCodeDto;

  @ApiPropertyOptional({
    description:
      'Службовий прапорець для демонстрації відкату транзакції після збереження',
    example: false,
    default: false,
  })
  @IsOptional()
  @IsBoolean()
  simulateFailure?: boolean;
}
