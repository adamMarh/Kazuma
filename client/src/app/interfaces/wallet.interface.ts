export interface WalletDto {
    balance: number;
    owned: {
        characters: string[];
        visuals: string[];
        sounds: string[];
    };
}

export const EMPTY_WALLET: WalletDto = {
    balance: 0,
    owned: { characters: [], visuals: [], sounds: [] },
};

export type CosmeticType = 'characters' | 'visuals' | 'sounds';

export interface ShopItemDto {
    id: string;
    type: CosmeticType;
    name: string;
    price: number;
    previewImage?: string;
}

export interface ShopResponseDto {
    wallet: {
        balance: number;
        owned: {
            characters: string[];
            visuals: string[];
            sounds: string[];
        };
    };
    catalog: Record<CosmeticType, ShopItemDto[]>;
}

export interface BuyRequestDto {
    type: CosmeticType;
    itemId: string;
}
