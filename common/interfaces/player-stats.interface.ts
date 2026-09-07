export interface PlayerStats {
    name: string;
    combats: number;
    evasions: number;
    victories: number;
    defeats: number;
    hpLost: number;
    damageDone: number;
    itemsPicked: number;
    tilesVisitedPercentage: number;
    hasLeft: boolean;
}