import { Global, Module } from '@nestjs/common';
import { MapsModule } from './maps.module';
import { BotService } from './services/bot/bot.service';
import { ChallengeService } from './services/challenge/challenge.service';
import { CombatService } from './services/combat/combat.service';
import { CurrencyService } from './services/currency/currency.service';
import { EndGameService } from './services/end-game/end-game.service';
import { GameService } from './services/game/game.service';
import { ItemService } from './services/item/item.service';
import { LobbyService } from './services/lobby/lobby.service';
import { MovementService } from './services/movement/movement.service';
import { StatsService } from './services/stats/stats.service';
import { TurnService } from './services/turn/turn.service';

@Global()
@Module({
    imports: [MapsModule],
    providers: [
        MovementService,
        LobbyService,
        CombatService,
        GameService,
        TurnService,
        BotService,
        EndGameService,
        ItemService,
        CurrencyService,
        ChallengeService,
        StatsService,
    ],
    exports: [
        MovementService,
        LobbyService,
        CombatService,
        GameService,
        MapsModule,
        TurnService,
        BotService,
        EndGameService,
        ItemService,
        CurrencyService,
        ChallengeService,
        StatsService,
    ],
})
export class SharedModule {}
