import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { Document } from 'mongoose';

@Schema()
export class ChatRoom extends Document {
    @Prop({ required: true })
    owner: string;

    @Prop({ required: false })
    ownerUid: string;

    @Prop({ required: true })
    id: string;

    @Prop({ required: true })
    name: string;

    @Prop({ default: false })
    isSystem: boolean;

    @Prop({ required: true })
    members: string[];
}

export const chatRoomSchema = SchemaFactory.createForClass(ChatRoom);
