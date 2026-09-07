import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

export type GameMapDocument = GameMap & Document;

@Schema({ collection: 'maps' })
export class GameMap {
    @Prop({ required: true })
    name: string;

    @Prop({ required: true })
    size: string;

    @Prop({ required: true })
    gameMode: string;

    @Prop({ required: true, type: [[String]] })
    tiles: string[][];

    @Prop({ required: true, type: [[String]] })
    items: string[][];

    @Prop()
    description: string;

    @Prop({ required: true })
    lastSave: Date;

    @Prop()
    imageUrl: string;

    @Prop({ required: true, enum: ['public', 'private', 'private-shared'], default: 'private' })
    visibility: string;

    @Prop({ required: true })
    owner: string;

    @Prop({ required: true })
    nbCheckpoints: string;

    @Prop({ required: true })
    nbRandomItems: string;

    @Prop({ default: 1, min: 1, max: 5 })
    actionPoints: number;
}

export const gameMapSchema = SchemaFactory.createForClass(GameMap);
gameMapSchema.index({ name: 1 }, { unique: true });
