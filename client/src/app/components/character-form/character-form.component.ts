import { CommonModule } from '@angular/common';
import { Component, EventEmitter, inject, OnDestroy, OnInit, Output } from '@angular/core';
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import {
    ATK,
    ATTRIBUTE_TRANSLATIONS,
    BASE_GAME_AVATARS,
    DEF,
    GameAvatarOption,
    SPECIAL_GAME_AVATARS,
    TIMER_DELAY,
    TOOLTIPS,
} from '@app/constants/character-form';
import { AuthService } from '@app/services/auth/auth.service';
import { CharacterFormService } from '@app/services/character-form/character-form.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { AttributeInput } from '@common/interfaces/attribute.interface';
import { Game } from '@common/interfaces/game.interface';
import { Subscription } from 'rxjs';

@Component({
    standalone: true,
    selector: 'app-character-form',
    templateUrl: './character-form.component.html',
    styleUrls: ['./character-form.component.scss', '../../../styles.scss'],
    imports: [CommonModule, ReactiveFormsModule, ConfirmationPopupComponent, ErrorPopupComponent, TranslatePipe],
})
export class CharacterFormComponent implements OnInit, OnDestroy {
    @Output() closeForm = new EventEmitter<void>();
    @Output() characterCreated = new EventEmitter<{ name: string; avatar: number; attributes: AttributeInput[] }>();

    avatars: GameAvatarOption[] = [...BASE_GAME_AVATARS];
    readonly tooltips = TOOLTIPS;
    attributeTranslations = ATTRIBUTE_TRANSLATIONS;
    showSendingPopup = false;
    showClosingPopup = false;
    isNameValid = true;

    characterForm: FormGroup;
    characterFormService = inject(CharacterFormService);
    lobbySocketService = inject(LobbySocketService);
    authService = inject(AuthService);
    currencyStore = inject(CurrencyStoreService);
    router = inject(Router);
    languageService = inject(LanguageService);

    currentAvatar: number | null = null;
    currentGame: Game | null = null;
    avatarErrorMessage = '';

    errorPopupMessage = '';
    errorPopupVisible = false;
    errorShouldRedirect = false;
    showReconnectButton = false;
    lockedSpecialAvatarIds = new Set<number>();

    private subscriptions: Subscription[] = [];

    get attributes() {
        return this.characterFormService.attributes;
    }

    get selectedAvatar(): number | null {
        return this.characterFormService.selectedAvatar;
    }

    get attackDice(): number | null {
        return this.characterFormService.getDiceValue(ATK);
    }

    get defenseDice(): number | null {
        return this.characterFormService.getDiceValue(DEF);
    }

    get unavailableAvatars(): number[] {
        return this.currentGame?.selectedAvatars ? Object.values(this.currentGame.selectedAvatars) : [];
    }

