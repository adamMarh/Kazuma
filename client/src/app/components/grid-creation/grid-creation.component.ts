import { Component, inject } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { GRID_SIZES } from '@app/constants/grid';
import { GridService } from '@app/services/grid/grid.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';

@Component({
    standalone: true,
    selector: 'app-grid-creation',
    imports: [TranslatePipe, RouterLink],
    templateUrl: './grid-creation.component.html',
    styleUrl: './grid-creation.component.scss',
})
export class GridCreationComponent {
    savedGames: unknown[] = [];
    tempSize: number;
    tempGameMode: string;
    sizes = [GRID_SIZES.small, GRID_SIZES.medium, GRID_SIZES.large] as const;
    gameModes = ['Classique', 'CTF'] as const;
    errorMessage: string = '';

    private gridService = inject(GridService);
    private router = inject(Router);
    private languageService = inject(LanguageService);

    getGameModeLabel(mode: string): string {
        if (mode === 'Classique') return this.languageService.translate('gridCreation.classic');
        if (mode === 'CTF') return this.languageService.translate('gridCreation.ctf');
        return mode;
    }

    setGrid(size: number, gameMode: string) {
        if (!this.tempSize || !this.tempGameMode) {
            this.errorMessage = this.languageService.translate('gridCreation.selectSizeAndMode');
            return;
        }

        this.gridService.initializeGrid(this.tempSize, this.tempGameMode);
        this.router.navigate(['/edit']);
    }
}
