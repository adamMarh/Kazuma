import { ThemeDto } from '@app/model/dto/theme/theme.dto';
import { AuthService } from '@app/services/auth/auth.service';
import { ThemeService } from '@app/services/user/theme.service';
import { Body, Controller, Get, Headers, Post, UnauthorizedException } from '@nestjs/common';

const BEARER_PREFIX_LENGTH = 7;

@Controller('theme')
export class ThemeController {
    constructor(
        private themeService: ThemeService,
        private authService: AuthService,
    ) {}

    @Get('me')
    async getCurrentTheme(@Headers('authorization') authHeader: string): Promise<ThemeDto> {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        const theme = await this.themeService.getTheme(decodedToken.uid);
        return { theme };
    }

    @Post('me')
    async setCurrentTheme(@Headers('authorization') authHeader: string, @Body() dto: ThemeDto): Promise<ThemeDto> {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        await this.themeService.setTheme(decodedToken.uid, dto.theme);
        return { theme: dto.theme };
    }

    @Post('language')
    async setCurrentLanguage(
        @Headers('authorization') authHeader: string,
        @Body() dto: { language: 'en' | 'fr' },
    ): Promise<{ language: 'en' | 'fr' }> {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        await this.themeService.setLanguage(decodedToken.uid, dto.language);
        return { language: dto.language };
    }

    private extractToken(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException('Token invalide');
        }
        return authHeader.substring(BEARER_PREFIX_LENGTH);
    }
}
