/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { ChatService } from '@app/services/chatroom/chatroom.service';
import { CHAT_EVENTS } from '@common/socket-events/chatroom.events';

describe('ChatService', () => {
    let service: ChatService;
    let client: any;
    let server: any;
    let consoleSpy: jest.SpyInstance;
    let mockChatMessageModel: any;

    beforeEach(() => {
        const mockSave = jest.fn().mockResolvedValue({});

        function MockConstructor(data: any) {
            return {
                ...data,
                save: mockSave,
            };
        }

        MockConstructor.find = jest.fn().mockReturnThis();
        MockConstructor.sort = jest.fn().mockReturnThis();
        MockConstructor.exec = jest.fn().mockResolvedValue([]);
        MockConstructor.deleteMany = jest.fn().mockReturnThis();

        mockChatMessageModel = MockConstructor;

        service = new ChatService(mockChatMessageModel);

        client = {
            join: jest.fn(),
            leave: jest.fn(),
            id: 'testClientId',
        };

        const roomMock = {
            emit: jest.fn(),
        };
        server = {
            to: jest.fn().mockReturnValue(roomMock),
        };

        consoleSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
    });

    afterEach(() => {
        jest.clearAllMocks();
    });

    it('should return early and not delete if gameId is falsy', async () => {
        await service.deleteMessagesForGame('');

        expect(mockChatMessageModel.deleteMany).not.toHaveBeenCalled();
        expect(mockChatMessageModel.exec).not.toHaveBeenCalled();
    });

    it('should return early if gameId is undefined', async () => {
        await service.deleteMessagesForGame(undefined as any);

        expect(mockChatMessageModel.deleteMany).not.toHaveBeenCalled();
        expect(mockChatMessageModel.exec).not.toHaveBeenCalled();
    });

    it('should not throw if deleteMany or exec throws', async () => {
        const gameId = 'room1';

        mockChatMessageModel.exec = jest.fn().mockRejectedValue(new Error('Mock deletion error'));
        await expect(service.deleteMessagesForGame(gameId)).resolves.not.toThrow();
        expect(mockChatMessageModel.deleteMany).toHaveBeenCalledWith({ gameId });
        expect(mockChatMessageModel.exec).toHaveBeenCalled();
    });

    it('doit permettre à un client de rejoindre une room et logger le message', () => {
        const gameId = 'room1';
        const playerName = 'Alice';
        service.joinRoom(client, gameId, playerName);

        expect(client.join).toHaveBeenCalledWith(gameId);
    });

    it('doit permettre à un client de quitter une room et logger le message', () => {
        const gameId = 'room1';
        service.leaveRoom(client, gameId);

        expect(client.leave).toHaveBeenCalledWith(gameId);
    });

    it('doit envoyer un message à la room et logger le message', async () => {
        const message = { gameId: 'room1', author: 'test', content: 'Hello World', timestamp: '12:00' };
        await service.sendMessageToRoom(server, client, message);

        expect(server.to).toHaveBeenCalledWith(message.gameId);

        const roomMock = server.to.mock.results[0].value;
        expect(roomMock.emit).toHaveBeenCalledWith(CHAT_EVENTS.RECEIVE_MESSAGE, message);
    });

    it("doit récupérer l'historique des messages pour une partie", async () => {
        const gameId = 'room1';
        await service.getMessageHistory(gameId);

        expect(mockChatMessageModel.find).toHaveBeenCalledWith({ gameId });
        expect(mockChatMessageModel.sort).toHaveBeenCalled();
        expect(mockChatMessageModel.exec).toHaveBeenCalled();
    });

    it("doit supprimer les messages d'une partie", async () => {
        const gameId = 'room1';
        await service.deleteMessagesForGame(gameId);

        expect(mockChatMessageModel.deleteMany).toHaveBeenCalledWith({ gameId });
        expect(mockChatMessageModel.exec).toHaveBeenCalled();
    });
});
