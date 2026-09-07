import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ChatMessage extends Document {
    @Prop({ required: true })
    author: string;

    @Prop({ required: false })
    uid: string;

    @Prop({ required: true })
    content: string;

    @Prop({ required: true, type: Date })
    timestamp: Date;

    @Prop({ required: true })
    gameId: string;

    @Prop({ default: false })
    fromLobby: boolean;
}

export const chatMessageSchema = SchemaFactory.createForClass(ChatMessage);
