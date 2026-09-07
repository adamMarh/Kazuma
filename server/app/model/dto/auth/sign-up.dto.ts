import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class SignUpDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(6)
    password: string;

    @IsString()
    @MinLength(3)
    @MaxLength(12)
    username: string;

    @IsString()
    @MaxLength(255)
    avatar: string;
}
