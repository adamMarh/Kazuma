/* eslint-disable prettier/prettier */
import { GameService } from '@app/services/game/game.service';
import { Test, TestingModule } from '@nestjs/testing';
import { Socket } from 'socket.io';
import { EndGameGateway } from './end-game.gateway';

describe('EndGameGateway', () => {
    let gateway: EndGameGateway;
    let gameService: GameService;
    let mockClient: Partial<Socket>;

    const mockGameService = {
        getPlayerStats: jest.fn(),
        getGlobalStats: jest.fn(),
    };

    const mockSocket = {
        emit: jest.fn(),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [
                EndGameGateway,
                { provide: GameService, useValue: mockGameService },
            ],
        }).compile();

        gateway = module.get<EndGameGateway>(EndGameGateway);
        gameService = module.get<GameService>(GameService);
        mockClient = mockSocket;
        jest.clearAllMocks();
    });

    describe('handleEndGameStats', () => {
        it('should emit end-game-stats with correct data', () => {
            const payload = { gameId: 'game123' };
            const mockStats = [{ name: 'Player1', combats: 2 }];

            mockGameService.getPlayerStats.mockReturnValue(mockStats);

            gateway.handleEndGameStats(mockClient as Socket, payload);

            expect(gameService.getPlayerStats).toHaveBeenCalledWith('game123');
            expect(mockClient.emit).toHaveBeenCalledWith('end-game-stats', mockStats);
        });
    });

    describe('handleEndGameGlobalStats', () => {
        it('should emit end-game-global-stats with correct data', () => {
            const payload = { gameId: 'game123' };
            const mockStats = {
                formattedDuration: '01:23',
                totalTurns: 10,
                tilesVisitedPercentage: 50,
                doorManipulatedPercentage: 60,
                playersWithFlag: 2,
            };

            mockGameService.getGlobalStats.mockReturnValue(mockStats);

            gateway.handleEndGameGlobalStats(mockClient as Socket, payload);

            expect(gameService.getGlobalStats).toHaveBeenCalledWith('game123');
            expect(mockClient.emit).toHaveBeenCalledWith('end-game-global-stats', mockStats);
        });
    });
});
