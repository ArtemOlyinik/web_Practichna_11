import { IsEmail, IsOptional, IsString, Length, Matches } from 'class-validator';

/**
 * VIN-код містить 17 символів латиниці та цифр без літер I, O, Q.
 * Це стандарт ISO 3779, тому перевіряємо його до звернення до бази.
 */
export const VIN_PATTERN = /^[A-HJ-NPR-Z0-9]{17}$/i;

export class CreatePartRequestDto {
  @IsString()
  @Matches(VIN_PATTERN, {
    message: 'VIN-код має містити 17 символів (латиниця та цифри, без I, O, Q)',
  })
  vinCode!: string;

  @IsEmail({}, { message: 'Некоректна адреса електронної пошти' })
  @Length(5, 254)
  customerEmail!: string;

  @IsString()
  @Length(3, 150)
  requestedPart!: string;

  @IsOptional()
  @IsString()
  @Length(0, 1000)
  description?: string;
}
