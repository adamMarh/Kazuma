import { FormAttributes } from '@app/interfaces/form-attributes';

export const TIMER_DELAY_MS = 5000;
export const ATTRIBUTES: FormAttributes[] = [
    { name: 'hp', value: 4, bonusApplied: false, dice: null },
    { name: 'spd', value: 4, bonusApplied: false, dice: null },
    { name: 'atk', value: 4, bonusApplied: false, dice: 4 },
    { name: 'def', value: 4, bonusApplied: false, dice: 4 },
];

export const INITIAL_ATTRIBUTES: { [key: string]: { value: number; dice: number | null } } = {
    hp: { value: 4, dice: null },
    spd: { value: 4, dice: null },
    atk: { value: 4, dice: 4 },
    def: { value: 4, dice: 4 },
};

export const ATTRIBUTE_TRANSLATIONS: { [key: string]: string } = {
    hp: 'Vie',
    spd: 'Rapidité',
    atk: 'Attaque',
    def: 'Défense',
};

export const ATTRIBUTE_VALUE = 4;
export const ATTRIBUTE_VALUE_ADDED = 6;
export const BONUS_VALUE = 2;

export const DEFAULT_DICE_VALUE = 4;
export const ATTACK_DICE = 6;
export const DEFENSE_DICE = 4;
export const SELECTED_DICE_VALUE = 6;

export const AVATAR_SELECTED = 3;
export const AVATAR_OUT_RANGE = 100;
export const MIN_NAME_LENGTH = 5;
export const MAX_NAME_LENGTH = 15;
export const VALID_NAME_PATTERN = /^[a-zA-Z0-9]+$/;

export const TIMER_DELAY = 5000;
export const ADDITIONAL_LENGTH = 5;

export const HP = 'hp';
export const SPD = 'spd';
export const ATK = 'atk';
export const DEF = 'def';
export const NON_EXISTENT = 'inexistant';
export const AVATAR_ONE = 'avatar1.png';

export const ID_TEST = '1234';
export const NAME_TEST = 'player123';
export const TEST_NAMES = {
    short: 'aBc',
    validMax: 'abcdefghij12345',
    overMax: 'abcdefghij123456',
    invalidChars: 'invalid@name*',
};

export interface GameAvatarOption {
    id: number;
    image: string;
    name: string;
}

export interface SpecialGameAvatarOption extends GameAvatarOption {
    unlockItemId: string;
}

export const MESSAGES = {
    shortName: 'Le nom doit contenir au moins 5 caractères.',
    invalidName: 'Le nom contient des caractères non autorisés.',
};

export const BASE_GAME_AVATARS: GameAvatarOption[] = Array.from({ length: 12 }, (_, i) => ({
    id: i + 1,
    image: `assets/images/avatars-images/avatar${i + 1}.png`,
    name: `Avatar ${i + 1}`,
}));

export const SPECIAL_GAME_AVATARS: SpecialGameAvatarOption[] = [
    {
        id: 13,
        image: 'assets/images/avatars-images/avatar13.png',
        name: 'Chat Astral',
        unlockItemId: 'chat_astral',
    },
    {
        id: 14,
        image: 'assets/images/avatars-images/avatar14.png',
        name: 'Chien Gardien',
        unlockItemId: 'chien_gardien',
    },
    {
        id: 15,
        image: 'assets/images/avatars-images/avatar15.png',
        name: 'Lapin Lunaire',
        unlockItemId: 'lapin_lunaire',
    },
];

export const TOOLTIPS: { [key: string]: string } = {
    hp: 'characterForm.hpTooltip',
    spd: 'characterForm.spdTooltip',
    atk: 'characterForm.atkTooltip',
    def: 'characterForm.defTooltip',
};

export const AVATAR_ALREADY_SELECTED = 'messages.avatarAlreadySelected';
export const AVATAR_NOT_AVAILABLE = 'characterForm.avatarNotAvailable';
export const ROOM_ERROR = 'characterForm.roomError';
