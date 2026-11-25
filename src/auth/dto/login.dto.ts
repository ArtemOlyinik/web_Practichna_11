import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({
    description: 'Електронна пошта зареєстрованого користувача',
    example: 'mechanic@autoparts.local',
    maxLength: 254,
  })
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail({}, { message: 'Некоректна електронна пошта' })
  @MaxLength(254)
  email!: string;

  @ApiProperty({
    description: 'Пароль користувача',
    example: 'Mechanic12345',
    maxLength: 72,
  })
  @IsString()
  @IsNotEmpty({ message: 'Пароль є обовʼязковим' })
  @MaxLength(72)
  password!: string;
}
