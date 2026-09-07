/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { BotService } from '@app/services/bot/bot.service';
import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { Server } from 'socket.io';
import { TurnService } from './turn.service';

describe('TurnService', () => {
    let turnService: TurnService;
    let botService: Partial<BotService>;
    let combatService: Partial<CombatService>;
    let currencyService: Partial<CurrencyService>;
    let server: Server;
    let game: any;
    let player: any;

    beforeEach(() => {
        botService = { runBotTurn: jest.fn().mockResolvedValue(undefined) };
        combatService = { getCombatState: jest.fn().mockReturnValue(null) };
        currencyService = { applyEndGameRewards: jest.fn().mockResolvedValue(undefined) };
        turnService = new TurnService(botService as BotService, combatService as CombatService, currencyService as CurrencyService);
        const toSpy = { emit: jest.fn() };
        server = { to: jest.fn().mockReturnValue(toSpy) } as unknown as Server;
        player = { socketId: 'p1', name: 'Alice', speed: 10, isMyTurn: false, turnsPlayed: 0, actionPoints: 0, movementPoints: 0 };
        game = {
            gameId: 'game1',
            players: [{ ...player }, { socketId: 'p2', name: 'Bob', speed: 5, isMyTurn: false, actionPoints: 0, movementPoints: 0 }],
            playerTurns: [] as string[],
            currentPlayerIndex: 0,
        };
        (turnService as any).activeTimers = new Map();
        (turnService as any).timerPaused = false;
        jest.useFakeTimers();
    });

    afterEach(() => {
        turnService.cancelTimers('game1');
    });

    describe('orderPlayerTurns', () => {
        it('orders players by speed and sets first turn', () => {
            turnService.orderPlayerTurns(game);
            expect(game.playerTurns).toEqual(['p1', 'p2']);
            expect(game.players[0].isMyTurn).toBe(true);
            expect(game.players[0].turnsPlayed).toBe(1);
        });
        it('uses Math.random to break ties when speeds are equal', () => {
            const p1 = { ...player, socketId: 'p1', speed: 5 };
            const p2 = { ...player, socketId: 'p2', speed: 5 };

            game.players = [p1, p2];
            turnService.orderPlayerTurns(game);

            expect(game.playerTurns).toContain('p1');
            expect(game.playerTurns).toContain('p2');
        });
    });

    describe('startPreTimer', () => {
        let toSpy: { emit: jest.Mock };
        beforeEach(() => {
            jest.useFakeTimers();
            toSpy = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(toSpy);
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('calls startPreTimer with default duration when not provided', () => {
            const onComplete = jest.fn();
            turnService.startPreTimer(server, game.gameId, undefined, onComplete);
            jest.advanceTimersByTime(3000);
            expect(onComplete).toHaveBeenCalled();
        });

        it('emits PRE_TIMER_STARTED then ticks and calls onComplete', () => {
            const onComplete = jest.fn();
            const duration = 3;
            turnService.startPreTimer(server, game.gameId, duration, onComplete);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(toSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.PRE_TIMER_STARTED);
            toSpy.emit.mockClear();
            jest.advanceTimersByTime(1000);
            expect(toSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.PRE_TIMER_TICK, { secondsRemaining: 2 });
            toSpy.emit.mockClear();
            jest.advanceTimersByTime(1000);
            expect(toSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.PRE_TIMER_TICK, { secondsRemaining: 1 });
            toSpy.emit.mockClear();
            jest.advanceTimersByTime(1000);
            expect(onComplete).toHaveBeenCalled();
        });
        it('does not tick or complete if timerPaused is true', () => {
            const onComplete = jest.fn();
            (turnService as any).timerPaused = true;
            const { cancel } = turnService.startPreTimer(server, game.gameId, 3, onComplete);
            jest.advanceTimersByTime(3000);
            expect(onComplete).not.toHaveBeenCalled();
            cancel();
        });
    });

    describe('startTurnTimer', () => {
        let toSpy: { emit: jest.Mock };
        beforeEach(() => {
            jest.useFakeTimers();
            toSpy = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(toSpy);
        });
        afterEach(() => {
            jest.useRealTimers();
        });
        it('calls startTurnTimer with default duration when not provided', () => {
            const onComplete = jest.fn();
            turnService.startTurnTimer(server, game, undefined, onComplete);
            jest.advanceTimersByTime(1000);
            expect(onComplete).not.toHaveBeenCalled();
        });

        it('emits TURN_TIMER_STARTED, ticks, calls onComplete(false) and triggers turnBehaviour', () => {
            const onComplete = jest.fn();
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});
            const duration = 3;
            const timerObj = turnService.startTurnTimer(server, game, duration, onComplete);
            expect(toSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.TURN_TIMER_STARTED);
            toSpy.emit.mockClear();
            jest.advanceTimersByTime(1000);
            expect(timerObj.remaining).toBe(2);
            expect(toSpy.emit).toHaveBeenCalledWith(GAME_EVENTS.TURN_TIMER_TICK, { secondsRemaining: 2 });
            toSpy.emit.mockClear();
            jest.advanceTimersByTime(2000);
            expect(timerObj.remaining).toBeLessThanOrEqual(0);
            expect(onComplete).toHaveBeenCalledWith(false);
            expect(spyZob).toHaveBeenCalledWith(server, game);
            spyZob.mockRestore();
        });
        it('pauses and calls onComplete(true) if timerPaused is true', () => {
            const onComplete = jest.fn();
            (turnService as any).timerPaused = true;
            const timerObj = turnService.startTurnTimer(server, game, 5, onComplete);
            jest.advanceTimersByTime(1000);
            expect(onComplete).toHaveBeenCalledWith(true);
            const remaining = timerObj.remaining;
            jest.advanceTimersByTime(2000);
            expect(timerObj.remaining).toEqual(remaining);
        });
        it('cancels when cancel is called', () => {
            const onComplete = jest.fn();
            const timerObj = turnService.startTurnTimer(server, game, 10, onComplete);
            jest.advanceTimersByTime(1000);
            const remaining = timerObj.remaining;
            timerObj.cancel();
            jest.advanceTimersByTime(5000);
            expect(timerObj.remaining).toEqual(remaining);
            expect(onComplete).not.toHaveBeenCalled();
        });
    });

    describe('startTimers', () => {
        it('does not start new timers if one is active', () => {
            (turnService as any).activeTimers.set(game.gameId, { preTimer: { cancel: jest.fn() } });
            turnService.startTimers(server, game.gameId, player, game);
            expect((turnService as any).activeTimers.size).toBe(1);
        });
        it('starts preTimer then on completion emits ACTION_ENDED and starts turnTimer', () => {
            jest.useFakeTimers();
            const preCancel = jest.fn();
            const spyPre = jest.spyOn(turnService, 'startPreTimer').mockImplementation((srv, id, d, cb) => {
                cb();
                return { cancel: preCancel };
            });
            const fakeTurnTimer = { cancel: jest.fn(), remaining: 30 };
            const spyTurn = jest.spyOn(turnService, 'startTurnTimer').mockReturnValue(fakeTurnTimer);
            turnService.startTimers(server, game.gameId, player, game);
            expect((turnService as any).activeTimers.get(game.gameId).turnTimer).toEqual(fakeTurnTimer);
            spyPre.mockRestore();
            spyTurn.mockRestore();
            jest.useRealTimers();
        });
    });

    describe('pauseTimers', () => {
        it('cancels preTimer and sets timerPaused to true', () => {
            const preCancel = jest.fn();
            const fakeTT = { cancel: jest.fn(), remaining: 10 };
            (turnService as any).activeTimers.set(game.gameId, { preTimer: { cancel: preCancel }, turnTimer: fakeTT });
            turnService.pauseTimers(game.gameId);
            expect(preCancel).toHaveBeenCalled();
            expect((turnService as any).timerPaused).toBe(true);
        });
    });

    describe('resumeTimers', () => {
        it('resumes a paused turnTimer and resets timerPaused', () => {
            jest.useFakeTimers();
            const fakeTT = { cancel: jest.fn(), remaining: 5 };
            (turnService as any).activeTimers.set(game.gameId, { turnTimer: fakeTT });
            (turnService as any).timerPaused = true;
            const spyTurn = jest.spyOn(turnService, 'startTurnTimer').mockReturnValue({ cancel: jest.fn(), remaining: 5 });
            turnService.resumeTimers(server, game);
            expect((turnService as any).timerPaused).toBe(false);
            expect((turnService as any).activeTimers.get(game.gameId).turnTimer.remaining).toEqual(5);
            spyTurn.mockRestore();
            jest.useRealTimers();
        });
        it('deletes active timer when resumed timer completes', () => {
            jest.useFakeTimers();
            const fakeTT = { cancel: jest.fn(), remaining: 5 };
            (turnService as any).activeTimers.set(game.gameId, { turnTimer: fakeTT });
            const spyTurn = jest.spyOn(turnService, 'startTurnTimer').mockImplementation((srv, g, d, cb) => {
                cb(false);
                return { cancel: jest.fn(), remaining: 0 };
            });
            turnService.resumeTimers(server, game);
            expect((turnService as any).activeTimers.has(game.gameId)).toBe(false);
            spyTurn.mockRestore();
            jest.useRealTimers();
        });
    });

    describe('cancelTimers', () => {
        it('cancels timers and removes them from activeTimers', () => {
            const preCancel = jest.fn();
            const ttCancel = jest.fn();
            (turnService as any).activeTimers.set(game.gameId, { preTimer: { cancel: preCancel }, turnTimer: { cancel: ttCancel, remaining: 10 } });
            turnService.cancelTimers(game.gameId);
            expect(preCancel).toHaveBeenCalled();
            expect(ttCancel).toHaveBeenCalled();
            expect((turnService as any).activeTimers.has(game.gameId)).toBe(false);
        });
    });

    describe('nextTurn', () => {
        it('updates the turn correctly', () => {
            game.currentPlayerIndex = 0;
            game.playerTurns = ['p1', 'p2'];
            game.players[0].isMyTurn = true;
            const newP = turnService.nextTurn(game);
            expect(game.currentPlayerIndex).toBe(1);
            expect(game.players[0].isMyTurn).toBe(false);
            expect(newP).toBeDefined();
            expect(newP.socketId).toBe('p2');
            expect(newP.isMyTurn).toBe(true);
            expect(newP.actionPoints).toBe(1);
            expect(newP.movementPoints).toBe(newP.speed);
        });
    });

    describe('turnBehaviour', () => {
        it('for non-bot: emits log/update without starting bot turn', () => {
            const nonBot = { ...player, isBot: false };
            const spyNext = jest.spyOn(turnService, 'nextTurn').mockReturnValue(nonBot);
            const fakeTo = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(fakeTo);
            const spyTimers = jest.spyOn(turnService, 'startTimers').mockImplementation(() => {});
            turnService.turnBehaviour(server, game);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(spyTimers).not.toHaveBeenCalled();
            spyNext.mockRestore();
            spyTimers.mockRestore();
        });
        it('for bot: starts timers and executes bot turn', () => {
            const bot = { ...player, isBot: true };
            const spyNext = jest.spyOn(turnService, 'nextTurn').mockReturnValue(bot);
            const fakeTo = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(fakeTo);
            const spyTimers = jest.spyOn(turnService, 'startTimers').mockImplementation(() => {});
            turnService.turnBehaviour(server, game);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(spyTimers).toHaveBeenCalledWith(server, game.gameId, bot, game);
            spyNext.mockRestore();
            spyTimers.mockRestore();
        });
        it('should emit updateLobby and cancel timers if game is ended', async () => {
            const fakeTo = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(fakeTo);
            const spyCancel = jest.spyOn(turnService, 'cancelTimers').mockImplementation(() => {});
            game.ended = true;

            await turnService.turnBehaviour(server, game);

            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(fakeTo.emit).toHaveBeenCalledWith('updateLobby', game);
            expect(spyCancel).toHaveBeenCalledWith(game.gameId);

            spyCancel.mockRestore();
        });
        it('should call botService and re-call turnBehaviour if no active combat', async () => {
            const bot = {
                ...player,
                isBot: true,
                name: 'Bot',
                startPosition: { x: 0, y: 0 },
            };

            game = {
                gameId: 'game1',
                players: [bot],
                playerTurns: [],
                currentPlayerIndex: 0,
                map: {},
            };

            const fakeTo = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(fakeTo);

            const spyNext = jest.spyOn(turnService, 'nextTurn').mockReturnValue(bot);
            const spyTimers = jest.spyOn(turnService, 'startTimers').mockImplementation(() => {});
            const spyDelay = jest.spyOn<any, any>(turnService as any, 'delay').mockResolvedValue(undefined);
            const spyCancel = jest.spyOn(turnService, 'cancelTimers').mockImplementation(() => {});
            const spyZob = jest.spyOn(turnService, 'turnBehaviour');

            let combatStateCallCount = 0;
            (combatService.getCombatState as jest.Mock).mockImplementation(() => {
                combatStateCallCount++;
                return combatStateCallCount === 1 ? null : { attacker: true };
            });

            (botService.runBotTurn as jest.Mock).mockResolvedValue(undefined);

            await turnService.turnBehaviour(server, game);

            expect(botService.runBotTurn).toHaveBeenCalledWith(expect.objectContaining({ socketId: 'p1' }), server, game);
            expect(server.to).toHaveBeenCalledWith(game.gameId);
            expect(fakeTo.emit).toHaveBeenCalledWith(GAME_EVENTS.MAP_UPDATED, game.map);
            expect(spyCancel).toHaveBeenCalledWith(game.gameId);
            expect(spyZob).toHaveBeenCalledTimes(2);

            spyNext.mockRestore();
            spyTimers.mockRestore();
            spyDelay.mockRestore();
            spyCancel.mockRestore();
            spyZob.mockRestore();
        });
    });

    describe('startTimers activeTimers deletion after turn timer completion', () => {
        it('removes active timer when turn timer completes normally', () => {
            jest.useFakeTimers();
            const toSpy = { emit: jest.fn() };
            (server.to as jest.Mock).mockReturnValue(toSpy);
            game.playerTurns = game.players.map((p) => p.socketId);
            game.currentPlayerIndex = 0;
            turnService.startTimers(server, game.gameId, player, game);
            expect((turnService as any).activeTimers.has(game.gameId)).toBe(true);
            jest.advanceTimersByTime(3000);
            expect((turnService as any).activeTimers.has(game.gameId)).toBe(true);
            jest.advanceTimersByTime(30000);
            expect((turnService as any).activeTimers.has(game.gameId)).toBe(false);
            jest.useRealTimers();
        });
    });
});
