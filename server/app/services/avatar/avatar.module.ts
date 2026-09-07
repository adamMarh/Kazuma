import { AuthModule } from '@app/auth.module';
import { AvatarController } from '@app/controllers/avatar/avatar.controller';
import { Module, forwardRef } from '@nestjs/common';
import { AvatarService } from './avatar.service';

@Module({
    imports: [forwardRef(() => AuthModule)],
    controllers: [AvatarController],
    providers: [AvatarService],
    exports: [AvatarService],
})
export class AvatarModule {}
