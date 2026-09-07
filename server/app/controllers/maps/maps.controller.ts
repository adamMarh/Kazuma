import { Body, Controller, Delete, Get, Param, Patch, Post, Put, Query } from '@nestjs/common';
import { CreateGameMapDto } from '@app/model/dto/game-map/create-game-map.dto';
import { UpdateGameMapDto } from '@app/model/dto/game-map/update-game-map.dto';
import { GameMap } from '@app/model/schema/game-map.schema';
import { MapsService } from '@app/services/maps/maps.service';

@Controller('maps')
export class MapsController {
    constructor(private readonly mapsService: MapsService) {}

    @Get()
    async findAll(@Query('filter') filter?: string, @Query('username') username?: string): Promise<GameMap[]> {
        if (filter === 'admin' && username) {
            return this.mapsService.getMapsForAdmin(username);
        }
        if (filter === 'gameCreation' && username) {
            return this.mapsService.getMapsForGameCreation(username);
        }
        return this.mapsService.getAllMaps();
    }

    @Get('check-name')
    async checkName(@Query('name') name: string, @Query('excludeId') excludeId?: string): Promise<{ taken: boolean }> {
        const taken = await this.mapsService.isNameTaken(name, excludeId);
        return { taken };
    }

    @Get(':id')
    async findOne(@Param('id') id: string): Promise<GameMap> {
        return this.mapsService.getMapById(id);
    }

    @Get(':id/available')
    async isGameAvailable(@Param('id') id: string, @Query('username') username?: string): Promise<boolean> {
        return this.mapsService.isGameAvailable(id, username);
    }

    @Post()
    async create(@Body() createGameMapDto: CreateGameMapDto): Promise<GameMap> {
        return this.mapsService.createMap(createGameMapDto);
    }

    @Post(':id/duplicate')
    async duplicate(@Param('id') id: string, @Query('username') username: string): Promise<GameMap> {
        return this.mapsService.duplicateMap(id, username);
    }

    @Put(':id')
    async update(@Param('id') id: string, @Body() updateGameMapDto: UpdateGameMapDto, @Query('username') username: string): Promise<GameMap> {
        return this.mapsService.updateMap(id, updateGameMapDto, username);
    }

    @Delete(':id')
    async remove(@Param('id') id: string, @Query('username') username: string): Promise<void> {
        return this.mapsService.deleteMap(id, username);
    }

    @Patch(':id/visibility')
    async updateVisibility(@Param('id') id: string, @Body('visibility') visibility: string, @Query('username') username: string): Promise<GameMap> {
        return this.mapsService.updateVisibility(id, visibility, username);
    }
}
