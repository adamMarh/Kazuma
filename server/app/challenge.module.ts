import { Module } from '@nestjs/common';
import { ChallengeGateway } from './gateways/challenge/challenge.gateway';
import { SharedModule } from './shared.module';

@Module({
    imports: [SharedModule],
    providers: [ChallengeGateway],
})
export class ChallengeModule {}
