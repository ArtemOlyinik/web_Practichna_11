import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsNotEmpty,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Електронна пошта нового користувача',
    example: 'new.driver@autoparts.local',
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Некоректна електронна пошта' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    description:
      'Пароль від 6 до 72 символів, обовʼязково з літерою та цифрою',
    example: 'Driver12345',
    minLength: 6,
    maxLength: 72,
  })
  @IsString()
  @IsNotEmpty()
  @MinLength(6, { message: 'Пароль має містити щонайменше 6 символів' })
  @MaxLength(72, { message: 'Пароль не може бути довшим за 72 символи' })
  @Matches(/^(?=.*[A-Za-z])(?=.*\d).+$/, {
    message: 'Пароль має містити принаймні одну літеру та одну цифру',
  })
  password!: string;
}
