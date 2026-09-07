import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { CORRECT_TIME } from '@app/constants/combat';
import { GameService } from '@app/services/game/game.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-timer',
    templateUrl: './timer.component.html',
    styleUrls: ['./timer.component.scss', '../../../styles.scss'],
    imports: [TranslatePipe],
})
export class TimerComponent implements OnInit, OnDestroy {
    combatSocketService = inject(CombatSocketService);
    movementSocketService = inject(MovementSocketService);
    gameService = inject(GameService);

    timerValue: boolean = false;
    subscriptions: Subscription[] = [];
    inCombat: boolean = false;
    gameInstance: Game | null = null;
    turnTime: number = CORRECT_TIME;

    get combatTime() {
        return this.combatSocketService.time;
    }
    shouldBlink(): boolean {
        return this.gameService.inCombat && this.combatSocketService.time <= 3;
    }
    ngOnInit(): void {
        this.subscribeToCombatTimerValue();
        this.gameService.gameInstance$.subscribe((game) => {
            this.gameInstance = game;
        });
        this.subscribeToTurnTimerStart();
        this.subscribeToTurnTimerTick();
    }

    subscribeToCombatTimerValue() {
        const timerSub = this.combatSocketService
            .getTimerValue()
            .subscribe((data: { timerStarted: boolean; timerPaused: boolean; delay: number }) => {
                if (data.timerStarted === true) {
                    this.inCombat = true;
                    if (this.gameInstance) {
                        this.combatSocketService.combatCountdown(data.delay, this.gameInstance.gameId).subscribe();
                    }
                }
                if (data.timerPaused === true) {
                    this.inCombat = false;
                    this.combatSocketService.pause();
                }
            });
        this.subscriptions.push(timerSub);
    }

    subscribeToTurnTimerStart(): void {
        const turnStartSub = this.gameService.onTurnTimerStart().subscribe(() => {
            this.turnTime = 30;
        });
        this.subscriptions.push(turnStartSub);
    }

    subscribeToTurnTimerTick(): void {
        const turnTickSub = this.gameService.onTurnTimerTick().subscribe((data: { secondsRemaining: number }) => {
            this.turnTime = data.secondsRemaining;
        });
        this.subscriptions.push(turnTickSub);
    }

    ngOnDestroy() {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
    }
}
