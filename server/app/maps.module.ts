import { Module } from '@nestjs/common';
import { MongooseModule } from '@nestjs/mongoose';
import { MapsController } from './controllers/maps/maps.controller';
import { GameMap, gameMapSchema } from './model/schema/game-map.schema';
import { MapsService } from './services/maps/maps.service';

@Module({
    imports: [MongooseModule.forFeature([{ name: GameMap.name, schema: gameMapSchema }])],
    controllers: [MapsController],
    providers: [MapsService],
    exports: [MapsService],
})
export class MapsModule {}
