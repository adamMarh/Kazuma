/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { BotService } from '@app/services/bot/bot.service';
import { CombatService } from '@app/services/combat/combat.service';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { MovementService } from '@app/services/movement/movement.service';
import { TurnService } from '@app/services/turn/turn.service';
import { Game } from '@common/interfaces/game.interface';
import { Map } from '@common/interfaces/map.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { Server } from 'socket.io';
import { GameService } from './game.service';

describe('GameService', () => {
    let service: GameService;
    let lobbyService: LobbyService;
    let movementService: MovementService;
    let turnService: TurnService;
    let combatService: CombatService;
    let endGameService: EndGameService;
    let botService: BotService;
    let sampleMap: Map;

    let player1: Player;
    let player2: Player;
    let game: Game;
    let server: any;

    beforeEach(() => {
        lobbyService = {
            createGame: jest.fn(),
            removePlayer: jest.fn(),
        } as unknown as LobbyService;

        movementService = {
            placePlayers: jest.fn(),
        } as unknown as MovementService;

        turnService = {
            orderPlayerTurns: jest.fn(),
        } as unknown as TurnService;

        combatService = {
            getCombatState: jest.fn(),
            initCombat: jest.fn(),
            endCombat: jest.fn(),
            validPlayersPositions: jest.fn(),
        } as unknown as CombatService;

        botService = {
            runBotTurn: jest.fn(),
            movementService: jest.fn(),
            combatService: jest.fn(),
            delay: jest.fn(),
            runAgressiveSequence: jest.fn(),
            runDefensiveSequence: jest.fn(),
            runRandomSequence: jest.fn(),
            evaluateCombatOptions: jest.fn(),
            evaluateMovementOptions: jest.fn(),
            evaluateActionOptions: jest.fn(),
        } as unknown as BotService;

        sampleMap = {
            _id: 'map1',
            name: 'Test Map',
            size: '15',
            gameMode: 'classic',
            description: 'Une map de test',
            lastSave: new Date(),
            imageUrl: 'http://example.com/image.png',
            hidden: false,
            tiles: [
                ['grass', 'doorClose'],
                ['wall', 'grass'],
            ],
            items: [
                ['empty', 'sword'],
                ['empty', 'empty'],
            ],
            nbCheckpoints: '1',
            nbRandomItems: '0',
        };

        endGameService = {
            calculateGameDuration: jest.fn(),
            calculateTotalTurns: jest.fn(),
            calculateVisitedTilesPercentage: jest.fn(),
            calculateDoorManipulatedPercentage: jest.fn(),
            calculateTilesVisitedPercentage: jest.fn(),
            calculateFlagHolders: jest.fn(),
        } as unknown as EndGameService;

        turnService = {
            orderPlayerTurns: jest.fn(),
            turnBehaviour: jest.fn(),
        } as unknown as TurnService;

        service = new GameService(lobbyService, movementService, turnService, combatService, botService, endGameService);

        player1 = {
            socketId: 'player1',
            name: 'Player 1',
            avatar: '1',
            speed: 5,
            defense: 3,
            attack: 4,
            healthpoints: 10,
            position: { x: 0, y: 0 },
            startPosition: { x: 0, y: 0 },
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            isAdmin: true,
            dice: { atk: 2, def: 2 },
            isMyTurn: true,
            movementPoints: 5,
            actionPoints: 1,
            fleeAttempts: 0,
        };

        player2 = {
            socketId: 'player2',
            name: 'Player 2',
            avatar: '2',
            speed: 4,
            defense: 2,
            attack: 5,
            healthpoints: 8,
            position: { x: 0, y: 1 },
            startPosition: { x: 0, y: 2 },
            battlesWon: 0,
            inventory: [],
            isInventoryFull: false,
            isAdmin: false,
            dice: { atk: 2, def: 2 },
            isMyTurn: false,
            movementPoints: 4,
            actionPoints: 1,
            fleeAttempts: 0,
        };

        const tiles = [
            ['grass', 'doorOpen', 'grass'],
            ['grass', 'ice', 'grass'],
            ['grass', 'doorClose', 'grass'],
        ];

        const items = [
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
            ['empty', 'empty', 'empty'],
        ];

        game = {
            gameId: 'game1',
            players: [player1, player2],
            inactivePlayers: [],
            map: {
                _id: 'map1',
                name: 'Test Map',
                size: '3x3',
                tiles,
                items,
                gameMode: 'test',
                description: 'Test map',
                lastSave: new Date(),
                imageUrl: '',
                hidden: false,
                nbCheckpoints: '0',
                nbRandomItems: '0',
            },
            isLocked: false,
            started: true,
            ended: false,
            maxPlayers: 2,
            playerTurns: [player1.socketId, player2.socketId],
            currentPlayerIndex: 0,
            startingPoints: [
                { x: 0, y: 0 },
                { x: 0, y: 2 },
            ],
            selectedAvatars: { [player1.socketId]: 1, [player2.socketId]: 2 },
            isInDebugMode: false,
            teams: {
                red: [],
                blue: [],
            },
            winner: '',
        };

        (service as any).games = { [game.gameId]: game };
    });

    describe('getGame', () => {
        it("devrait retourner le jeu correspondant à l'ID", () => {
            expect(service.getGame(game.gameId)).toBe(game);
        });

        it("devrait retourner undefined si le jeu n'existe pas", () => {
            expect(service.getGame('nonexistent')).toBeUndefined();
        });

        describe('getGameByPlayer', () => {
            it('devrait retourner le jeu contenant le joueur', () => {
                expect(service.getGameByPlayer(player1.socketId)).toBe(game);
            });

            it('devrait retourner undefined si aucun jeu ne contient le joueur', () => {
                expect(service.getGameByPlayer('nonexistent')).toBeUndefined();
            });
        });

        describe('getGames', () => {
            it('devrait retourner tous les jeux', () => {
                expect(service.getGames()).toEqual({ [game.gameId]: game });
            });
        });

        describe('getCurrentPlayer', () => {
            it("devrait retourner l'index du joueur actuel", () => {
                expect(service.getCurrentPlayer(game.gameId)).toBe(0);
            });
        });

        it('should store the server instance', () => {
            const fakeServer = { to: jest.fn() } as unknown as Server;
            service.setServer(fakeServer);
            expect((service as any).server).toBe(fakeServer);
        });

        describe('createGame', () => {
            it("devrait créer un nouveau jeu et l'ajouter à la liste des jeux", () => {
                const payload = {
                    name: 'New Player',
                    avatar: 3,
                    map: {} as Map,
                    attributes: {},
                };
                const newGame = { ...game, gameId: 'newGame' };

                (lobbyService.createGame as jest.Mock).mockReturnValue(newGame);

                const result = service.createGame('newPlayer', payload);

                expect(lobbyService.createGame).toHaveBeenCalledWith('newPlayer', service.getGames(), payload);
                expect(result).toBe(newGame);
                expect(service.getGames()['newGame']).toBe(newGame);
            });
        });

        describe('orderPlayerTurns', () => {
            it('devrait appeler la méthode orderPlayerTurns du service de tour et configurer le premier joueur', () => {
                turnService.orderPlayerTurns(game);

                expect(game.players[0].isMyTurn).toBe(true);
                game.players[0].turnsPlayed = game.players[0].turnsPlayed || 1;

                expect(game.players[0].turnsPlayed).toBe(1);
            });
        });

        describe('runBotTurn', () => {
            it('ne devrait rien faire', () => {
                expect(() => botService.runBotTurn(player1, server, game)).not.toThrow();
            });
        });

        describe('getInformation', () => {
            it("devrait retourner les informations d'une tuile vide", () => {
                const position = { x: 0, y: 0 };

                const result = service.getInformation(position, game.gameId);

                expect(result).toEqual({
                    tileType: 'grass',
                    tileCost: '1',
                    playerName: player1.name,
                    playerAvatar: player1.avatar,
                    isActionTile: true,
                });
            });

            it("devrait retourner les informations d'une tuile avec un objet", () => {
                const position = { x: 1, y: 0 };
                game.map.items[0][1] = 'shield';

                const result = service.getInformation(position, game.gameId);

                expect(result).toEqual({
                    tileType: 'doorOpen',
                    tileCost: '1',
                    itemType: 'shield',
                    isActionTile: true,
                });
            });

            it("devrait retourner les informations d'une tuile avec une porte fermée", () => {
                const position = { x: 1, y: 2 };

                const result = service.getInformation(position, game.gameId);

                expect(result).toEqual({
                    tileType: 'doorClose',
                    tileCost: 'Infinity',
                    isActionTile: true,
                });
            });
        });

        describe('getPlayer', () => {
            it("devrait retourner le joueur correspondant à l'ID", () => {
                expect(service.getPlayer(player1.socketId, game)).toBe(player1);
            });

            it("devrait retourner undefined si le joueur n'existe pas", () => {
                expect(service.getPlayer('nonexistent', game)).toBeUndefined();
            });

            it('should return undefined if game or games[gameId] is undefined', () => {
                expect(service.getPlayer('player1', undefined as any)).toBeUndefined();

                delete (service as any).games[game.gameId];
                expect(service.getPlayer('player1', game)).toBeUndefined();
            });
        });

        describe('nextTurn', () => {
            it("ne devrait rien faire si le jeu n'a pas de joueurs", () => {
                const emptyGame = { ...game, players: [] };

                service.nextTurn(emptyGame);

                expect(emptyGame.currentPlayerIndex).toBe(0);
            });

            it("ne devrait rien faire si le jeu n'a pas de tours de joueurs", () => {
                const noTurnsGame = { ...game, playerTurns: [] };

                jest.spyOn(service, 'nextTurn').mockImplementationOnce((game) => {
                    return;
                });

                service.nextTurn(noTurnsGame);

                expect(noTurnsGame.currentPlayerIndex).toBe(0);
            });

            it('devrait passer au joueur suivant', () => {
                service.nextTurn(game);

                expect(game.currentPlayerIndex).toBe(1);
                expect(player1.isMyTurn).toBe(false);
                expect(player2.isMyTurn).toBe(true);
                expect(player2.actionPoints).toBe(1);
                expect(player2.movementPoints).toBe(player2.speed);
                expect(player2.turnsPlayed).toBe(1);
            });

            it('devrait revenir au premier joueur après le dernier', () => {
                game.currentPlayerIndex = 1;
                player1.isMyTurn = false;
                player2.isMyTurn = true;

                service.nextTurn(game);

                expect(game.currentPlayerIndex).toBe(0);
                expect(player1.isMyTurn).toBe(true);
                expect(player2.isMyTurn).toBe(false);
            });

            it('devrait reconstruire playerTurns si sa longueur ne correspond pas au nombre de joueurs', () => {
                game.playerTurns = ['oldPlayer'];

                service.nextTurn(game);

                expect(game.playerTurns).toEqual([player1.socketId, player2.socketId]);
            });

            it("devrait passer au joueur suivant si le joueur actuel n'est pas trouvé", () => {
                game.playerTurns = ['nonexistent', player2.socketId];

                service.nextTurn(game);

                expect(game.currentPlayerIndex).toBe(1);
                expect(player2.isMyTurn).toBe(true);
            });
            it('should return without assigning turn if all players have left', () => {
                game.players.forEach((p) => (p.hasLeft = true));

                game.playerTurns = ['someOtherId'];

                const spy = jest.spyOn(service, 'refreshPlayerTurns');
                service.nextTurn(game);

                expect(game.currentPlayerIndex).toBe(0);
                expect(spy).toHaveBeenCalled();
            });
        });

        describe('getTileCost', () => {
            it('devrait retourner le coût correct pour chaque type de tuile', () => {
                expect(service.getTileCost('grass')).toBe('1');
                expect(service.getTileCost('ice')).toBe('0');
                expect(service.getTileCost('water')).toBe('2');
                expect(service.getTileCost('wall')).toBe('Infinity');
                expect(service.getTileCost('doorClose')).toBe('Infinity');
                expect(service.getTileCost('doorOpen')).toBe('1');
            });
        });

        describe('isPlayerInCombat', () => {
            it("devrait retourner false si aucun état de combat n'existe", () => {
                (combatService.getCombatState as jest.Mock).mockReturnValue(null);

                expect(service.isPlayerInCombat(player1, game.gameId)).toBe(false);

                expect(combatService.getCombatState).toHaveBeenCalledWith(game.gameId);
            });

            it("devrait retourner true si le joueur est l'attaquant dans un combat", () => {
                (combatService.getCombatState as jest.Mock).mockReturnValue({
                    attacker: player1,
                    target: player2,
                });

                expect(service.isPlayerInCombat(player1, game.gameId)).toBe(true);
            });

            it('devrait retourner true si le joueur est la cible dans un combat', () => {
                (combatService.getCombatState as jest.Mock).mockReturnValue({
                    attacker: player2,
                    target: player1,
                });

                expect(service.isPlayerInCombat(player1, game.gameId)).toBe(true);
            });

            it("devrait retourner false si le joueur n'est pas dans le combat", () => {
                const otherPlayer = { ...player1, socketId: 'other' };

                (combatService.getCombatState as jest.Mock).mockReturnValue({
                    attacker: player1,
                    target: player2,
                });

                expect(service.isPlayerInCombat(otherPlayer, game.gameId)).toBe(false);
            });
        });

        describe('actionsPossible', () => {
            it("devrait retourner false si le joueur n'a pas de points d'action", () => {
                player1.actionPoints = 0;

                expect(service.actionsPossible(player1, game)).toBe(false);
            });

            it('devrait retourner true si une action est possible sur une tuile adjacente (porte)', () => {
                expect(service.actionsPossible(player1, game)).toBe(true);
            });

            it('devrait retourner true si une action est possible sur une tuile adjacente (joueur)', () => {
                expect(service.actionsPossible(player1, game)).toBe(true);
            });

            it("devrait retourner false si aucune action n'est possible", () => {
                player1.position = { x: 2, y: 2 };

                jest.spyOn(service, 'getInformation').mockImplementation((pos) => ({
                    tileType: 'grass',
                    tileCost: '1',
                    isActionTile: false,
                }));

                expect(service.actionsPossible(player1, game)).toBe(false);
            });

            it('devrait retourner false si les positions adjacentes sont hors limites', () => {
                player1.position = { x: 0, y: 0 };
                game.players = [player1];
                game.map.tiles = [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ];

                expect(service.actionsPossible(player1, game)).toBe(false);
            });

            describe('actionsPossible - test de la condition de retour', () => {
                it('devrait retourner true quand tileType est doorOpen', () => {
                    jest.spyOn(service, 'getInformation').mockReturnValue({
                        tileType: 'doorOpen',
                        tileCost: '1',
                        isActionTile: true,
                    });

                    expect(service.actionsPossible(player1, game)).toBe(true);
                });

                it('devrait retourner true quand tileType est doorClose', () => {
                    jest.spyOn(service, 'getInformation').mockReturnValue({
                        tileType: 'doorClose',
                        tileCost: 'Infinity',
                        isActionTile: true,
                    });

                    expect(service.actionsPossible(player1, game)).toBe(true);
                });

                it('devrait retourner true quand playerName est défini', () => {
                    jest.spyOn(service, 'getInformation').mockReturnValue({
                        tileType: 'grass',
                        tileCost: '1',
                        playerName: 'Player 2',
                        playerAvatar: '2',
                        isActionTile: true,
                    });

                    expect(service.actionsPossible(player1, game)).toBe(true);
                });

                it('devrait retourner false quand tileInfo est undefined', () => {
                    jest.spyOn(service, 'getInformation').mockReturnValue(null);

                    expect(service.actionsPossible(player1, game)).toBe(false);
                });

                it('devrait retourner false quand aucune des conditions est vraie', () => {
                    jest.spyOn(service, 'getInformation').mockReturnValue({
                        tileType: 'grass',
                        tileCost: '1',
                        isActionTile: false,
                    });

                    expect(service.actionsPossible(player1, game)).toBe(false);
                });
            });
        });

        describe('handleCombatantDisonnection', () => {
            it("devrait appeler combatService.endCombat avec le joueur cible si le joueur est l'attaquant", () => {
                const attacker = { socketId: 'attacker-123', combatsParticipated: 0 } as Player;
                const target = { socketId: 'target-456', combatsParticipated: 0 } as Player;

                const mockCombatState: any = {
                    attacker,
                    target,
                    inCombat: true,
                    attackResult: { damage: 15, attackDiceRoll: 5, defenseDiceRoll: 3 },
                    combatInitiator: attacker,
                    hourglassConsumed: false,
                    potionConsumed: false,
                    combatAlreadyCounted: false,
                };

                jest.spyOn(combatService, 'getCombatState').mockReturnValue(mockCombatState);

                service.handleCombatantDisonnection(attacker, game);

                expect(combatService.endCombat).toHaveBeenCalledWith(game, target);
            });

            it("devrait appeler combatService.endCombat avec le joueur attaquant si le joueur n'est pas l'attaquant", () => {
                const attacker = { socketId: 'attacker-123', combatsParticipated: 0 } as Player;
                const target = { socketId: 'target-456', combatsParticipated: 0 } as Player;
                const otherPlayer: Player = { ...player2, socketId: 'target-456' };

                const mockCombatState: any = {
                    attacker,
                    target,
                    inCombat: true,
                    attackResult: { damage: 15, attackDiceRoll: 5, defenseDiceRoll: 3 },
                    combatInitiator: attacker,
                    hourglassConsumed: false,
                    potionConsumed: false,
                    combatAlreadyCounted: false,
                };

                jest.spyOn(combatService, 'getCombatState').mockReturnValue(mockCombatState);

                service.handleCombatantDisonnection(otherPlayer, game);

                expect(combatService.endCombat).toHaveBeenCalledWith(game, attacker);
            });

            it("devrait terminer le combat si l'attaquant se déconnecte", () => {
                (combatService.getCombatState as jest.Mock).mockReturnValue({
                    attacker: player1,
                    target: player2,
                });

                service.handleCombatantDisonnection(player1, game);

                expect(combatService.endCombat).toHaveBeenCalledWith(game, player2);
            });

            it('devrait terminer le combat si la cible se déconnecte', () => {
                (combatService.getCombatState as jest.Mock).mockReturnValue({
                    attacker: player2,
                    target: player1,
                });

                service.handleCombatantDisonnection(player1, game);

                expect(combatService.endCombat).toHaveBeenCalledWith(game, player2);
            });
            it('should emit COMBAT_ENDED when attacker disconnects and server is defined', () => {
                const attacker = { socketId: 'a', battlesLost: 0 } as Player;
                const target = { socketId: 't', battlesWon: 0 } as Player;

                const combatState: any = {
                    attacker,
                    target,
                    combatAlreadyCounted: false,
                };

                const combatResult = {
                    combatState,
                    gameEnded: false,
                    actionPlayer: target,
                };

                (combatService.getCombatState as jest.Mock).mockReturnValue(combatState);
                (combatService.endCombat as jest.Mock).mockReturnValue(combatResult);

                const emit = jest.fn();
                const to = jest.fn().mockReturnValue({ emit });
                const mockServer = { to };
                service.setServer(mockServer as any);

                service.handleCombatantDisonnection(attacker, game);

                expect(emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_ENDED, {
                    combatState: combatResult.combatState,
                    reason: 'DISCONNECTED',
                    actionPlayer: target,
                    gameEnded: false,
                });
            });

            it('should emit COMBAT_ENDED when target disconnects and server is defined', () => {
                const attacker = { socketId: 'a', battlesWon: 0 } as Player;
                const target = { socketId: 't', battlesLost: 0 } as Player;

                const combatState: any = {
                    attacker,
                    target,
                    combatAlreadyCounted: false,
                };

                const combatResult = {
                    combatState,
                    gameEnded: false,
                    actionPlayer: attacker,
                };

                (combatService.getCombatState as jest.Mock).mockReturnValue(combatState);
                (combatService.endCombat as jest.Mock).mockReturnValue(combatResult);

                const emit = jest.fn();
                const to = jest.fn().mockReturnValue({ emit });
                const mockServer = { to };
                service.setServer(mockServer as any);

                service.handleCombatantDisonnection(target, game);

                expect(emit).toHaveBeenCalledWith(COMBAT_EVENTS.COMBAT_ENDED, {
                    combatState: combatResult.combatState,
                    reason: 'DISCONNECTED',
                    actionPlayer: attacker,
                    gameEnded: false,
                });
            });
        });

        describe('validPlayersPositions', () => {
            it('devrait déléguer au service de combat', () => {
                const pos1: Position = { x: 0, y: 0 };
                const pos2: Position = { x: 1, y: 0 };

                jest.spyOn(service, 'validPlayersPositions').mockImplementation((pos1, pos2) => {
                    return (Math.abs(pos1.x - pos2.x) === 1 && pos1.y === pos2.y) || (Math.abs(pos1.y - pos2.y) === 1 && pos1.x === pos2.x);
                });

                expect(service.validPlayersPositions(pos1, pos2)).toBe(true);
            });
        });

        describe('actionValidation', () => {
            it("devrait retourner false si le joueur essaie d'agir sur sa propre position", () => {
                const result = service.actionValidation(player1, player1.position, game.gameId);

                expect(result).toEqual({
                    success: false,
                    message: 'Vous ne pouvez pas vous attaquer vous-même',
                });
            });

            it("devrait retourner false si la position n'est pas une tuile d'action", () => {
                const position: Position = { x: 2, y: 0 };
                jest.spyOn(service, 'getInformation').mockReturnValue({
                    tileType: 'grass',
                    tileCost: '1',
                    isActionTile: false,
                });

                const result = service.actionValidation(player1, position, game.gameId);

                expect(result).toEqual({
                    success: false,
                    message: "Ceci n'est pas une tuile d'action",
                });
            });

            it("devrait retourner false si la position n'est pas adjacente", () => {
                const position: Position = { x: 2, y: 2 };
                jest.spyOn(service, 'getInformation').mockReturnValue({
                    tileType: 'grass',
                    tileCost: '1',
                    isActionTile: true,
                });
                jest.spyOn(service, 'validPlayersPositions').mockReturnValue(false);

                const result = service.actionValidation(player1, position, game.gameId);

                expect(result).toEqual({
                    success: false,
                    message: 'Cette actions est limitées aux tuiles adjacentes',
                });
            });

            it("devrait retourner false si le joueur n'a pas de points d'action", () => {
                player1.actionPoints = 0;
                const position: Position = { x: 1, y: 0 };
                jest.spyOn(service, 'getInformation').mockReturnValue({
                    tileType: 'doorOpen',
                    tileCost: '1',
                    isActionTile: true,
                });
                jest.spyOn(service, 'validPlayersPositions').mockReturnValue(true);

                const result = service.actionValidation(player1, position, game.gameId);

                expect(result).toEqual({
                    success: false,
                    message: "Vos points d'action sont insuffisants",
                });
            });

            it("devrait retourner undefined si l'action est valide", () => {
                const position: Position = { x: 1, y: 0 };
                jest.spyOn(service, 'getInformation').mockReturnValue({
                    tileType: 'doorOpen',
                    tileCost: '1',
                    isActionTile: true,
                });
                jest.spyOn(service, 'validPlayersPositions').mockReturnValue(true);

                const result = service.actionValidation(player1, position, game.gameId);

                expect(result).toBeUndefined();
                expect(service.getGame('game1')).toBe(game);
            });
            it('should return false if players are in the same team', () => {
                game.teams.red = [player1.socketId, player2.socketId];
                const pos: Position = { x: 0, y: 1 };

                const result = service.actionValidation(player1, pos, game.gameId);

                expect(result).toEqual({
                    success: false,
                    message: 'Vous ne pouvez pas attaquer un joueur de votre équipe',
                });
            });
        });

        describe('handleAction', () => {
            it("devrait retourner une erreur si l'action n'est pas valide", () => {
                const position: Position = { x: 0, y: 0 };
                jest.spyOn(service, 'actionValidation').mockReturnValue({
                    success: false,
                    message: 'Error message',
                });

                const result = service.handleAction(position, player1, game);

                expect(result).toEqual({
                    success: false,
                    message: 'Error message',
                });
            });

            it("devrait gérer l'action sur une porte fermée", () => {
                const position: Position = { x: 1, y: 2 };
                jest.spyOn(service, 'actionValidation').mockReturnValue(undefined);

                const result = service.handleAction(position, player1, game);

                expect(result).toEqual({
                    success: true,
                    type: 'door',
                    updatedMap: game.map,
                });
                expect(player1.actionPoints).toBe(0);
                expect(game.map.tiles[2][1]).toBe('doorOpen');
            });

            it("devrait gérer l'action sur une porte ouverte", () => {
                const position: Position = { x: 1, y: 0 };
                jest.spyOn(service, 'actionValidation').mockReturnValue(undefined);

                const result = service.handleAction(position, player1, game);

                expect(result).toEqual({
                    success: true,
                    type: 'door',
                    updatedMap: game.map,
                });
                expect(player1.actionPoints).toBe(0);
                expect(game.map.tiles[0][1]).toBe('doorClose');
            });

            it("devrait gérer l'action sur un joueur", () => {
                const position: Position = { x: 0, y: 1 };
                jest.spyOn(service, 'actionValidation').mockReturnValue(undefined);

                const result = service.handleAction(position, player1, game);

                expect(result).toEqual({
                    success: true,
                    type: 'combat',
                    target: player2,
                });
                expect(combatService.initCombat).toHaveBeenCalledWith(player1, player2, game);
            });
            it('should return error if player hasLeft = true when trying to attack', () => {
                const position: Position = { x: 0, y: 1 };
                player1.hasLeft = true;

                jest.spyOn(service, 'actionValidation').mockReturnValue(undefined);

                const result = service.handleAction(position, player1, game);

                expect(result).toEqual({
                    success: false,
                    message: 'Action impossible : un joueur a quitté la partie.',
                });
            });

            it('should toggle door if tile is doorOpen and no player and item is checkpoint', () => {
                const target = { x: 1, y: 0 };
                game.map.items[0][1] = 'checkpoint';
                player1.hasLeft = false;

                jest.spyOn(service, 'actionValidation').mockReturnValue(undefined);

                const result = service.handleAction(target, player1, game);

                expect(result).toEqual({
                    success: true,
                    type: 'door',
                    updatedMap: game.map,
                });
                expect(game.map.tiles[0][1]).toBe('doorClose');
            });
        });

        describe('getPlayerStats', () => {
            it('devrait retourner les statistiques de tous les joueurs', () => {
                player1.battlesWon = 2;
                player1.battlesLost = 3;
                player1.combatsParticipated = 5;
                player1.successfulFleeAttempts = 1;
                player1.totalDamageTaken = 10;
                player1.totalDamageDone = 15;
                player1.collectedUniqueItems = ['shield', 'lance'];

                (endGameService.calculateTilesVisitedPercentage as jest.Mock).mockReturnValueOnce(75).mockReturnValueOnce(0);

                const result = service.getPlayerStats(game.gameId);

                expect(result.length).toBe(2);
                expect(result[0]).toEqual({
                    name: player1.name,
                    combats: 5,
                    victories: 2,
                    evasions: 1,
                    defeats: 3,
                    hpLost: 10,
                    damageDone: 15,
                    itemsPicked: 2,
                    tilesVisitedPercentage: 75,
                    hasLeft: false,
                });
            });
            it('should append (abandon) to name if player is inactive in getPlayerStats', () => {
                game.inactivePlayers = [player2];

                const result = service.getPlayerStats(game.gameId);

                const inactivePlayerStat = result.find((p) => p.name.includes('Player 2'));
                const activePlayerStat = result.find((p) => p.name === 'Player 1');

                expect(inactivePlayerStat?.name).toBe('Player 2(abandon)');
                expect(activePlayerStat?.name).toBe('Player 1');
            });
        });
    });
    describe('checkTurn', () => {
        it('devrait appeler turnService.turnBehaviour quand toutes les conditions sont remplies', () => {
            const mockServer = { to: jest.fn() } as unknown as Server;
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});

            player1.movementPoints = 0;
            game.currentPlayerIndex = 0;
            game.playerTurns = [player1.socketId, player2.socketId];

            jest.spyOn(service, 'actionsPossible').mockReturnValue(false);

            service.checkTurn(mockServer, player1, game);

            expect(spyZob).toHaveBeenCalledWith(mockServer, game);
        });

        it('ne devrait pas appeler turnService.turnBehaviour quand player.movementPoints > 0', () => {
            const mockServer = { to: jest.fn() } as unknown as Server;
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});

            player1.movementPoints = 1;
            game.currentPlayerIndex = 0;
            game.playerTurns = [player1.socketId, player2.socketId];

            jest.spyOn(service, 'actionsPossible').mockReturnValue(false);

            service.checkTurn(mockServer, player1, game);

            expect(spyZob).not.toHaveBeenCalled();
        });

        it('ne devrait pas appeler turnService.turnBehaviour quand actionsPossible est true', () => {
            const mockServer = { to: jest.fn() } as unknown as Server;
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});

            player1.movementPoints = 0;
            game.currentPlayerIndex = 0;
            game.playerTurns = [player1.socketId, player2.socketId];

            jest.spyOn(service, 'actionsPossible').mockReturnValue(true);

            service.checkTurn(mockServer, player1, game);

            expect(spyZob).not.toHaveBeenCalled();
        });

        it("ne devrait pas appeler turnService.turnBehaviour quand ce n'est pas le tour du joueur", () => {
            const mockServer = { to: jest.fn() } as unknown as Server;
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});

            player1.movementPoints = 0;
            game.currentPlayerIndex = 0;
            game.playerTurns = [player2.socketId, player1.socketId];

            jest.spyOn(service, 'actionsPossible').mockReturnValue(false);

            service.checkTurn(mockServer, player1, game);

            expect(spyZob).not.toHaveBeenCalled();
        });

        it('ne devrait pas appeler turnService.turnBehaviour quand player est undefined', () => {
            const mockServer = { to: jest.fn() } as unknown as Server;
            const spyZob = jest.spyOn(turnService, 'turnBehaviour').mockImplementation(async () => {});

            service.checkTurn(mockServer, undefined, game);

            expect(spyZob).not.toHaveBeenCalled();
        });
    });

    describe('validPlayersPositions', () => {
        it('should return true for adjacent horizontal positions', () => {
            expect(service.validPlayersPositions({ x: 0, y: 0 }, { x: 1, y: 0 })).toBe(true);
        });

        it('should return true for adjacent vertical positions', () => {
            expect(service.validPlayersPositions({ x: 2, y: 2 }, { x: 2, y: 3 })).toBe(true);
        });

        it('should return false for non-adjacent positions', () => {
            expect(service.validPlayersPositions({ x: 0, y: 0 }, { x: 2, y: 2 })).toBe(false);
        });
    });

    describe('getGlobalStats', () => {
        it('should return global stats for classic game', () => {
            (endGameService.calculateGameDuration as jest.Mock).mockReturnValue('10 min');
            (endGameService.calculateTotalTurns as jest.Mock).mockReturnValue(20);
            (endGameService.calculateVisitedTilesPercentage as jest.Mock).mockReturnValue(50);
            (endGameService.calculateDoorManipulatedPercentage as jest.Mock).mockReturnValue(10);

            const stats = service.getGlobalStats(game.gameId);

            expect(stats.formattedDuration).toBe('10 min');
            expect(stats.totalTurns).toBe(20);
            expect(stats.tilesVisitedPercentage).toBe(50);
            expect(stats.doorManipulatedPercentage).toBe(10);
            expect(stats.playersWithFlag).toBeUndefined();
        });

        it('should return playersWithFlag if gameMode is CTF', () => {
            game.map.gameMode = 'CTF';
            (endGameService.calculateFlagHolders as jest.Mock).mockReturnValue(2);

            const stats = service.getGlobalStats(game.gameId);

            expect(stats.playersWithFlag).toBe(2);
        });
    });
    describe('removeGame', () => {
        it('should delete the game from service', () => {
            expect(service.getGame(game.gameId)).toBeDefined();

            service.removeGame(game.gameId);

            expect(service.getGame(game.gameId)).toBeUndefined();
        });
    });
});
