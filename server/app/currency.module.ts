import { Module } from '@nestjs/common';
import { AuthModule } from './auth.module';
import { CurrencyController } from './controllers/currency/currency.controller';
import { CurrencyService } from './services/currency/currency.service';

@Module({
    imports: [AuthModule],
    controllers: [CurrencyController],
    providers: [CurrencyService],
})
export class CurrencyModule {}
