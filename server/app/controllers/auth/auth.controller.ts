import { SignInDto } from '@app/model/dto/auth/sign-in.dto';
import { SignUpDto } from '@app/model/dto/auth/sign-up.dto';
import { UpdateDto } from '@app/model/dto/auth/update-profile.dto';
import { AuthResponse, AuthService } from '@app/services/auth/auth.service';
import { Body, Controller, Get, Headers, Patch, Post, UnauthorizedException } from '@nestjs/common';

const BEARER_PREFIX_LENGTH = 7;

@Controller('auth')
export class AuthController {
    constructor(private readonly authService: AuthService) {}

    @Post('signup')
    async signUp(@Body() body: SignUpDto): Promise<AuthResponse> {
        return this.authService.signUp(body.email, body.password, body.username, body.avatar);
    }

    @Post('signin')
    async signIn(@Body() body: SignInDto): Promise<AuthResponse> {
        return this.authService.signIn(body.identifier, body.password);
    }

    @Post('signout')
    async signOut(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        await this.authService.signOut(token);
        return { message: 'Déconnexion réussie.' };
    }

    @Post('clear-session')
    async clearSession(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        await this.authService.clearSession(token);
        return { message: 'Session nettoyée.' };
    }

    @Post('delete-account')
    async deleteAccount(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        await this.authService.deleteAccount(token);
        return { message: 'Compte supprimé.' };
    }

    @Get('me')
    async getMe(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        return this.authService.getMe(token);
    }

    @Get('stats')
    async getStats(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        return this.authService.getStats(token);
    }

    @Patch('update-profile')
    async updateProfile(@Headers('authorization') authHeader: string, @Body() body: UpdateDto): Promise<AuthResponse> {
        const token = this.extractToken(authHeader);
        return this.authService.updateProfile(token, body.email, body.username, body.avatar, body.theme, body.language);
    }

    private extractToken(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException({ code: 'auth/no-token', message: "Aucun jeton d'authentification fourni." });
        }
        return authHeader.substring(BEARER_PREFIX_LENGTH);
    }
}
