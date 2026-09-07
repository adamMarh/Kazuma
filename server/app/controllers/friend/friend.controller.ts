import { AuthService } from '@app/services/auth/auth.service';
import { FriendService } from '@app/services/friend/friend.service';
import { UserProfile } from '@common/interfaces/friend.interface';
import { Controller, Get, Headers, Query, UnauthorizedException } from '@nestjs/common';

const BEARER_PREFIX_LENGTH = 7;

@Controller('friends')
export class FriendController {
    constructor(
        private readonly friendService: FriendService,
        private readonly authService: AuthService,
    ) {}

    @Get('search')
    async searchUsers(@Query('q') query: string, @Headers('authorization') authHeader: string): Promise<UserProfile[]> {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);
        return this.friendService.searchUsers(query, decoded.uid);
    }

    private extractToken(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException({ code: 'auth/no-token', message: "Aucun jeton d'authentification fourni." });
        }
        return authHeader.substring(BEARER_PREFIX_LENGTH);
    }
}
