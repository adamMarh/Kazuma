export type ItemType =
    | 'shield'
    | 'lance'
    | 'potion'
    | 'crystal'
    | 'compas'
    | 'hourglass'
    | 'random'
    | 'checkpoint'
    | 'flag'
    | 'empty'
    | 'hidden_checkpoint';

export const ITEM_SETTINGS = {
    shield: { image: './assets/items/shield.png', description: 'Tu possède +2 def, mais -1 atk' },
    lance: { image: './assets/items/lance.png', description: 'Tu possède +1 atk et +1 def' },
    potion: { image: './assets/items/lean.png', description: 'Soigne 3 PV uniquement quand tu es gravement blessé (PV ≤ 3)' },
    crystal: { image: './assets/items/vvs.png', description: 'Tes ennemis ne peuvent plus fuir contre toi, si tu as gagné au moins 1 combat' },
    compas: { image: './assets/items/compas.png', description: 'Tu passe les portes fermées' },
    hourglass: { image: './assets/items/hourglass.png', description: 'Si tu perds un combat, il est relancé une seule fois, mais tu as -2 pv' },
    random: { image: './assets/items/dice.png', description: 'Objet aléatoire' },
    flag: { image: './assets/items/flag.png', description: 'Capture ce drapeau pour gagner' },
    checkpoint: { image: './assets/icons/checkpoints.png', description: 'Point de sauvegarde' },
    empty: { image: '', description: '' },
    hidden_checkpoint: { image: '', description: '' },
} as const;
