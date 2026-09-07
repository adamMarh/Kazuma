/* eslint-disable @typescript-eslint/naming-convention */
/* eslint-disable quote-props */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines */
import { Map as GameMap } from '@common/interfaces/map.interface';
import { MapsService } from '@app/services/maps/maps.service';
import { LobbyService } from '@app/services/lobby/lobby.service';

describe('LobbyService', () => {
    let lobbyService: LobbyService;
    let mapService: Partial<MapsService>;

    beforeEach(() => {
        mapService = {
            getStartingPoints: jest.fn().mockReturnValue({ x: 0, y: 0 }),
        };
        lobbyService = new LobbyService(mapService as MapsService);
    });

    describe('generateGameId', () => {
        it('should generate a unique id that is not already present in games', () => {
            const games = { '12345': {}, '67890': {} };

            const id = (lobbyService as any).generateGameId(games);
            expect(games[id]).toBeUndefined();
            expect(typeof id).toBe('string');
        });
    });

    describe('createGame', () => {
        const clientId = 'client1';
        const testMap: GameMap = {
            name: 'Test Map',
            size: '15',
            gameMode: 'classic',
            description: 'Une map de test',
            lastSave: new Date(),
            imageUrl: 'http://example.com/image.png',
            hidden: false,
            tiles: [['empty']],
            items: [['empty']],
            nbCheckpoints: '1',
            nbRandomItems: '0',
        };

        const payload = {
            name: 'TestGame',
            avatar: 1,
            map: testMap,
            attributes: {
                spd: { value: 10, dice: 2 },
                def: { value: 5, dice: 1 },
                atk: { value: 7, dice: 3 },
                hp: { value: 20 },
            },
        };

        it('should create a game with the correct properties for a map of size 15', () => {
            const games = {};
            jest.spyOn(lobbyService as any, 'generateGameId').mockReturnValue('game123');
            const game = lobbyService.createGame(clientId, games, payload);
            expect(game.gameId).toBe('game123');
            expect(game.players.length).toBe(1);
            expect(game.players[0]).toMatchObject({
                socketId: clientId,
                name: payload.name,
                avatar: payload.avatar.toString(),
                speed: payload.attributes.spd.value,
                defense: payload.attributes.def.value,
                attack: payload.attributes.atk.value,
                healthpoints: payload.attributes.hp.value,
                isAdmin: true,
                movementPoints: payload.attributes.spd.value,
                actionPoints: 1,
                fleeAttempts: 0,
            });
            expect(game.isLocked).toBe(false);
            expect(game.started).toBe(false);
            expect(game.ended).toBe(false);

            expect(game.maxPlayers).toBe(4);
            expect(game.playerTurns).toEqual([clientId]);
            expect(game.currentPlayerIndex).toBe(0);
            expect(game.startingPoints).toEqual({ x: 0, y: 0 });
            expect(game.selectedAvatars).toEqual({ [clientId]: payload.avatar });
            expect(game.isInDebugMode).toBe(false);
        });

        it('should set maxPlayers to 6 for a map of size 20', () => {
            const games = {};
            jest.spyOn(lobbyService as any, 'generateGameId').mockReturnValue('game456');
            const payload20 = { ...payload, map: { ...testMap, size: '20' } };
            const game = lobbyService.createGame(clientId, games, payload20);
            expect(game.maxPlayers).toBe(6);
        });

        it('should set maxPlayers to 2 for a map size other than 15 or 20', () => {
            const games = {};
            jest.spyOn(lobbyService as any, 'generateGameId').mockReturnValue('game789');
            const payloadOther = { ...payload, map: { ...testMap, size: '10' } };
            const game = lobbyService.createGame(clientId, games, payloadOther);
            expect(game.maxPlayers).toBe(2);
        });
    });

    describe('joinGame', () => {
        const clientId = 'client2';
        const attributes = {
            spd: { value: 8, dice: 2 },
            def: { value: 4, dice: 1 },
            atk: { value: 6, dice: 3 },
            hp: { value: 18 },
        };
        let game: any;

        beforeEach(() => {
            game = {
                gameId: 'game1',
                players: [],
                playerTurns: [],
                selectedAvatars: {},
                isLocked: false,
                maxPlayers: 3,
                map: { items: [] },
            };
        });

        it('should add a new player with a unique name and update the game without locking if the game is not full', () => {
            game.players.push({ socketId: 'clientExisting', name: 'Alice' });
            game.playerTurns.push('clientExisting');
            game.selectedAvatars['clientExisting'] = 1;

            lobbyService.joinGame(clientId, game, 'Bob', 2, attributes);
            const newPlayer = game.players.find((p: any) => p.socketId === clientId);
            expect(newPlayer).toBeDefined();
            expect(newPlayer.name).toBe('Bob');
            expect(newPlayer.avatar).toBe('2');
            expect(game.playerTurns).toContain(clientId);
            expect(game.selectedAvatars[clientId]).toBe(2);
            expect(game.isLocked).toBe(false);
        });

        it('should lock the room if the number of players reaches or exceeds maxPlayers', () => {
            game.maxPlayers = 2;
            game.players.push({ socketId: 'clientExisting', name: 'Alice' });
            game.playerTurns.push('clientExisting');
            game.selectedAvatars['clientExisting'] = 1;

            lobbyService.joinGame(clientId, game, 'Alice', 3, attributes);
            expect(game.players.length).toBe(2);
            expect(game.isLocked).toBe(true);
        });

        it('should generate a unique name if the name is already taken', () => {
            game.players.push({ socketId: 'client1', name: 'Charlie' });
            game.playerTurns.push('client1');
            lobbyService.joinGame(clientId, game, 'Charlie', 4, attributes);
            const newPlayer = game.players.find((p: any) => p.socketId === clientId);
            expect(newPlayer).toBeDefined();
            expect(newPlayer.name).toBe('Charlie-2');
        });
    });

    describe('removePlayer', () => {
        let game: any;
        beforeEach(() => {
            game = {
                gameId: 'game1',
                players: [],
                playerTurns: [],
                selectedAvatars: {},
                map: { items: [['item']] },
            };
        });

        it('should remove the admin player and reset selectedAvatars of the instance', () => {
            const adminPlayer = { socketId: 'admin1', isAdmin: true, position: { x: 0, y: 0 } };
            game.players.push(adminPlayer);
            game.playerTurns.push(adminPlayer.socketId);
            game.selectedAvatars['admin1'] = '1';
            lobbyService.removePlayer(game, adminPlayer.socketId);
            expect(game.selectedAvatars).toEqual({});
        });

        it('should remove a non-admin player, delete their selected avatar, remove them from players and update the map', () => {
            const player = { socketId: 'player1', isAdmin: false, position: { x: 0, y: 0 } };
            game.players.push(player);
            game.selectedAvatars['player1'] = '2';
            game.map.items = [['occupied']];
            lobbyService.removePlayer(game, 'player1');
            expect(game.players.find((p: any) => p.socketId === 'player1')).toBeUndefined();
            expect(game.selectedAvatars['player1']).toBeUndefined();
            expect(game.map.items[0][0]).toBe('empty');
        });
    });

    describe('lockRoom', () => {
        it('should lock the room and return true if an admin is found', () => {
            const game: any = {
                gameId: 'game1',
                players: [{ socketId: 'admin1', isAdmin: true }],
                isLocked: false,
            };
            const result = lobbyService.lockRoom(game, 'admin1');
            expect(result).toBe(true);
            expect(game.isLocked).toBe(true);
        });

        it('should return false if no admin is found', () => {
            const game: any = {
                gameId: 'game1',
                players: [{ socketId: 'player1', isAdmin: false }],
                isLocked: false,
            };
            const result = lobbyService.lockRoom(game, 'player1');
            expect(result).toBe(false);
            expect(game.isLocked).toBe(false);
        });
    });

    describe('unlockRoom', () => {
        it('should unlock the room and return true if an admin exists and the number of players is less than maxPlayers', () => {
            const game: any = {
                gameId: 'game1',
                players: [{ socketId: 'admin1', isAdmin: true }],
                isLocked: true,
                maxPlayers: 3,
            };
            const result = lobbyService.unlockRoom(game, 'admin1');
            expect(result).toBe(true);
            expect(game.isLocked).toBe(false);
        });

        it('should return false if no admin is found', () => {
            const game: any = {
                gameId: 'game1',
                players: [{ socketId: 'player1', isAdmin: false }],
                isLocked: true,
                maxPlayers: 3,
            };
            const result = lobbyService.unlockRoom(game, 'player1');
            expect(result).toBe(false);
            expect(game.isLocked).toBe(true);
        });

        it('should return false if the number of players equals or exceeds maxPlayers', () => {
            const game: any = {
                gameId: 'game1',
                players: [
                    { socketId: 'admin1', isAdmin: true },
                    { socketId: 'player1', isAdmin: false },
                ],
                isLocked: true,
                maxPlayers: 2,
            };
            const result = lobbyService.unlockRoom(game, 'admin1');
            expect(result).toBe(false);
            expect(game.isLocked).toBe(true);
        });
    });

    describe('generateUniqueName', () => {
        it('should return the same name if it is unique', () => {
            const game: any = {
                players: [{ name: 'Unique' }],
            };
            const uniqueName = lobbyService.generateUniqueName('Test', game);
            expect(uniqueName).toBe('Test');
        });

        it('should add a suffix if the name is already taken', () => {
            const game: any = {
                players: [{ name: 'Test' }, { name: 'Test-2' }],
            };
            const uniqueName = lobbyService.generateUniqueName('Test', game);
            expect(uniqueName).toBe('Test-3');
        });

        it('should not exceed 100 iterations and eventually return a unique name', () => {
            const players = [];

            for (let i = 0; i < 99; i++) {
                players.push({ name: i === 0 ? 'Player' : `Player-${i + 1}` });
            }
            const game: any = { players };
            const uniqueName = lobbyService.generateUniqueName('Player', game);
            expect(uniqueName).not.toBe('Player');
            expect(uniqueName).toMatch(/Player-\d+/);
        });
    });

    describe('addBot', () => {
        it('should add a bot player to the game', () => {
            const game: any = {
                players: [],
                playerTurns: [],
                selectedAvatars: {},
                maxPlayers: 4,
                isLocked: false,
            };

            jest.spyOn(lobbyService as any, 'generateUniqueBotName').mockReturnValue('Bot123');
            jest.spyOn(lobbyService as any, 'getRandomStat')
                .mockReturnValueOnce(3)
                .mockReturnValueOnce(3)
                .mockReturnValueOnce(2);
            jest.spyOn(lobbyService as any, 'getUniqueAvatar').mockReturnValue(5);
            jest.spyOn(lobbyService as any, 'createPlayer').mockImplementation((...args) => ({ socketId: args[0], name: args[1] }));

            lobbyService.addBot(true, game);

            expect(game.players.length).toBe(1);
            expect(game.players[0].socketId).toBe('Bot123');
            expect(game.selectedAvatars['Bot123']).toBe(5);
            expect(game.playerTurns).toContain('Bot123');
        });

        it('should lock the game if adding a bot reaches maxPlayers', () => {
            const game: any = {
                players: [{}, {}, {}],
                playerTurns: [],
                selectedAvatars: {},
                maxPlayers: 4,
                isLocked: false,
            };

            jest.spyOn(lobbyService as any, 'generateUniqueBotName').mockReturnValue('BotMax');
            jest.spyOn(lobbyService as any, 'getRandomStat').mockReturnValue(2);
            jest.spyOn(lobbyService as any, 'getUniqueAvatar').mockReturnValue(6);
            jest.spyOn(lobbyService as any, 'createPlayer').mockImplementation((...args) => ({ socketId: args[0], name: args[1] }));

            lobbyService.addBot(false, game);

            expect(game.players.length).toBe(4);
            expect(game.isLocked).toBe(true);
        });

        it('should assign correct bot attributes using getRandomStat()', () => {
            const game: any = {
                players: [],
                playerTurns: [],
                selectedAvatars: {},
                maxPlayers: 4,
                isLocked: false,
            };

            const mockStats = [4, 4, 2];
            const expectedHP = 10 - mockStats[0];
            const expectedDef = 10 - mockStats[1];
            const expectedDiceDef = 10 - mockStats[2];

            let statIndex = 0;
            jest.spyOn(lobbyService as any, 'getRandomStat').mockImplementation(() => mockStats[statIndex++]);
            jest.spyOn(lobbyService as any, 'generateUniqueBotName').mockReturnValue('BotStats');
            jest.spyOn(lobbyService as any, 'getUniqueAvatar').mockReturnValue(3);

            const createPlayerSpy = jest
                .spyOn(lobbyService as any, 'createPlayer')
                .mockImplementation((name, socketId, avatar, spd, atk, def, hp, diceAtk, diceDef, _, options) => ({
                    socketId,
                    name,
                    avatar,
                    spd,
                    atk,
                    def,
                    hp,
                    diceAtk,
                    diceDef,
                    options,
                }));

            lobbyService.addBot(true, game);

            expect(createPlayerSpy).toHaveBeenCalledWith('BotStats', 'BotStats', '3', 4, 4, expectedDef, expectedHP, 2, expectedDiceDef, false, {
                isBot: true,
                isAgressive: true,
            });
        });
    });

    describe('processRandomItems', () => {
        it('should call add on the Set for each valid item', () => {
            const testMap = {
                items: [
                    ['shield', 'random'],
                    ['empty', 'potion'],
                    ['checkpoint', 'lance'],
                ],
            };

            const addSpy = jest.spyOn(Set.prototype, 'add');
            (lobbyService as any).processRandomItems(testMap);

            expect(addSpy).toHaveBeenCalledTimes(3);
            expect(addSpy).toHaveBeenCalledWith('shield');
            expect(addSpy).toHaveBeenCalledWith('potion');
            expect(addSpy).toHaveBeenCalledWith('lance');
            addSpy.mockRestore();
        });

        it('should not call add on the Set if no valid item is present', () => {
            const testMap = {
                items: [
                    ['random', 'empty'],
                    ['checkpoint', 'empty'],
                ],
            };

            const addSpy = jest.spyOn(Set.prototype, 'add');
            (lobbyService as any).processRandomItems(testMap);

            expect(addSpy).not.toHaveBeenCalled();
            addSpy.mockRestore();
        });

        it('should call add for each occurrence even if duplicates', () => {
            const testMap = {
                items: [
                    ['crystal', 'crystal'],
                    ['lance', 'lance'],
                ],
            };

            const addSpy = jest.spyOn(Set.prototype, 'add');
            (lobbyService as any).processRandomItems(testMap);

            expect(addSpy).toHaveBeenCalledTimes(4);
            expect(addSpy).toHaveBeenCalledWith('crystal');
            expect(addSpy).toHaveBeenCalledWith('lance');
            addSpy.mockRestore();
        });
    });

    describe('getRandomStat', () => {
        it('should return 4 when Math.random() < 0.5', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.3);
            const result = (lobbyService as any).getRandomStat();
            expect(result).toBe(4);
            jest.spyOn(Math, 'random').mockRestore();
        });

        it('should return 6 when Math.random() >= 0.5', () => {
            jest.spyOn(Math, 'random').mockReturnValue(0.7);
            const result = (lobbyService as any).getRandomStat();
            expect(result).toBe(6);
            jest.spyOn(Math, 'random').mockRestore();
        });
    });

    describe('shuffleArray', () => {
        it('should shuffle the array and return the same elements', () => {
            const original = [1, 2, 3, 4, 5];
            const copy = [...original];

            const result = (lobbyService as any).shuffleArray(copy);
            expect(result.sort()).toEqual(original.sort());
        });

        it('should return the same array if it has only one element', () => {
            const arr = [42];
            const result = (lobbyService as any).shuffleArray([...arr]);
            expect(result).toEqual([42]);
        });

        it('should return an empty array when input is empty', () => {
            const result = (lobbyService as any).shuffleArray([]);
            expect(result).toEqual([]);
        });

        it('should shuffle deterministically when Math.random is mocked', () => {
            const input = [1, 2, 3];
            const mathRandomMock = jest.spyOn(Math, 'random');
            mathRandomMock.mockReturnValueOnce(0.7).mockReturnValueOnce(0.2);

            const result = (lobbyService as any).shuffleArray([...input]);

            expect(result).toEqual([2, 1, 3]);

            mathRandomMock.mockRestore();
        });
    });

    describe('generateUniqueBotName', () => {
        beforeEach(() => {
            (lobbyService as any).BOT_NAMES = ['BotA', 'BotB', 'BotC'];
        });

        it('should return a name not used by any player', () => {
            const game = {
                players: [{ name: 'BotA' }],
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue(['BotB', 'BotC', 'BotA']);
            const result = (lobbyService as any).generateUniqueBotName(game);
            expect(result).toBe('BotB');
        });

        it('should return a random bot name if all are taken', () => {
            const game = {
                players: [{ name: 'BotA' }, { name: 'BotB' }, { name: 'BotC' }],
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue(['BotA', 'BotB', 'BotC']);
            jest.spyOn(Math, 'random').mockReturnValue(0.5);
            const result = (lobbyService as any).generateUniqueBotName(game);
            expect(result).toBe('BotB');
            jest.spyOn(Math, 'random').mockRestore();
        });

        it('should return the first available name if all but one are taken', () => {
            const game = {
                players: [{ name: 'BotA' }, { name: 'BotC' }],
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue(['BotC', 'BotB', 'BotA']);
            const result = (lobbyService as any).generateUniqueBotName(game);
            expect(result).toBe('BotB');
        });
    });

    describe('getUniqueAvatar', () => {
        beforeEach(() => {
            (lobbyService as any).AVATARS = [1, 2, 3];
        });

        it('should return the first unused avatar from the shuffled list', () => {
            const game = {
                selectedAvatars: { player1: 1 },
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue([2, 3, 1]);

            const result = (lobbyService as any).getUniqueAvatar(game);
            expect(result).toBe(2);
        });

        it('should return a random avatar if all are used', () => {
            const game = {
                selectedAvatars: { p1: 1, p2: 2, p3: 3 },
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue([3, 2, 1]);
            jest.spyOn(Math, 'random').mockReturnValue(0.66);

            const result = (lobbyService as any).getUniqueAvatar(game);
            expect(result).toBe(2);
            jest.spyOn(Math, 'random').mockRestore();
        });

        it('should return the only unused avatar if two are used', () => {
            const game = {
                selectedAvatars: { p1: 1, p2: 2 },
            };

            jest.spyOn(lobbyService as any, 'shuffleArray').mockReturnValue([2, 3, 1]);
            const result = (lobbyService as any).getUniqueAvatar(game);
            expect(result).toBe(3);
        });
    });

    describe('generateTeams', () => {
        it('should return undefined if game mode is not CTF', () => {
            const game: any = {
                map: { gameMode: 'classic' },
                players: [],
            };

            const result = lobbyService.generateTeams(game);
            expect(result).toBeUndefined();
        });

        it('should throw an error if number of players is odd', () => {
            const game: any = {
                map: { gameMode: 'CTF' },
                players: [{ socketId: '1' }, { socketId: '2' }, { socketId: '3' }],
            };

            expect(() => lobbyService.generateTeams(game)).toThrowError('Impossible de démarrer. Nombre de joueurs impair');
        });

        it('should split players evenly into red and blue teams (CTF mode)', () => {
            const game: any = {
                map: { gameMode: 'CTF' },
                players: [{ socketId: 'A' }, { socketId: 'B' }, { socketId: 'C' }, { socketId: 'D' }],
            };

            jest.spyOn(Math, 'random').mockReturnValueOnce(0.3).mockReturnValueOnce(0.8).mockReturnValueOnce(0.5).mockReturnValueOnce(0.1);
            const result = lobbyService.generateTeams(game);

            expect(result.red.length).toBe(2);
            expect(result.blue.length).toBe(2);
            expect([...result.red, ...result.blue].sort()).toEqual(['A', 'B', 'C', 'D'].sort());
            jest.spyOn(Math, 'random').mockRestore();
        });
    });
});
