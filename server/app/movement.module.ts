import { Module } from '@nestjs/common';
import { MovementGateway } from './gateways/movement/movement.gateway';
import { SharedModule } from './shared.module';

@Module({
    imports: [SharedModule],
    providers: [MovementGateway],
})
export class MovementModule {}