    ngOnInit(): void {
        this.initForm();
        this.updateGameAvatarChoices();

        const walletSub = this.currencyStore.wallet$.subscribe(() => {
            this.updateGameAvatarChoices();
        });
        this.subscriptions.push(walletSub);

        if (!this.currencyStore.isInitialized) {
            void this.currencyStore.refresh();
        }

        this.subscribeToGameUpdates();
        this.subscribeToForceLockEvents();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => {
            if (sub) sub.unsubscribe();
        });
        this.subscriptions = [];
        this.characterForm.reset();
        this.characterFormService.resetForm();
    }

    subscribeToGameUpdates(): void {
        const gameInstance = this.lobbySocketService.getGameInstance();
        if (gameInstance) {
            this.currentGame = gameInstance;
        }
        const lobbyUpdateSub = this.lobbySocketService.onLobbyUpdate().subscribe((game: Game) => {
            this.currentGame = game;
            if (this.currentGame) {
                this.currentGame.selectedAvatars = game.selectedAvatars;
            }
        });
        this.subscriptions.push(lobbyUpdateSub);
    }

    handleAvatarClick(avatar: number): void {
        if (this.unavailableAvatars.includes(avatar) || this.isSpecialAvatarLocked(avatar)) return;
        this.selectAvatar(avatar);
    }

    closeCharacterForm(): void {
        const gameId = this.lobbySocketService.getGameId();
        if (gameId && this.currentAvatar) {
            this.lobbySocketService.deselectAvatar(gameId).subscribe({
                next: () => {
                    this.currentAvatar = null;
                    this.characterFormService.selectAvatar(null);
                    this.characterForm.patchValue({ selectedAvatar: null });
                    this.lobbySocketService.deselectAvatar(gameId).subscribe();
                },
            });
            this.lobbySocketService.leavePendingRoom(gameId);
        }
        this.characterFormService.resetForm();
        this.closeForm.emit();
    }

    openClosingPopup() {
        this.showClosingPopup = true;
    }

    confirmClosingForm(response: boolean) {
        this.showClosingPopup = false;
        if (response) {
            this.closeCharacterForm();
        }
    }

    openSendingPopup() {
        this.showSendingPopup = true;
    }

    confirmSendingForm(response: boolean) {
        this.showSendingPopup = false;
        if (response) {
            const characterName = this.authService.currentUsername;
            const selectedAvatar = this.characterForm.get('selectedAvatar')?.value;
            if (!characterName || selectedAvatar === null || this.characterFormService.attributes.length === 0) {
                return;
            }
            const attributes = this.characterFormService.attributes.map((attr) => ({
                name: attr.name,
                value: attr.value,
                dice: attr.dice || null,
            }));
            this.characterFormService.playerName = characterName;
            this.characterFormService.selectedAvatar = selectedAvatar;

            if (characterName && selectedAvatar !== null) {
                this.characterCreated.emit({ name: characterName, avatar: selectedAvatar, attributes });
            }
        }
    }

    applyBonus(type: string): void {
        this.characterFormService.applyBonus(type);
    }

    assignDice(attributeName: 'atk' | 'def'): void {
        this.characterFormService.assignDice(attributeName);
    }

    hasIncreasedValue(attrName: string): boolean {
        return this.characterFormService.hasIncreasedValue(attrName);
    }

    isBonusApplied(type: string): boolean {
        return this.characterFormService.isBonusApplied(type);
    }

    isDiceAssigned(): boolean {
        return this.characterFormService.isDiceAssigned();
    }

    printTooltip(attrName: string): string {
        return this.tooltips[attrName] || ' ';
    }

    handleErrorPopupClosed(): void {
        this.errorPopupVisible = false;
        if (this.errorShouldRedirect) {
            this.closeForm.emit();
            this.router.navigate(['/home']);
        }
    }

    async handleReconnect(): Promise<void> {
        this.errorPopupVisible = false;
        try {
            const gameId = this.lobbySocketService.getGameId();
            if (!gameId) {
                throw new Error('Game ID is undefined');
            }
            const game = await this.lobbySocketService.checkGameId(gameId).toPromise();

            if (game && game.isLocked) {
                this.errorPopupMessage = this.languageService.translate('characterForm.roomLocked');
                this.errorPopupVisible = true;
            } else {
                this.errorPopupMessage = '';
                this.errorPopupVisible = false;
                if (gameId && this.currentAvatar) {
                    await this.lobbySocketService.deselectAvatar(gameId).toPromise();
                    this.currentAvatar = null;
                }
            }
        } catch (error) {
            this.errorPopupMessage = this.languageService.translate('characterForm.roomError');
            this.errorPopupVisible = true;
        }
    }

    selectAvatar(index: number | null): void {
        if (index === null || !this.avatars.some((avatar) => avatar.id === index) || this.isSpecialAvatarLocked(index)) return;
        const gameId = this.lobbySocketService.getGameId();
        if (!gameId) {
            this.characterForm.patchValue({ selectedAvatar: index });
            this.characterFormService.selectAvatar(index);
            return;
        }
        if (this.currentAvatar) {
            const deselectSub = this.lobbySocketService.deselectAvatar(gameId).subscribe(() => {
                this.currentAvatar = null;
                this.characterForm.patchValue({ selectedAvatar: null });
                this.characterFormService.selectAvatar(null);
            });
            this.subscriptions.push(deselectSub);
        }
        const selectSub = this.lobbySocketService.selectAvatar(gameId, index).subscribe((res: { success: boolean }) => {
            if (res && res.success) {
                this.currentAvatar = index;
                this.characterForm.patchValue({ selectedAvatar: index });
                this.characterFormService.selectAvatar(index);
            } else {
                this.avatarErrorMessage = this.languageService.translate('characterForm.avatarNotAvailable');
                setTimeout(() => {
                    this.avatarErrorMessage = '';
                }, TIMER_DELAY);
                this.characterForm.patchValue({ selectedAvatar: null });
            }
        });
        this.subscriptions.push(selectSub);
    }

    isSpecialAvatarLocked(avatarId: number): boolean {
        return this.lockedSpecialAvatarIds.has(avatarId);
    }

    private initForm(): void {
        this.characterForm = new FormGroup({
            selectedAvatar: new FormControl(null, Validators.required),
        });
    }

    private subscribeToForceLockEvents(): void {
        const sub = this.lobbySocketService.onForceLockRoom().subscribe((payload: { gameId: string; target: string }) => {
            if (payload.target === 'form' && this.lobbySocketService.getGameId() === payload.gameId) {
                this.handleForceLock();
            }
        });
        this.subscriptions.push(sub);
    }

    private handleForceLock(): void {
        this.errorPopupMessage = this.languageService.translate('characterForm.roomLockedByAdmin');
        this.errorPopupVisible = true;
        this.errorShouldRedirect = true;
        this.showReconnectButton = true;
    }

    private updateGameAvatarChoices(): void {
        const ownedCharacters = this.currencyStore.wallet.owned.characters;
        const ownedVisuals = this.currencyStore.wallet.owned.visuals;
        const ownedCosmetics = new Set([...ownedCharacters, ...ownedVisuals]);

        this.lockedSpecialAvatarIds = new Set(
            SPECIAL_GAME_AVATARS.filter((avatar) => !ownedCosmetics.has(avatar.unlockItemId)).map((avatar) => avatar.id),
        );

        this.avatars = [...BASE_GAME_AVATARS, ...SPECIAL_GAME_AVATARS];

        if (this.selectedAvatar !== null && this.isSpecialAvatarLocked(this.selectedAvatar)) {
            this.currentAvatar = null;
            this.characterForm.patchValue({ selectedAvatar: null });
            this.characterFormService.selectAvatar(null);
        }
    }
}
