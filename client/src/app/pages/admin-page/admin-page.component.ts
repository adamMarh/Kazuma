import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MapCardComponent } from '@app/components/map-card/map-card.component';
import { GameMap } from '@app/interfaces/game-map.interface';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { MapService } from '@app/services/maps/maps.service';
import { Observable } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-admin-page',
    templateUrl: './admin-page.component.html',
    styleUrls: ['./admin-page.component.scss'],
    imports: [CommonModule, RouterLink, MapCardComponent, TranslatePipe],
})
export class AdminPageComponent implements OnInit {
    static readonly messageTimeout = 5000;
    maps$!: Observable<GameMap[]>;
    message: string = '';
    private mapService = inject(MapService);

    ngOnInit(): void {
        this.mapService.loadMaps();
        this.maps$ = this.mapService.maps$;
    }

    isOwner(map: GameMap): boolean {
        return this.mapService.isOwner(map);
    }

    onMapDeleted(event: { message: string }): void {
        this.message = event.message;
        if (this.message !== '') {
            setTimeout(() => {
                this.message = '';
            }, AdminPageComponent.messageTimeout);
        }
    }

    onMapVisibilityChanged(event: { message: string }): void {
        this.message = event.message;
        if (this.message !== '') {
            setTimeout(() => {
                this.message = '';
            }, AdminPageComponent.messageTimeout);
        }
    }

    onMapDuplicated(event: { message: string }): void {
        this.message = event.message;
        if (this.message !== '') {
            setTimeout(() => {
                this.message = '';
            }, AdminPageComponent.messageTimeout);
        }
    }
}
