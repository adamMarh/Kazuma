import { AuthModule } from '@app/auth.module';
import { ThemeController } from '@app/controllers/user/theme.controller';
import { ThemeService } from '@app/services/user/theme.service';
import { Module } from '@nestjs/common';

@Module({
    imports: [AuthModule],
    providers: [ThemeService],
    controllers: [ThemeController],
    exports: [ThemeService],
})
export class ThemeModule {}
