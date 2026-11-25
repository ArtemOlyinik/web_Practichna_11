import {
  IsEnum,
  IsOptional,
  IsString,
  IsUUID,
  Length,
} from 'class-validator';
import { PartRequestStatus } from '../entities/part-request.entity.js';

export class UpdatePartRequestStatusDto {
  @IsEnum(PartRequestStatus, {
    message: `Статус має бути одним із: ${Object.values(PartRequestStatus).join(', ')}`,
  })
  status!: PartRequestStatus;

  @IsOptional()
  @IsUUID('4', { message: 'Ідентифікатор запчастини має бути UUID v4' })
  foundPartId?: string;

  @IsOptional()
  @IsString()
  @Length(0, 500)
  managerNote?: string;

  /**
   * Дозволяє менеджеру надіслати лист на іншу адресу, ніж та, що в заявці.
   * У реальній системі поле закрите для клієнта і використовується лише персоналом.
   */
  @IsOptional()
  @IsString()
  @Length(5, 254)
  customerEmail?: string;
}
