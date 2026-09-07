export class UpdateGameMapDto {
    readonly name: string;
    readonly size: number;
    readonly gameMode: string;
    readonly tiles: string[][];
    readonly items: string[][];
    readonly description?: string;
    readonly imageUrl?: string;
    readonly visibility?: string;
    readonly owner?: string;
    readonly nbCheckpoints: string;
    readonly nbRandomItems: string;
    readonly actionPoints?: number;
}
