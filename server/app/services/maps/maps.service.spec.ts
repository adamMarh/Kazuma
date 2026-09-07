/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable max-lines */
import { CreateGameMapDto } from '@app/model/dto/game-map/create-game-map.dto';
import { UpdateGameMapDto } from '@app/model/dto/game-map/update-game-map.dto';
import { BadRequestException, NotFoundException } from '@nestjs/common';
import { MapsService } from './maps.service';

describe('MapsService', () => {
    let service: MapsService;
    let mockGameMapModel: Partial<Record<keyof any, any>>;

    const buildExec = (result: any) => ({
        exec: jest.fn().mockResolvedValue(result),
    });

    beforeEach(() => {
        mockGameMapModel = {
            find: jest.fn(),
            create: jest.fn(),
            findById: jest.fn(),
            findByIdAndUpdate: jest.fn(),
            findByIdAndDelete: jest.fn(),
        };

        service = new MapsService(mockGameMapModel as any);
    });

    describe('getAllMaps', () => {
        it('should return all maps', async () => {
            const maps = [{ _id: '1' }, { _id: '2' }];
            (mockGameMapModel.find as jest.Mock).mockReturnValue(buildExec(maps));

            const result = await service.getAllMaps();
            expect(result).toEqual(maps);
            expect(mockGameMapModel.find).toHaveBeenCalled();
        });
    });

    describe('createMap', () => {
        const baseValidDto: Omit<CreateGameMapDto, '_id'> = {
            name: 'Test Map',
            size: 10,
            gameMode: 'classic',
            tiles: [
                ['grass', 'grass', 'grass'],
                ['grass', 'grass', 'grass'],
                ['grass', 'grass', 'grass'],
            ],
            items: [
                ['', 'checkpoint', ''],
                ['', '', 'checkpoint'],
                ['', '', ''],
            ],
            nbCheckpoints: '2',
            nbRandomItems: '5',
        };

        it('should create a map successfully (size 10 valid)', async () => {
            const validDto: CreateGameMapDto = { _id: 'map1', ...baseValidDto };
            const createdMap = { _id: 'map1', hidden: true, lastSave: new Date() };
            (mockGameMapModel.create as jest.Mock).mockResolvedValue(createdMap);

            const result = await service.createMap(validDto);
            expect(result).toEqual(createdMap);
            expect(mockGameMapModel.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    size: validDto.size,
                    tiles: validDto.tiles,
                    items: validDto.items,
                    hidden: true,
                    lastSave: expect.any(Date),
                }),
            );
        });

        it('should throw error if missing checkpoint (invalid DTO)', async () => {
            const invalidDto: CreateGameMapDto = {
                _id: 'map1',
                name: 'Test Map',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', ''],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            await expect(service.createMap(invalidDto)).rejects.toThrowError(/missingCheckpoint/);
        });

        it('should throw error if terrainTilePercentage fails', async () => {
            const invalidDto: CreateGameMapDto = {
                _id: 'map1',
                name: 'Test Map',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'wall', 'wall'],
                    ['wall', 'grass', 'wall'],
                    ['wall', 'wall', 'wall'],
                ],
                items: [
                    ['checkpoint', '', ''],
                    ['', 'checkpoint', ''],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            await expect(service.createMap(invalidDto)).rejects.toThrowError(/terrainTilePercentage/);
        });

        it('should throw error if terrainTileAccessibility fails', async () => {
            const invalidDto: CreateGameMapDto = {
                _id: 'map1',
                name: 'Test Map',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['wall', 'wall', 'wall'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['checkpoint', 'checkpoint', ''],
                    ['', '', ''],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            await expect(service.createMap(invalidDto)).rejects.toThrowError(/terrainTileAccessibility/);
        });

        it('should throw error if doorTileAdjacency fails (invalid door configuration)', async () => {
            const invalidDoorDto: CreateGameMapDto = {
                _id: 'mapDoorInvalid',
                name: 'Invalid Door Map',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            await expect(service.createMap(invalidDoorDto)).rejects.toThrowError(/doorTileAdjacency/);
        });

        it('should create a map successfully when door tile is properly adjacent (orientation1)', async () => {
            const validDoorDto1: CreateGameMapDto = {
                _id: 'mapDoor1',
                name: 'Door Map Orientation1',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'wall', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'wall', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };
            const createdDoor1 = { _id: 'mapDoor1', hidden: true, lastSave: new Date() };
            (mockGameMapModel.create as jest.Mock).mockResolvedValue(createdDoor1);

            const result = await service.createMap(validDoorDto1);
            expect(result).toEqual(createdDoor1);
        });

        it('should create a map successfully when door tile is properly adjacent (orientation2)', async () => {
            const validDoorDto2: CreateGameMapDto = {
                _id: 'mapDoor2',
                name: 'Door Map Orientation2',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['wall', 'doorOpen', 'wall'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };
            const createdDoor2 = { _id: 'mapDoor2', hidden: true, lastSave: new Date() };
            (mockGameMapModel.create as jest.Mock).mockResolvedValue(createdDoor2);

            const result = await service.createMap(validDoorDto2);
            expect(result).toEqual(createdDoor2);
        });

        it('should create a map successfully for size 15 with correct number of checkpoints', async () => {
            const dto15: CreateGameMapDto = {
                _id: 'map15',
                name: 'Test Map 15',
                size: 15,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['checkpoint', '', 'checkpoint'],
                    ['', 'checkpoint', ''],
                    ['checkpoint', '', ''],
                ],
                nbCheckpoints: '4',
                nbRandomItems: '5',
            };
            const createdMap15 = { _id: 'map15', hidden: true, lastSave: new Date() };
            (mockGameMapModel.create as jest.Mock).mockResolvedValue(createdMap15);

            const result = await service.createMap(dto15);
            expect(result).toEqual(createdMap15);
        });

        it('should create a map successfully for size 20 with correct number of checkpoints', async () => {
            const dto20: CreateGameMapDto = {
                _id: 'map20',
                name: 'Test Map 20',
                size: 20,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['checkpoint', '', 'checkpoint'],
                    ['checkpoint', '', 'checkpoint'],
                    ['checkpoint', '', 'checkpoint'],
                ],
                nbCheckpoints: '6',
                nbRandomItems: '5',
            };
            const createdMap20 = { _id: 'map20', hidden: true, lastSave: new Date() };
            (mockGameMapModel.create as jest.Mock).mockResolvedValue(createdMap20);

            const result = await service.createMap(dto20);
            expect(result).toEqual(createdMap20);
        });
    });

    describe('getMapById', () => {
        it('should return map if found', async () => {
            const map = { _id: '1' };
            (mockGameMapModel.findById as jest.Mock).mockReturnValue(buildExec(map));

            const result = await service.getMapById('1');
            expect(result).toEqual(map);
        });

        it('should throw NotFoundException if map not found', async () => {
            (mockGameMapModel.findById as jest.Mock).mockReturnValue(buildExec(null));
            await expect(service.getMapById('1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('updateMap', () => {
        const validDto: UpdateGameMapDto = {
            name: 'Updated Map',
            size: 10,
            gameMode: 'classic',
            tiles: [
                ['grass', 'grass', 'grass'],
                ['grass', 'grass', 'grass'],
                ['grass', 'grass', 'grass'],
            ],
            items: [
                ['', 'checkpoint', ''],
                ['', '', 'checkpoint'],
                ['', '', ''],
            ],
            nbCheckpoints: '2',
            nbRandomItems: '5',
        };

        it('should update map if found', async () => {
            const updatedMap = { _id: '1', hidden: true };
            (mockGameMapModel.findByIdAndUpdate as jest.Mock).mockReturnValue(buildExec(updatedMap));

            const result = await service.updateMap('1', validDto);
            expect(result).toEqual(updatedMap);
            expect(mockGameMapModel.findByIdAndUpdate).toHaveBeenCalledWith('1', expect.objectContaining({ hidden: true, ...validDto }), {
                new: true,
            });
        });

        it('should call createMap if update not found and return null', async () => {
            (mockGameMapModel.findByIdAndUpdate as jest.Mock).mockReturnValue(buildExec(null));
            const createMapSpy = jest.spyOn(service, 'createMap').mockResolvedValue({ _id: '1', hidden: true } as any);
            const result = await service.updateMap('1', validDto);
            expect(createMapSpy).toHaveBeenCalled();
            expect(result).toBeNull();
            createMapSpy.mockRestore();
        });

        it('should throw error if DTO is invalid', async () => {
            const invalidDto: UpdateGameMapDto = {
                name: 'Updated Map',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', ''],
                    ['', '', ''],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            await expect(service.updateMap('1', invalidDto)).rejects.toThrow(BadRequestException);
        });
    });

    describe('deleteMap', () => {
        it('should delete map if found', async () => {
            (mockGameMapModel.findByIdAndDelete as jest.Mock).mockReturnValue(buildExec({ _id: '1' }));
            await expect(service.deleteMap('1')).resolves.toBeUndefined();
        });

        it('should throw NotFoundException if map not found', async () => {
            (mockGameMapModel.findByIdAndDelete as jest.Mock).mockReturnValue(buildExec(null));
            await expect(service.deleteMap('1')).rejects.toThrow(NotFoundException);
        });
    });

    describe('toggleHideMap', () => {
        it('should toggle hidden property and save the map', async () => {
            const map = {
                _id: '1',
                hidden: false,
                save: jest.fn().mockResolvedValue({ _id: '1', hidden: true }),
            };
            jest.spyOn(service, 'getMapById').mockResolvedValue(map as any);

            const result = await service.toggleHideMap('1');
            expect(result.hidden).toBe(true);
            expect(map.save).toHaveBeenCalled();
        });
    });

    describe('getVisibleGames', () => {
        it('should return visible games', async () => {
            const visibleMaps = [{ _id: '1', hidden: false }];
            (mockGameMapModel.find as jest.Mock).mockReturnValue(buildExec(visibleMaps));

            const result = await service.getVisibleGames();
            expect(result).toEqual(visibleMaps);
            expect(mockGameMapModel.find).toHaveBeenCalledWith({ hidden: false });
        });
    });

    describe('isGameAvailable', () => {
        it('should return true if game exists and is not hidden', async () => {
            const game = { _id: '1', hidden: false };
            (mockGameMapModel.findById as jest.Mock).mockReturnValue(buildExec(game));

            const result = await service.isGameAvailable('1');
            expect(result).toBe(true);
        });

        it('should return false if game does not exist', async () => {
            (mockGameMapModel.findById as jest.Mock).mockReturnValue(buildExec(null));
            const result = await service.isGameAvailable('1');
            expect(result).toBe(false);
        });

        it('should return false if game is hidden', async () => {
            const game = { _id: '1', hidden: true };
            (mockGameMapModel.findById as jest.Mock).mockReturnValue(buildExec(game));

            const result = await service.isGameAvailable('1');
            expect(result).toBe(false);
        });
    });

    describe('validateMap (private method)', () => {
        const validateMap = (dto: CreateGameMapDto | UpdateGameMapDto) => (service as any).validateMap(dto);

        it('should throw error for invalid door tile adjacency', () => {
            const invalidDoorDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Invalid Door',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(invalidDoorDto)).toThrow(BadRequestException);
            expect(() => validateMap(invalidDoorDto)).toThrow(/doorTileAdjacency/);
        });

        it('should pass door tile adjacency check for valid orientation1', () => {
            const validDoorDto1: CreateGameMapDto = {
                _id: 'test',
                name: 'Valid Door 1',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'wall', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'wall', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(validDoorDto1)).not.toThrow();
        });

        it('should pass door tile adjacency check for valid orientation2', () => {
            const validDoorDto2: CreateGameMapDto = {
                _id: 'test',
                name: 'Valid Door 2',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['wall', 'doorOpen', 'wall'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(validDoorDto2)).not.toThrow();
        });

        it('should handle door at edge positions correctly', () => {
            const doorAtEdgeDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Door at Edge',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['doorOpen', 'wall', 'grass'],
                    ['wall', 'grass', 'grass'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['', 'checkpoint', ''],
                    ['', '', 'checkpoint'],
                    ['', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(doorAtEdgeDto)).toThrow(BadRequestException);
            expect(() => validateMap(doorAtEdgeDto)).toThrow(/doorTileAdjacency/);
        });

        it('should validate door at edge with correct surrounding tiles', () => {
            const doorAtEdgeValidDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Door at Edge Valid',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'wall', 'doorOpen', 'wall', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', 'checkpoint', '', '', '', '', '', ''],
                    ['', '', '', '', '', 'checkpoint', '', '', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(doorAtEdgeValidDto)).not.toThrow();
        });

        it('should check terrain tiles above and below a door (checkTerrainUpDown)', () => {
            const terrainUpDownDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Terrain UpDown Test',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'wall', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'doorOpen', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'wall', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', 'checkpoint', '', '', '', '', '', ''],
                    ['', '', '', '', '', 'checkpoint', '', '', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(terrainUpDownDto)).not.toThrow();
        });

        it('should check terrain tiles to the left and right of a door (checkTerrainLeftRight)', () => {
            const terrainLeftRightDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Terrain LeftRight Test',
                size: 10,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'wall', 'wall', 'wall', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'doorOpen', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'wall', 'wall', 'wall', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', '', '', '', '', '', '', ''],
                    ['', '', '', 'checkpoint', '', '', '', '', '', ''],
                    ['', '', '', '', '', 'checkpoint', '', '', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '5',
            };

            expect(() => validateMap(terrainLeftRightDto)).not.toThrow();
        });

        it('should check bounds for left/right tiles in checkTerrainLeftRight', () => {
            const boundaryMapDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Boundary Test Left/Right',
                size: 3,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['doorOpen', 'grass', 'doorOpen'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['checkpoint', '', ''],
                    ['', '', ''],
                    ['', '', 'checkpoint'],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(boundaryMapDto)).toThrow(BadRequestException);
            expect(() => validateMap(boundaryMapDto)).toThrow(/doorTileAdjacency/);
        });

        it('should check bounds for upper/lower tiles in checkTerrainUpDown', () => {
            const boundaryMapDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Boundary Test Up/Down',
                size: 3,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                ],
                items: [
                    ['checkpoint', '', ''],
                    ['', '', ''],
                    ['', '', 'checkpoint'],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(boundaryMapDto)).toThrow(BadRequestException);
            expect(() => validateMap(boundaryMapDto)).toThrow(/doorTileAdjacency/);
        });

        it('should check bounds for left/right tiles in checkWallsLeftRight', () => {
            const boundaryWallsDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Boundary Walls Left/Right',
                size: 3,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass'],
                    ['doorOpen', 'grass', 'doorOpen'],
                    ['grass', 'grass', 'grass'],
                ],
                items: [
                    ['checkpoint', '', ''],
                    ['', '', ''],
                    ['', '', 'checkpoint'],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(boundaryWallsDto)).toThrow(BadRequestException);
            expect(() => validateMap(boundaryWallsDto)).toThrow(/doorTileAdjacency/);
        });

        it('should check bounds for upper/lower tiles in checkWallsUpDown', () => {
            const boundaryWallsDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Boundary Walls Up/Down',
                size: 3,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'doorOpen', 'grass'],
                    ['grass', 'grass', 'grass'],
                    ['grass', 'doorOpen', 'grass'],
                ],
                items: [
                    ['checkpoint', '', ''],
                    ['', '', ''],
                    ['', '', 'checkpoint'],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(boundaryWallsDto)).toThrow(BadRequestException);
            expect(() => validateMap(boundaryWallsDto)).toThrow(/doorTileAdjacency/);
        });

        it('should handle edge cases for boundary checks in cc < 0', () => {
            const leftEdgeDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Left Edge Test',
                size: 5,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['doorOpen', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['checkpoint', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['', '', 'checkpoint', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(leftEdgeDto)).toThrow(BadRequestException);
        });

        it('should handle edge cases for boundary checks in cc >= cols', () => {
            const rightEdgeDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Right Edge Test',
                size: 5,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'doorOpen'],
                ],
                items: [
                    ['', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['checkpoint', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['', '', 'checkpoint', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(rightEdgeDto)).toThrow(BadRequestException);
        });

        it('should handle edge cases for boundary checks in rr < 0', () => {
            const topEdgeDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Top Edge Test',
                size: 5,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'doorOpen', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['checkpoint', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['', '', 'checkpoint', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(topEdgeDto)).toThrow(BadRequestException);
        });

        it('should handle edge cases for boundary checks in rr >= rows', () => {
            const bottomEdgeDto: CreateGameMapDto = {
                _id: 'test',
                name: 'Bottom Edge Test',
                size: 5,
                gameMode: 'classic',
                tiles: [
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'grass', 'grass', 'grass'],
                    ['grass', 'grass', 'doorOpen', 'grass', 'grass'],
                ],
                items: [
                    ['', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['checkpoint', '', '', '', ''],
                    ['', '', '', '', ''],
                    ['', '', 'checkpoint', '', ''],
                ],
                nbCheckpoints: '2',
                nbRandomItems: '2',
            };

            expect(() => validateMap(bottomEdgeDto)).toThrow(BadRequestException);
        });
    });

    describe('getStartingPoints', () => {
        it('should return all positions where items equal "checkpoint"', () => {
            const map = {
                items: [
                    ['checkpoint', 'grass'],
                    ['water', 'checkpoint'],
                    ['wall', 'grass'],
                ],
            } as any;

            const startingPoints = service.getStartingPoints(map);
            expect(startingPoints).toEqual([
                { x: 0, y: 0 },
                { x: 1, y: 1 },
            ]);
        });

        it('should return an empty array if no checkpoint is found', () => {
            const map = {
                items: [
                    ['grass', 'water'],
                    ['water', 'grass'],
                ],
            } as any;
            const startingPoints = service.getStartingPoints(map);
            expect(startingPoints).toEqual([]);
        });
    });
});
