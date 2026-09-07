import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class UpdateDto {
    @IsEmail()
    email: string;

    @IsString()
    @MinLength(3)
    @MaxLength(12)
    username: string;

    @IsString()
    @MaxLength(255)
    avatar: string;

    @IsOptional()
    @IsString()
    theme?: string;

    @IsOptional()
    @IsString()
    language?: string;
}
