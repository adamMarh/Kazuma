// avatar.controller.ts
import { AuthService } from '@app/services/auth/auth.service';
import { AvatarService } from '@app/services/avatar/avatar.service';
import { Body, Controller, Delete, Get, Headers, Inject, Param, Post, UnauthorizedException, forwardRef } from '@nestjs/common';
import { UploadAvatarDto } from './upload-avatar.dto';

const BEARER_PREFIX_LENGTH = 7;

@Controller('avatars')
export class AvatarController {
    constructor(
        private readonly avatarService: AvatarService,
        @Inject(forwardRef(() => AuthService)) private readonly authService: AuthService,
    ) {}

    /* @Get()
    async getAvatars(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);
        return this.avatarService.getAvailableAvatars(decoded.uid);
    }*/
    @Get()
    async getAll() {
        return this.avatarService.getAvailableAvatars('global');
    }

    @Get('by-uid/:uid')
    async getAvatarByUid(@Param('uid') uid: string) {
        return this.avatarService.getAvatarByUid(uid);
    }

    @Get('by-username/:username')
    async getAvatarByUsername(@Param('username') username: string) {
        return this.avatarService.getAvatarByUsername(username);
    }

    @Get('me/avatars')
    async getMyAvatars(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        const uid = decodedToken.uid;

        return this.avatarService.getAvailableAvatars(uid);
    }

    @Get(':id')
    async getAvatarById(@Param('id') id: string) {
        return this.avatarService.getAvatarById(id);
    }

    @Post('upload')
    async uploadAvatar(@Headers('authorization') authHeader: string, @Body() body: UploadAvatarDto) {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        const uid = decodedToken.uid;

        return this.avatarService.uploadAvatar(uid, body.imageBase64, body.name);
    }

    @Delete(':id')
    async deleteAvatar(@Headers('authorization') authHeader: string, @Param('id') avatarId: string) {
        const token = this.extractToken(authHeader);
        const decodedToken = await this.authService.verifyToken(token);
        const uid = decodedToken.uid;

        return this.avatarService.deleteAvatar(uid, avatarId);
    }

    private extractToken(authHeader: string): string {
        if (!authHeader?.startsWith('Bearer ')) {
            throw new UnauthorizedException({ code: 'auth/no-token', message: 'No token.' });
        }
        return authHeader.substring(BEARER_PREFIX_LENGTH);
    }
}
