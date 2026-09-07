import { AuthModule } from '@app/auth.module';
import { ChallengeModule } from '@app/challenge.module';
import { ChatModule } from '@app/chatroom.module';
import { ClickModule } from '@app/click.module';
import { CurrencyModule } from '@app/currency.module';
import { EndGameModule } from '@app/end-game.module';
import { FriendModule } from '@app/friend.module';
import { GameCombatModule } from '@app/game-combat.module';
import { MapsModule } from '@app/maps.module';

import { ThemeModule } from '@app/modules/theme/theme.module';
import { MovementModule } from '@app/movement.module';
import { AvatarModule } from '@app/services/avatar/avatar.module';
import { WaitingRoomModule } from '@app/waiting-room.module';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { MongooseModule } from '@nestjs/mongoose';
import { EventEmitter } from 'events';
EventEmitter.defaultMaxListeners = 20;

@Module({
    imports: [
        ConfigModule.forRoot({ isGlobal: true }),
        MongooseModule.forRootAsync({
            imports: [ConfigModule],
            inject: [ConfigService],
            useFactory: async (config: ConfigService) => ({
                uri: config.get<string>('DATABASE_CONNECTION_STRING'),
            }),
        }),
        AuthModule,
        MapsModule,
        WaitingRoomModule,
        MovementModule,
        GameCombatModule,
        ClickModule,
        ChatModule,
        EndGameModule,
        FriendModule,
        AvatarModule,
        CurrencyModule,
        ChallengeModule,
        ThemeModule,
    ],
    controllers: [],
    providers: [],
})
export class AppModule {}
