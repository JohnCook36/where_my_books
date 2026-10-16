import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @IsEmail()
  email!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  password!: string;
}

export class LoginDto extends RegisterDto {}

export class RefreshDto {
  @IsString()
  @MinLength(20)
  refreshToken!: string;
}
