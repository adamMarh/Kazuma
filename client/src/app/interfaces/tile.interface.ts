export type TileType = 'grass' | 'water' | 'ice' | 'wall' | 'doorOpen' | 'doorClose';

export const TILE_SETTINGS = {
    grass: { image: './assets/tiles/grass.png', description: 'Tu peux marcher ici' },
    water: { image: './assets/tiles/water.png', description: 'Tu peux nager ici' },
    ice: { image: './assets/tiles/ice.png', description: 'Tu peux patiner ici' },
    wall: { image: './assets/tiles/wall.png', description: 'Un mur !' },
    doorOpen: { image: './assets/tiles/door-open.png', description: 'Une porte ouverte' },
    doorClose: { image: './assets/tiles/door-closed.png', description: 'Une porte' },
} as const;
