// shop.catalog.ts
export type CosmeticType = 'characters' | 'visuals' | 'sounds';

export type ShopItem = {
    id: string;
    type: CosmeticType;
    name: string;
    price: number;
};

export const SHOP_CATALOG: Record<CosmeticType, ShopItem[]> = {
    characters: [
        { id: 'chat_astral', type: 'characters', name: 'Chat Astral', price: 2 },
        { id: 'chien_gardien', type: 'characters', name: 'Chien Gardien', price: 4 },
        { id: 'lapin_lunaire', type: 'characters', name: 'Lapin Lunaire', price: 6 },
    ],
    sounds: [
        { id: 'snd_win_music', type: 'sounds', name: 'Musique Victoire', price: 8 },
        { id: 'snd_attack', type: 'sounds', name: 'Son Attaque', price: 5 },
        { id: 'snd_flag_music', type: 'sounds', name: 'Musique Flag', price: 7 },
    ],
    visuals: [
        { id: 'vis_aura', type: 'visuals', name: 'Aura Blanche', price: 9 },
        { id: 'vis_flag_custom', type: 'visuals', name: 'Couronne Stellaire', price: 8 },
        { id: 'vis_police_nom', type: 'visuals', name: 'Nom Enchanté', price: 6 },
    ],
};

export function getItem(type: CosmeticType, itemId: string): ShopItem | null {
    return SHOP_CATALOG[type]?.find((x) => x.id === itemId) ?? null;
}
