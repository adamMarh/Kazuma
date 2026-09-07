import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { CharacterFormComponent } from '@app/components/character-form/character-form.component';
import { MapCardComponent } from '@app/components/map-card/map-card.component';
import { GameMap } from '@app/interfaces/game-map.interface';
import { AuthService } from '@app/services/auth/auth.service';
import { CharacterFormService } from '@app/services/character-form/character-form.service';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { MapService } from '@app/services/maps/maps.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { Observable } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-game-page',
    templateUrl: './game-page.component.html',
    styleUrls: ['./game-page.component.scss'],
    imports: [CommonModule, MapCardComponent, CharacterFormComponent, TranslatePipe, FormsModule],
})
export class GamePageComponent implements OnInit {
    static readonly messageTimeoutMs = 5000;

    visibleMaps$!: Observable<GameMap[]>;
    selectedMap!: GameMap | null;
    isCharacterFormVisible: boolean = false;
    message = '';
    entryFee: number = 0;
    friendsOnly: boolean = false;

    private mapService = inject(MapService);
    private router = inject(Router);
    private characterFormService = inject(CharacterFormService);
    private gameService = inject(GameService);
    private lobbySocketService = inject(LobbySocketService);
    private authService = inject(AuthService);
    private languageService = inject(LanguageService);

    ngOnInit(): void {
        this.mapService.loadMapsForGameCreation();
        this.visibleMaps$ = this.mapService.maps$;
    }

    onSelectGame(selected: GameMap): void {
        this.selectedMap = selected;
    }

    navCreateGame(): void {
        if (!this.selectedMap || !this.selectedMap._id) {
            return;
        }
        this.lobbySocketService.setGameInstance(null);
        const mapId: string = this.selectedMap._id;
        this.mapService.checkGameAvailability(mapId).subscribe({
            next: (isAvailable) => {
                if (isAvailable) {
                    this.isCharacterFormVisible = true;
                    this.message = '';
                } else {
                    this.showMessage(this.languageService.translate('gameCreation.mapUnavailableMessage'));
                    this.selectedMap = null;
                    this.mapService.loadMaps();
                }
            },
            error: () => {
                this.showMessage(this.languageService.translate('gameCreation.checkErrorMessage'));
            },
        });
    }

    createGame(): void {
        const selectedAvatar = this.characterFormService.selectedAvatar;
        if (!selectedAvatar) {
            this.showMessage(this.languageService.translate('gameCreation.selectAvatarMessage'));
            return;
        }
        const characterData = {
            name: this.characterFormService.playerName,
            avatar: selectedAvatar,
            attributes: this.characterFormService.attributes.reduce(
                (acc, { name, value, dice }) => {
                    acc[name] = { value, dice: dice ?? 0 };
                    return acc;
                },
                {} as Record<string, { value: number; dice: number }>,
            ),
        };
        const payload = {
            ...characterData,
            map: { ...(this.selectedMap as GameMap), imageUrl: '' },
        };

        this.gameService
            .createGame(
                payload.name,
                payload.avatar,
                payload.map,
                payload.attributes,
                this.entryFee,
                this.friendsOnly,
                this.authService.currentUser?.uid,
            )
            .subscribe({
                next: () => {
                    this.router.navigate(['/waiting-room']);
                },
            });
        this.characterFormService.resetForm();
    }

    navBack(): void {
        this.router.navigate(['/'], { replaceUrl: true });
    }

    onFormClosed(): void {
        this.isCharacterFormVisible = false;
        this.characterFormService.resetForm();
    }

    private showMessage(msg: string): void {
        this.message = msg;
        setTimeout(() => {
            this.message = '';
        }, GamePageComponent.messageTimeoutMs);
    }
}
