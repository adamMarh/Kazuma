export type MapVisibility = 'public' | 'private' | 'private-shared';

export interface Map {
    _id?: string;
    name: string;
    size: string;
    gameMode: string;
    description: string;
    lastSave: Date;
    imageUrl: string;
    visibility: MapVisibility;
    owner: string;
    tiles: string[][];
    items: string[][];
    nbCheckpoints: string;
    nbRandomItems: string;
    actionPoints?: number;
}
