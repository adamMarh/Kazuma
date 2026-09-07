import { Module } from '@nestjs/common';
import { CombatGateway } from './gateways/combat/combat.gateway';
import { SharedModule } from './shared.module';

@Module({
    imports: [SharedModule],
    providers: [CombatGateway],
})
export class GameCombatModule {}
