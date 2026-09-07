import { Module } from '@nestjs/common';
import { ClickGateway } from './gateways/click/click.gateway';
import { SharedModule } from './shared.module';

@Module({
    imports: [SharedModule],
    providers: [ClickGateway],
})
export class ClickModule {}
