/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines */
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { ITEM_EVENTS } from '@common/socket-events/item.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { CombatGateway } from './combat.gateway';

describe('CombatGateway', () => {
    let combatGateway: CombatGateway;
    let combatService: any;
    let newGameService: any;
    let turnService: any;
    let botService: any;
    let server: any;

    beforeEach(() => {
        combatService = {
            getCombatState: jest.fn(),
            attackOpponent: jest.fn(),
            endCombat: jest.fn(),
            attemptFlee: jest.fn(),
            initCombat: jest.fn(),
        };

        newGameService = {
            getGame: jest.fn(),
            nextTurn: jest.fn(),
        };

        turnService = {
            resumeTimers: jest.fn(),
            turnBehaviour: jest.fn(),
        };

        botService = {
            runBotTurn: jest.fn(),
        };

        combatGateway = new CombatGateway(combatService, newGameService, turnService, botService);

        server = {
            to: jest.fn().mockReturnValue({
                emit: jest.fn(),
            }),
        };
        combatGateway.server = server;
    });

    describe('handleAttackOpponent', () => {
        let payload: { gameId: string };
        let game: any;
        let combatState: any;

        beforeEach(() => {
            payload = { gameId: 'game1' };
            game = {
                gameId: 'game1',
                players: [],
                playerTurns: ['turn1', 'turn2'],
                currentPlayerIndex: 0,
            };

            combatState = {
                inCombat: true,
                attacker: { socketId: 'attacker1', name: 'Attacker' },
                target: { socketId: 'target1', name: 'Target' },
                attackResult: { attackDiceRoll: 6, defenseDiceRoll: 3, damage: 2 },
            };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue(combatState);
        });

        it('should return early and not attack if combatState.attacker is missing', async () => {
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue({});

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            await combatGateway.handleAttackOpponent(payload);
            expect(combatService.attackOpponent).not.toHaveBeenCalled();
            expect(server.to).not.toHaveBeenCalled();
        });

        it('should emit ITEM_EFFECT_APPLIED if a potion was used during attack', async () => {
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };

            const attacker = { socketId: 'attacker1', name: 'Attacker' };
            const target = { socketId: 'target1', name: 'Target' };
            const combatInitiator = attacker;

            const fullCombatState = {
                attacker,
                target,
                combatInitiator,
                attackResult: {
                    attackDiceRoll: 6,
                    defenseDiceRoll: 3,
                    damage: 2,
                },
            };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue(fullCombatState);

            combatService.attackOpponent.mockReturnValue({
                drankPotion: true,
                combatState: fullCombatState,
            });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            await combatGateway.handleAttackOpponent(payload);

            expect(server.to).toHaveBeenCalledWith('game1');
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: attacker.socketId,
                itemType: 'potion',
                activated: true,
            });
        });

        it('should handle hourglass flip by emitting effect, reinitializing combat, and emitting COMBAT_STARTED', async () => {
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1' };

            const attacker = { socketId: 'attacker1', name: 'Attacker' };
            const target = { socketId: 'target1', name: 'Target' };
            const combatInitiator = attacker;

            const fullCombatState = {
                attacker,
                target,
                combatInitiator,
                attackResult: {
                    attackDiceRoll: 6,
                    defenseDiceRoll: 4,
                    damage: 2,
                },
            };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue(fullCombatState);

            combatService.attackOpponent.mockReturnValue({
                flippedHourglass: true,
                combatState: fullCombatState,
            });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            await combatGateway.handleAttackOpponent(payload);

            expect(server.to).toHaveBeenCalledWith('game1');
            expect(emitMock).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: target.socketId,
                itemType: 'hourglass',
                activated: true,
            });

            const opponent = target;
            expect(combatService.initCombat).toHaveBeenCalledWith(combatInitiator, opponent, game, true);
            expect(emitMock).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_STARTED, {
                combatState: fullCombatState,
            });
        });

        it('should call runBotTurn if winner is a bot and it is their turn, then call turnBehaviour', async () => {
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', players: [], map: {} };

            const attacker = { socketId: 'p1', name: 'Attacker' };
            const target = { socketId: 'bot1', name: 'Bot', isBot: true, isMyTurn: true };
            const combatState = {
                attacker,
                target,
                combatInitiator: attacker,
                attackResult: { attackDiceRoll: 5, defenseDiceRoll: 4, damage: 3 },
            };

            const result = {
                isDead: true,
                combatState,
            };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue(combatState);
            combatService.attackOpponent.mockReturnValue(result);
            combatService.endCombat.mockReturnValue({ combatState, actionPlayer: target, gameEnded: false });

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });

            await combatGateway.handleAttackOpponent(payload);

            expect(botService.runBotTurn).toHaveBeenCalledWith(target, server, game);
            expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, game);
        });

        it('should handle an attack when the result does not indicate a death', () => {
            const result = {
                combatState: {
                    attacker: { socketId: 'attacker1', name: 'Attacker' },
                    target: { socketId: 'target1', name: 'Target' },
                    attackResult: { attackDiceRoll: 6, defenseDiceRoll: 3, damage: 2 },
                },
                isDead: false,
            };
            combatService.attackOpponent.mockReturnValue(result);

            combatGateway.handleAttackOpponent(payload);

            expect(server.to).toHaveBeenCalledWith('attacker1');
            expect(server.to).toHaveBeenCalledWith('target1');

            expect(combatService.attackOpponent).toHaveBeenCalledWith(game);

            expect(combatService.endCombat).not.toHaveBeenCalled();
            expect(turnService.resumeTimers).not.toHaveBeenCalled();
        });

        it('should handle an attack when the result indicates a death', () => {
            const result = {
                combatState: {
                    attacker: { socketId: 'attacker1', name: 'Attacker' },
                    target: { socketId: 'target1', name: 'Target' },
                    attackResult: { attackDiceRoll: 6, defenseDiceRoll: 3, damage: 2 },
                },
                isDead: true,
            };
            combatService.attackOpponent.mockReturnValue(result);

            const combatResult = {
                combatState: { combatInitiator: { socketId: 'initiator1' } },
                actionPlayer: { socketId: 'actionPlayer1' },
                gameEnded: true,
            };
            combatService.endCombat.mockReturnValue(combatResult);

            game.players = [{ socketId: 'player1' }, { socketId: 'player2' }];
            game.playerTurns = ['turn1', 'turn2'];
            game.currentPlayerIndex = 0;
            combatGateway.handleAttackOpponent(payload);

            expect(server.to).toHaveBeenCalledWith('attacker1');
            expect(server.to).toHaveBeenCalledWith('target1');
            expect(combatService.endCombat).toHaveBeenCalledWith(game, combatState.target);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(turnService.resumeTimers).toHaveBeenCalledWith(server, game);
        });

        it('should set isFlagHolder to false if the loser was holding the flag', async () => {
            const payload = { gameId: 'game1' };
            const game = { gameId: 'game1', players: [], map: {} };

            const attacker = { socketId: 'attacker1', name: 'Attacker', isFlagHolder: true };
            const target = { socketId: 'target1', name: 'Target' };
            const combatInitiator = target;

            const combatState = {
                attacker,
                target,
                combatInitiator,
                attackResult: { attackDiceRoll: 6, defenseDiceRoll: 3, damage: 2 },
            };

            const result = {
                combatState,
                isDead: true,
            };

            const combatResult = {
                combatState: { ...combatState, combatInitiator },
                actionPlayer: target,
                gameEnded: false,
            };

            newGameService.getGame.mockReturnValue(game);
            combatService.getCombatState.mockReturnValue(combatState);
            combatService.attackOpponent.mockReturnValue(result);
            combatService.endCombat.mockReturnValue(combatResult);

            const emitMock = jest.fn();
            server.to = jest.fn().mockReturnValue({ emit: emitMock });
            await combatGateway.handleAttackOpponent(payload);
            expect(attacker.isFlagHolder).toBe(false);
        });
    });

    describe('delay()', () => {
        it('should resolve after the specified milliseconds', async () => {
            jest.useFakeTimers();

            const promise = (combatGateway as any).delay(1000);
            const thenSpy = jest.fn();
            promise.then(thenSpy);
            expect(thenSpy).not.toHaveBeenCalled();

            jest.advanceTimersByTime(1000);
            await Promise.resolve();

            expect(thenSpy).toHaveBeenCalled();
            jest.useRealTimers();
        });
    });

    describe('handleStartTimer', () => {
        let payload: { gameId: string };
        let combatState: any;

        beforeEach(() => {
            payload = { gameId: 'game3' };
            combatState = {
                inCombat: true,
                attacker: { fleeAttempts: 1 },
                target: { socketId: 'target3' },
            };
            combatService.getCombatState.mockReturnValue(combatState);
        });

        it('should return early if attacker is missing', () => {
            const combatState = {
                attacker: undefined,
                target: { socketId: 'target1', hasLeft: false },
            };

            jest.spyOn(combatService, 'getCombatState').mockReturnValue(combatState);
            combatGateway.handleStartTimer(payload);
            expect(server.to).not.toHaveBeenCalled();
        });

        it('should return early if attacker has left', () => {
            const combatState = {
                attacker: { socketId: 'attacker1', hasLeft: true },
                target: { socketId: 'target1', hasLeft: false },
            };

            jest.spyOn(combatService, 'getCombatState').mockReturnValue(combatState);
            combatGateway.handleStartTimer(payload);
            expect(server.to).not.toHaveBeenCalled();
        });

        it('should emit TIMER_STATE with a delay of 5 when the player can flee', () => {
            combatState.attacker.fleeAttempts = 1;
            combatGateway.handleStartTimer(payload);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const expectedPayload = {
                timerStarted: true,
                timerPaused: false,
                delay: 5,
                targetPlayer: combatState.target,
            };
            expect(server.to(payload.gameId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.TIMER_STATE, expectedPayload);
        });

        it('should emit TIMER_STATE with a delay of 3 when the player cannot flee', () => {
            combatState.attacker.fleeAttempts = 2;
            combatGateway.handleStartTimer(payload);
            expect(server.to).toHaveBeenCalledWith(payload.gameId);
            const expectedPayload = {
                timerStarted: true,
                timerPaused: false,
                delay: 3,
                targetPlayer: combatState.target,
            };
            expect(server.to(payload.gameId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.TIMER_STATE, expectedPayload);
        });

        it('should do nothing if the combat is not engaged', () => {
            combatState.inCombat = false;
            combatGateway.handleStartTimer(payload);
            expect(server.to).not.toHaveBeenCalled();
        });
    });

    describe('handleBotActions', () => {
        const game = { gameId: 'game1' };

        beforeEach(() => {
            jest.spyOn(combatGateway as any, 'delay').mockResolvedValue(undefined);
            jest.spyOn(combatGateway, 'handleAttemptFlee').mockImplementation(jest.fn());
            jest.spyOn(combatGateway, 'handleAttackOpponent').mockImplementation(jest.fn());
        });

        afterEach(() => {
            jest.restoreAllMocks();
        });

        it('should call handleAttemptFlee if bot is passive, low HP, and can flee', async () => {
            const combatState = {
                attacker: {
                    isBot: true,
                    isAgressive: false,
                    healthpoints: 2,
                    fleeAttempts: 1,
                },
            };

            await combatGateway.handleBotActions(combatState as any, game as any);
            expect(combatGateway.handleAttemptFlee).toHaveBeenCalledWith({ gameId: game.gameId });
            expect(combatGateway.handleAttackOpponent).not.toHaveBeenCalled();
        });

        it('should call handleAttackOpponent if bot is aggressive', async () => {
            const combatState = {
                attacker: {
                    isBot: true,
                    isAgressive: true,
                    healthpoints: 10,
                    fleeAttempts: 0,
                },
            };

            await combatGateway.handleBotActions(combatState as any, game as any);
            expect(combatGateway.handleAttackOpponent).toHaveBeenCalledWith({ gameId: game.gameId });
            expect(combatGateway.handleAttemptFlee).not.toHaveBeenCalled();
        });

        it('should call handleAttackOpponent if bot is passive but cannot flee anymore', async () => {
            const combatState = {
                attacker: {
                    isBot: true,
                    isAgressive: false,
                    healthpoints: 2,
                    fleeAttempts: 2,
                },
            };

            await combatGateway.handleBotActions(combatState as any, game as any);
            expect(combatGateway.handleAttackOpponent).toHaveBeenCalledWith({ gameId: game.gameId });
            expect(combatGateway.handleAttemptFlee).not.toHaveBeenCalled();
        });
    });

    describe('handleAttemptFlee', () => {
        const payload = { gameId: 'game1' };
        let game: any;
        let attacker: any;
        let target: any;
        let combatState: any;

        beforeEach(() => {
            attacker = { socketId: 'attacker1', name: 'Bot', hasLeft: false };
            target = { socketId: 'target1', name: 'Hero' };

            game = {
                gameId: 'game1',
                players: [attacker, target],
            };

            combatState = {
                inCombat: true,
                attacker,
                target,
            };

            jest.spyOn(newGameService, 'getGame').mockReturnValue(game);
            jest.spyOn(combatService, 'getCombatState').mockReturnValue(combatState);
            jest.spyOn(server, 'to').mockReturnValue({ emit: jest.fn() });
            jest.spyOn(turnService, 'resumeTimers').mockImplementation(jest.fn());
            jest.spyOn(turnService, 'turnBehaviour').mockImplementation(jest.fn());
            jest.spyOn(combatGateway, 'handleBotActions').mockImplementation(jest.fn());
        });

        it('should return early if combatState.inCombat is false', () => {
            combatService.getCombatState.mockReturnValueOnce({ inCombat: false });
            combatGateway.handleAttemptFlee(payload);
            expect(server.to).not.toHaveBeenCalled();
        });

        it('should return early if fleeing player has left', () => {
            attacker.hasLeft = true;
            combatGateway.handleAttemptFlee(payload);
            expect(server.to).not.toHaveBeenCalled();
        });

        it('should apply crystal effect if hasCrystal is true', () => {
            combatService.attemptFlee = jest.fn().mockReturnValue({ fled: false, hasCrystal: true });
            combatGateway.handleAttemptFlee(payload);
            expect(server.to(attacker.socketId).emit).toHaveBeenCalledWith(ITEM_EVENTS.ITEM_EFFECT_APPLIED, {
                playerId: attacker.socketId,
                itemType: 'crystal',
                activated: true,
            });
        });

        it('should emit combat ended, update lobby and resume timers on successful flee', () => {
            combatService.attemptFlee = jest.fn().mockReturnValue({ fled: true });
            combatService.endCombat = jest.fn().mockReturnValue({
                combatState: { combatInitiator: attacker },
                actionPlayer: attacker,
                gameEnded: false,
            });

            combatGateway.handleAttemptFlee(payload);

            expect(server.to(game.gameId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_ENDED, expect.any(Object));
            expect(server.to(game.gameId).emit).toHaveBeenCalledWith(LOBBY_EVENTS.UPDATE_LOBBY, game);
            expect(server.to(game.gameId).emit).toHaveBeenCalledWith(GAME_EVENTS.ACTION_ENDED, expect.any(Object));
            expect(turnService.resumeTimers).toHaveBeenCalledWith(server, game);
        });

        it('should emit updates and call handleBotActions if flee failed', () => {
            combatService.attemptFlee = jest.fn().mockReturnValue({ fled: false });

            combatGateway.handleAttemptFlee(payload);

            expect(server.to(attacker.socketId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_STATE_UPDATE, { combatState });
            expect(server.to(attacker.socketId).emit).toHaveBeenCalledWith(COMBAT_EVENTS.TURN_CHANGED);
            expect(combatGateway.handleBotActions).toHaveBeenCalledWith(combatState, game);
        });
        it('should call turnBehaviour if the combat initiator is a bot after successful flee', () => {
            attacker.isBot = true;
            combatService.attemptFlee = jest.fn().mockReturnValue({ fled: true });
            combatService.endCombat = jest.fn().mockReturnValue({
                combatState: { combatInitiator: attacker },
                actionPlayer: attacker,
                gameEnded: false,
            });

            combatGateway.handleAttemptFlee(payload);

            expect(turnService.turnBehaviour).toHaveBeenCalledWith(server, game);
        });

        it('should return early if combatState.inCombat is false', () => {
            jest.spyOn(combatService, 'getCombatState').mockReturnValue({ inCombat: false });
            combatGateway.handleAttemptFlee({ gameId: 'game1' });
            expect(server.to).not.toHaveBeenCalled();
        });
    });
});
