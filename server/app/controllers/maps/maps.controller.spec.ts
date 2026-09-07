import { CreateGameMapDto } from '@app/model/dto/game-map/create-game-map.dto';
import { UpdateGameMapDto } from '@app/model/dto/game-map/update-game-map.dto';
import { GameMap } from '@app/model/schema/game-map.schema';
import { MapsService } from '@app/services/maps/maps.service';
import { Test, TestingModule } from '@nestjs/testing';
import { MapsController } from './maps.controller';

describe('MapsController', () => {
    let controller: MapsController;
    let service: MapsService;

    const mockGameMap: GameMap = {
        name: 'Test Map',
        size: '10x10',
        gameMode: 'classic',
        description: 'A sample game map',
        lastSave: new Date(),
        imageUrl: 'https://example.com/map.png',
        hidden: false,
        tiles: [
            ['grass', 'water'],
            ['sand', 'stone'],
        ],
        items: [
            ['item1', 'item2'],
            ['item3', 'item4'],
        ],
        nbCheckpoints: '2',
        nbRandomItems: '3',
    };

    const mockMapsService = {
        getAllMaps: jest.fn().mockResolvedValue([mockGameMap]),
        getVisibleGames: jest.fn().mockResolvedValue([mockGameMap]),
        getMapById: jest.fn().mockResolvedValue(mockGameMap),
        isGameAvailable: jest.fn().mockResolvedValue(true),
        createMap: jest.fn().mockResolvedValue(mockGameMap),
        updateMap: jest.fn().mockResolvedValue(mockGameMap),
        deleteMap: jest.fn().mockResolvedValue(undefined),
        toggleHideMap: jest.fn().mockResolvedValue(mockGameMap),
    };

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            controllers: [MapsController],
            providers: [{ provide: MapsService, useValue: mockMapsService }],
        }).compile();

        controller = module.get<MapsController>(MapsController);
        service = module.get<MapsService>(MapsService);
    });

    it('should be defined', () => {
        expect(controller).toBeDefined();
    });

    describe('findAll', () => {
        it('should return all maps', async () => {
            const result = await controller.findAll();
            expect(result).toEqual([mockGameMap]);
            expect(service.getAllMaps).toHaveBeenCalled();
        });

        it('should return only visible maps when filter is "visibleGames"', async () => {
            const result = await controller.findAll('visibleGames');
            expect(result).toEqual([mockGameMap]);
            expect(service.getVisibleGames).toHaveBeenCalled();
        });
    });

    describe('findOne', () => {
        it('should return a single map by ID', async () => {
            const result = await controller.findOne('123');
            expect(result).toEqual(mockGameMap);
            expect(service.getMapById).toHaveBeenCalledWith('123');
        });
    });

    describe('isGameAvailable', () => {
        it('should return true if game is available', async () => {
            const result = await controller.isGameAvailable('123');
            expect(result).toBe(true);
            expect(service.isGameAvailable).toHaveBeenCalledWith('123');
        });
    });

    describe('create', () => {
        it('should create a new map', async () => {
            const dto: CreateGameMapDto = {
                _id: '123',
                name: 'New Map',
                size: 10,
                gameMode: 'battle',
                description: 'New map description',
                imageUrl: 'https://example.com/newmap.png',
                hidden: false,
                tiles: [['grass', 'water']],
                items: [['sword', 'shield']],
                nbCheckpoints: '1',
                nbRandomItems: '2',
            };
            const result = await controller.create(dto);
            expect(result).toEqual(mockGameMap);
            expect(service.createMap).toHaveBeenCalledWith(dto);
        });
    });

    describe('update', () => {
        it('should update a map by ID', async () => {
            const dto: UpdateGameMapDto = {
                name: 'Updated Test Map',
                size: 12,
                gameMode: 'Survival',
                tiles: [
                    ['lava', 'ice'],
                    ['sand', 'grass'],
                ],
                items: [
                    ['weapon', 'shield'],
                    ['trap', 'none'],
                ],
                description: 'An updated test game map',
                imageUrl: 'https://example.com/updated.png',
                hidden: true,
                nbCheckpoints: '4',
                nbRandomItems: '6',
            };
            const result = await controller.update('123', dto);
            expect(result).toEqual(mockGameMap);
            expect(service.updateMap).toHaveBeenCalledWith('123', dto);
        });
    });

    describe('remove', () => {
        it('should delete a map by ID', async () => {
            const result = await controller.remove('123');
            expect(result).toBeUndefined();
            expect(service.deleteMap).toHaveBeenCalledWith('123');
        });
    });

    describe('toggleHide', () => {
        it('should toggle hide status of a map', async () => {
            const result = await controller.toggleHide('123');
            expect(result).toEqual(mockGameMap);
            expect(service.toggleHideMap).toHaveBeenCalledWith('123');
        });
    });
});
