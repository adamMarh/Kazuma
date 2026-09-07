export interface TileSetting {
    image: string;
    description: string;
}

export const TILE_SETTINGS: { [key: string]: TileSetting } = {
    grass: {
        image: './assets/tiles/grass.png',
        description: 'Tu peux marcher ici',
    },
    water: {
        image: './assets/tiles/water.png',
        description: 'Tu peux nager ici',
    },
    ice: {
        image: './assets/tiles/ice.png',
        description: 'Tu peux glisser ici',
    },
    wall: {
        image: './assets/tiles/wall.png',
        description: 'Impassable',
    },
    doorOpen: {
        image: './assets/tiles/door-open.png',
        description: 'Porte ouverte',
    },
    doorClose: {
        image: './assets/tiles/door-close.png',
        description: 'Porte fermée',
    },
};
