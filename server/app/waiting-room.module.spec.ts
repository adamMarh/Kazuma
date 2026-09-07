import { Test, TestingModule } from '@nestjs/testing';
import { LobbyGateway } from './gateways/lobby/lobby.gateway';
import { BotService } from './services/bot/bot.service';
import { ChatService } from './services/chatroom/chatroom.service';
import { CombatService } from './services/combat/combat.service';
import { LobbyService } from './services/lobby/lobby.service';
import { MovementService } from './services/movement/movement.service';
import { TurnService } from './services/turn/turn.service';
import { GameService } from './services/game/game.service';

describe('WaitingRoomModule', () => {
    let module: TestingModule;

    beforeAll(async () => {
        module = await Test.createTestingModule({
            providers: [
                LobbyGateway,
                {
                    provide: LobbyService,
                    useValue: {
                        joinGame: jest.fn(),
                        addBot: jest.fn(),
                        lockRoom: jest.fn(),
                        unlockRoom: jest.fn(),
                    },
                },
                {
                    provide: GameService,
                    useValue: {
                        createGame: jest.fn(),
                        getGame: jest.fn(),
                        getGames: jest.fn().mockReturnValue({}),
                        getPlayer: jest.fn(),
                        removePlayer: jest.fn(),
                        getGameByPlayer: jest.fn(),
                        isPlayerInCombat: jest.fn().mockReturnValue(false),
                        handleCombatantDisonnection: jest.fn(),
                        nextTurn: jest.fn(),
                    },
                },
                {
                    provide: MovementService,
                    useValue: {
                        placePlayers: jest.fn(),
                    },
                },
                {
                    provide: TurnService,
                    useValue: {
                        orderPlayerTurns: jest.fn(),
                        cancelTimers: jest.fn(),
                        turnBehaviour: jest.fn(),
                        startTimers: jest.fn(),
                    },
                },
                {
                    provide: BotService,
                    useValue: {
                        runBotTurn: jest.fn(),
                    },
                },
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
                {
                    provide: CombatService,
                    useValue: {
                        dropPlayerItems: jest.fn(),
                    },
                },
            ],
        }).compile();
    });

    it('should compile module', () => {
        expect(module).toBeDefined();
    });

    it('should have LobbyGateway defined', () => {
        const lobbyGateway = module.get<LobbyGateway>(LobbyGateway);
        expect(lobbyGateway).toBeDefined();
    });
});
