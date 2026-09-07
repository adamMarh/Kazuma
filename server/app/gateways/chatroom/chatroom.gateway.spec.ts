import { ChatService } from '@app/services/chatroom/chatroom.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { ChatGateway } from './chatroom.gateway';

describe('ChatGateway', () => {
    let gateway: ChatGateway;
    let chatService: ChatService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                ChatGateway,
                {
                    provide: ChatService,
                    useValue: {
                        joinRoom: jest.fn(),
                        leaveRoom: jest.fn(),
                        sendMessageToRoom: jest.fn().mockResolvedValue(undefined),
                        getMessageHistory: jest.fn().mockResolvedValue([]),
                        deleteMessagesForGame: jest.fn().mockResolvedValue(undefined),
                    },
                },
            ],
        }).compile();

        gateway = module.get<ChatGateway>(ChatGateway);
        chatService = module.get<ChatService>(ChatService);
    });

    it('should create component', () => {
        expect(gateway).toBeDefined();
    });

    it('should handle join room', () => {
        const client = {} as Socket;
        const payload = { gameId: '123', playerName: 'John' };

        const result = gateway.handleJoinRoom(client, payload);

        expect(chatService.joinRoom).toHaveBeenCalledWith(client, payload.gameId, payload.playerName);
        expect(result).toEqual({ joined: true });
    });

    it('should handle leave room', () => {
        const client = {} as Socket;
        const payload = { gameId: '123' };

        const result = gateway.handleLeaveRoom(client, payload);

        expect(chatService.leaveRoom).toHaveBeenCalledWith(client, payload.gameId);
        expect(result).toEqual({ left: true });
    });

    it('should handle send message', async () => {
        const client = {} as Socket;
        const message = { author: 'John', content: 'Hello', gameId: '123', timestamp: '12:00' };

        const result = await gateway.handleSendMessage(client, message);

        expect(chatService.sendMessageToRoom).toHaveBeenCalledWith(null, client, message);
        expect(result).toEqual({ sent: true });
    });

    it('should handle get history', async () => {
        const client = { emit: jest.fn() } as unknown as Socket;
        const payload = { gameId: '123' };
        const messages = [];

        (chatService.getMessageHistory as jest.Mock).mockResolvedValue(messages);

        const result = await gateway.handleGetHistory(client, payload);

        expect(chatService.getMessageHistory).toHaveBeenCalledWith(payload.gameId);
        expect(client.emit).toHaveBeenCalledWith('chathistoryReceived', messages);
        expect(result).toEqual({ success: true });
    });

    it('should handle delete game messages', async () => {
        const client = {} as Socket;
        const payload = { gameId: '123' };

        const result = await gateway.handleDeleteGameMessages(client, payload);

        expect(chatService.deleteMessagesForGame).toHaveBeenCalledWith(payload.gameId);
        expect(result).toEqual({ success: true });
    });
});
