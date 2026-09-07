import { Component, Input, OnInit } from '@angular/core';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { Player } from '@common/interfaces/player.interface';

@Component({
    selector: 'app-player-info-panel',
    imports: [TranslatePipe],
    templateUrl: './player-info-panel.component.html',
    styleUrl: './player-info-panel.component.scss',
})
export class PlayerInfoPanelComponent implements OnInit {
    @Input() player: Player | null = null;
    atkDiceType: string;
    defDiceType: string;

    get maxHealthpoints(): number {
        return this.player ? this.player.healthpoints : 0;
    }
    ngOnInit(): void {
        this.setupDiceType();
    }

    private setupDiceType(): void {
        if (this.player) {
            this.atkDiceType = this.player.dice.atk === 6 ? 'D6' : 'D4';
            this.defDiceType = this.player.dice.def === 6 ? 'D6' : 'D4';
        }
    }
}
