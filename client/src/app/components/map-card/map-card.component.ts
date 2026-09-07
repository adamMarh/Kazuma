import { CommonModule } from '@angular/common';
import { Component, EventEmitter, Input, Output, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { GameMap, MapVisibility } from '@app/interfaces/game-map.interface';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { MapService } from '@app/services/maps/maps.service';

@Component({
    standalone: true,
    selector: 'app-map-card',
    templateUrl: './map-card.component.html',
    styleUrls: ['./map-card.component.scss'],
    imports: [CommonModule, FormsModule, TranslatePipe],
})
export class MapCardComponent {
    @Input() map!: GameMap;
    @Input() showActions: boolean = false;
    @Input() isOwner: boolean = false;
    @Output() mapDeleted = new EventEmitter<{ message: string }>();
    @Output() mapVisibilityChanged = new EventEmitter<{ message: string }>();
    @Output() mapDuplicated = new EventEmitter<{ message: string }>();
    isFlipped = false;

    private mapService = inject(MapService);
    private router = inject(Router);
    private languageService = inject(LanguageService);

    get canEdit(): boolean {
        return this.isOwner || this.map.visibility === 'public';
    }

    get canDelete(): boolean {
        return this.isOwner || this.map.visibility === 'public';
    }

    get canChangeVisibility(): boolean {
        return this.isOwner;
    }

    get canDuplicate(): boolean {
        return this.map.visibility === 'public';
    }

    editMap() {
        this.router.navigate(['/edit'], { queryParams: { id: this.map._id } });
    }

    deleteMap() {
        if (!this.map?._id) {
            return;
        }
        this.mapService.deleteMap(this.map._id).subscribe({
            next: () => {
                this.mapDeleted.emit({ message: this.languageService.translate('mapCard.deleteSuccess') });
            },
            error: () => {
                this.mapDeleted.emit({ message: this.languageService.translate('mapCard.deleteAlready') });
            },
        });
    }

    changeVisibility(visibility: MapVisibility) {
        if (!this.map?._id) {
            return;
        }
        this.mapService.updateVisibility(this.map._id, visibility).subscribe({
            next: () => {
                this.mapVisibilityChanged.emit({ message: this.languageService.translate('messages.visibilityChangeError') });
            },
            error: () => {
                this.mapVisibilityChanged.emit({ message: this.languageService.translate('messages.visibilityChangeError') });
            },
        });
    }

    duplicateMap() {
        if (!this.map?._id) {
            return;
        }
        this.mapService.duplicateMap(this.map._id).subscribe({
            next: () => {
                this.mapDuplicated.emit({ message: this.languageService.translate('messages.mapDuplicateSuccess') });
            },
            error: () => {
                this.mapDuplicated.emit({ message: this.languageService.translate('messages.mapDuplicateError') });
            },
        });
    }
}
