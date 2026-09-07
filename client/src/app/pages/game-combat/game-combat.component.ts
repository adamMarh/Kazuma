/* eslint-disable @typescript-eslint/member-ordering */
import { Component, Input, OnDestroy, OnInit, inject } from '@angular/core';
import { TimerComponent } from '@app/components/timer/timer.component';
import { COMBAT_END_TIMEOUT } from '@app/constants/combat';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { CombatState } from '@common/interfaces/combatState.interface';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-combat',
    templateUrl: './game-combat.component.html',
    styleUrls: ['./game-combat.component.scss'],
    imports: [TimerComponent, TranslatePipe],
})
export class CombatTestComponent implements OnInit, OnDestroy {
    socketService = inject(SocketService);
    combatSocketService = inject(CombatSocketService);
    gameService = inject(GameService);
    currencyStore = inject(CurrencyStoreService);
    private languageService = inject(LanguageService);

    gameInstance: Game | null;
    subscriptions: Subscription[] = [];
    combatEndMessage: string = '';
    @Input() combatState: CombatState;
    playersInCombat: Player[];
    itemMessage: string = '';
    showItemMessage: boolean = false;
    itemMessageClass: string = '';
    showSlashEffect: boolean = false;
    slashOnLeft: boolean = false;
    slashTimeout: ReturnType<typeof setTimeout> | undefined;
    private defaultHp: Map<string, number> = new Map();
    private attackAudio: HTMLAudioElement | null = null;

    ngOnInit() {
        this.subscribeToPlayerAttacks();
        this.subscribeToTurnChanged();
        this.subscribeToCombatEnded();
        this.subscribeToItemEffects();
        if (!this.currencyStore.isInitialized) {
            this.currencyStore.refresh().catch((error) => error);
        }
        this.gameService.gameInstance$.subscribe((game) => {
            this.gameInstance = game;
        });
        this.gameInstance?.players.forEach((player) => {
            this.defaultHp.set(player.socketId, player.healthpoints);
        });
    }

    ngOnDestroy() {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        if (this.slashTimeout) {
            clearTimeout(this.slashTimeout);
        }
        if (this.attackAudio) {
            this.attackAudio.pause();
            this.attackAudio = null;
        }
    }

    subscribeToPlayerAttacks() {
        const playerAttackedSub = this.combatSocketService.onAttacked().subscribe((data: { combatState: CombatState }) => {
            this.combatState = data.combatState;

            if (data.combatState.attackResult?.damage > 0) {
                this.slashOnLeft = data.combatState.attacker?.socketId !== this.socketService.getSocketId();
                this.showSlashEffect = true;

                if (this.slashTimeout) {
                    clearTimeout(this.slashTimeout);
                }
                this.slashTimeout = setTimeout(() => {
                    this.showSlashEffect = false;
                }, 500);
            }
        });
        this.subscriptions.push(playerAttackedSub);
    }

    subscribeToTurnChanged() {
        const turnSub = this.combatSocketService.onTurnChanged().subscribe(() => {
            this.combatSocketService.reset();
            if (this.gameInstance?.gameId) {
                this.combatSocketService.startTimer(this.gameInstance.ended, this.gameInstance.gameId).subscribe();
            }
        });
        this.subscriptions.push(turnSub);
    }

    private subscribeToItemEffects(): void {
        const effectsSub = this.gameService.onItemEffectApplied().subscribe((data) => {
            if (data.playerId === this.socketService.getSocketId()) {
                if (data.itemType === 'potion' && data.activated) {
                    this.itemMessage = this.languageService.translate('combat.potionActivated');
                    this.itemMessageClass = 'potion-message';
                    this.showItemMessage = true;
                } else if (data.itemType === 'hourglass' && data.activated) {
                    this.itemMessage = this.languageService.translate('combat.hourglassActivated');
                    this.itemMessageClass = 'hourglass-message';
                    this.showItemMessage = true;
                } else if (data.itemType === 'crystal' && data.activated) {
                    this.itemMessage = this.languageService.translate('combat.crystalBlocked');
                    this.itemMessageClass = 'crystal-message';
                    this.showItemMessage = true;
                }
                setTimeout(() => {
                    this.showItemMessage = false;
                }, 3000);
            }
        });
        this.subscriptions.push(effectsSub);
    }

    subscribeToCombatEnded() {
        const combatEndedSub = this.combatSocketService
            .onCombatEnded()
            .subscribe((data: { combatState: CombatState; reason: string; actionPlayer: Player; gameEnded: boolean }) => {
                this.combatSocketService.reset();
                if (data.reason === 'fled') {
                    setTimeout(() => {
                        this.combatEndMessage = '';
                    }, COMBAT_END_TIMEOUT);
                } else if (data.reason === 'death') {
                    setTimeout(() => {
                        this.combatEndMessage = '';
                    }, COMBAT_END_TIMEOUT);
                }
                this.gameService.inCombat = false;
            });
        this.subscriptions.push(combatEndedSub);
    }

    onAttackOpponent(targetPlayer: string) {
        if (this.gameInstance?.gameId) {
            this.playAttackSoundIfOwned();
            this.combatSocketService.attackOpponent(targetPlayer, this.gameInstance.gameId).subscribe();
        }
    }

    private playAttackSoundIfOwned(): void {
        const ownsAttackSound = this.currencyStore.wallet.owned?.sounds?.includes('snd_attack');
        if (!ownsAttackSound) return;

        if (this.attackAudio) {
            this.attackAudio.pause();
            this.attackAudio.currentTime = 0;
        }

        this.attackAudio = new Audio('assets/sounds/attack.wav');
        this.attackAudio.volume = 0.75;
        this.attackAudio.play().catch((error) => error);
    }

    onAttemptFlee() {
        if (this.gameInstance?.gameId) {
            this.combatSocketService.attemptFlee(this.gameInstance.gameId).subscribe();
        }
    }

    getHealthSegments(player: Player | null): unknown[] {
        if (!player || player.healthpoints === undefined) return [];
        const maxHealth = this.defaultHp.get(player.socketId) || 0;
        const currentHealth = player.healthpoints || 0;
        const segments = [];
        for (let i = 1; i <= maxHealth; i++) {
            const filled = i <= currentHealth;
            const yellow = filled && currentHealth <= maxHealth * 0.5;
            const red = filled && currentHealth <= maxHealth * 0.3;
            segments.push({ filled, yellow, red });
        }
        return segments;
    }
}
