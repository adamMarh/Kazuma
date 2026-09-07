/* eslint-disable @typescript-eslint/naming-convention */
/**
 * Mapping entre les IDs des articles du catalogue et leurs images preview
 */
export const SHOP_ITEM_PREVIEW_IMAGES: Record<string, string | null> = {
    // Characters
    chat_astral: 'assets/images/avatars-images/avatar13.png',
    chien_gardien: 'assets/images/avatars-images/avatar14.png',
    lapin_lunaire: 'assets/images/avatars-images/avatar15.png',

    // Sounds (using emoji or icon placeholders since we don't have audio visualizations)
    snd_win_music: null,
    snd_attack: null,
    snd_flag_music: null,

    // Visuals
    vis_aura: null,
    vis_flag_custom: null,
    vis_police_nom: null,
};

/**
 * Mapping entre les IDs des articles sonores et leurs fichiers audio
 */
export const SHOP_ITEM_SOUNDS: Record<string, string | null> = {
    snd_win_music: 'assets/sounds/victory.wav',
    snd_attack: 'assets/sounds/attack.wav',
    snd_flag_music: 'assets/sounds/flag.wav',
};

/**
 * Retourne le chemin de l'image preview pour un article
 * @param itemId L'ID de l'article
 * @returns Le chemin de l'image ou null si pas d'image
 */
export function getShopItemPreviewImage(itemId: string): string | null {
    return SHOP_ITEM_PREVIEW_IMAGES[itemId] ?? null;
}

/**
 * Retourne le chemin du fichier audio pour un article sonore
 * @param itemId L'ID de l'article
 * @returns Le chemin du fichier audio ou null si pas de son
 */
export function getShopItemSound(itemId: string): string | null {
    return SHOP_ITEM_SOUNDS[itemId] ?? null;
}

/**
 * Retourne la classe CSS d'effet visuel pour un article
 * @param itemId L'ID de l'article
 * @returns Le nom de la classe CSS ou null si pas d'effet
 */
export function getShopItemVisualClass(itemId: string): string | null {
    const visualClasses: Record<string, string> = {
        vis_aura: 'visual-aura',
        vis_flag_custom: 'visual-stars',
        vis_police_nom: 'visual-enchanted',
    };
    return visualClasses[itemId] ?? null;
}
