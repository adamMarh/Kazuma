import { EndGameGateway } from './gateways/end-game/end-game.gateway';
import { Module } from '@nestjs/common';
import { SharedModule } from './shared.module';
import { EndGameService } from './services/end-game/end-game.service';

@Module({
    imports: [SharedModule],
    providers: [EndGameGateway, EndGameService],
    exports: [EndGameService],
})
export class EndGameModule {}
