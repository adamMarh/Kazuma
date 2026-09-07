import { AuthService } from '@app/services/auth/auth.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { CosmeticType, SHOP_CATALOG } from '@app/services/currency/shop.catalog';
import { Body, Controller, Get, Headers, Param, Post, UnauthorizedException } from '@nestjs/common';

const BEARER_PREFIX_LENGTH = 7;

@Controller('currency')
export class CurrencyController {
    constructor(
        private readonly authService: AuthService,
        private readonly currencyService: CurrencyService,
    ) {}

    @Get('me')
    async me(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);
        return this.currencyService.getWallet(decoded.uid);
    }

    @Post('add')
    async add(@Headers('authorization') authHeader: string, @Body() body: { delta: number }) {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);
        return this.currencyService.addBalance(decoded.uid, body.delta);
    }

    @Get('shop')
    async shop(@Headers('authorization') authHeader: string) {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);

        const wallet = await this.currencyService.getWallet(decoded.uid);
        return { wallet, catalog: SHOP_CATALOG };
    }
    @Get('user/:username')
    async byUsername(@Param('username') username: string) {
        const wallet = await this.currencyService.getWalletByUsername(username);
        if (!wallet) return { wallet: null };
        return { wallet };
    }
    @Post('buy')
    async buy(@Headers('authorization') authHeader: string, @Body() body: { type: CosmeticType; itemId: string }) {
        const token = this.extractToken(authHeader);
        const decoded = await this.authService.verifyToken(token);

        return this.currencyService.buyCosmetic(decoded.uid, body.type, body.itemId);
    }

    private extractToken(authHeader: string): string {
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            throw new UnauthorizedException({ code: 'auth/no-token', message: "Aucun jeton d'authentification fourni." });
        }
        return authHeader.substring(BEARER_PREFIX_LENGTH);
    }
}
