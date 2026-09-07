import { Component, OnDestroy, OnInit, inject } from '@angular/core';
import { Router, RouterModule } from '@angular/router';
import { ChatRoomComponent } from '@app/components/chatroom/chatroom.component';
import { MAX_PLAYERS } from '@app/constants/end-game';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { EndGameService } from '@app/services/end-game/end-game.service';
import { GameService } from '@app/services/game/game.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { SocketService } from '@app/services/sockets/socket.service';
import { PlayerChallenge } from '@common/interfaces/challenge.interface';
import { Game } from '@common/interfaces/game.interface';
import { GlobalStats } from '@common/interfaces/player-global-stats';
import { PlayerStats } from '@common/interfaces/player-stats.interface';
import { Player } from '@common/interfaces/player.interface';

@Component({
    selector: 'app-end-game',
    templateUrl: './end-game.component.html',
    styleUrls: ['./end-game.component.scss', '../../../styles.scss'],
    imports: [RouterModule, ChatRoomComponent, TranslatePipe],
    standalone: true,
})
export class EndGameComponent implements OnInit, OnDestroy {
    private static readonly victoryReward = 8;
    private static readonly consolationReward = 3;
    sortStat: keyof PlayerStats | '' = '';
    sortOrderUp = true;
    playerStats: PlayerStats[] = [];
    globalStats: GlobalStats | null = null;
    gameInstance: Game | null;
    myPlayer: Player | null;
    rewardAmount: number | null = null;
    newBalance: number | null = null;
    challengeResult: PlayerChallenge | null = null;
    challengeService = inject(ChallengeService);

    private router = inject(Router);
    private endGameService = inject(EndGameService);
    private socketService = inject(SocketService);
    private gameService = inject(GameService);
    private currencyStore = inject(CurrencyStoreService);
    private languageService = inject(LanguageService);
    private victoryAudio: HTMLAudioElement | null = null;

    get emptyRowsCount(): number {
        return Math.max(0, MAX_PLAYERS - this.playerStats.length);
    }

    get gameStatusLabel(): string {
        if (!this.gameInstance || !this.myPlayer) return '—';
        return this.isMyPlayerWinner(this.gameInstance, this.myPlayer)
            ? this.languageService.translate('endGame.gameWon')
            : this.languageService.translate('endGame.gameLost');
    }

    get challengeStatusLabel(): string {
        if (!this.challengeResult) return this.languageService.translate('endGame.noChallengeActive');
        return this.challengeResult.completed
            ? this.languageService.translate('endGame.challengeWon')
            : this.languageService.translate('endGame.challengeLost');
    }

    get challengeDelta(): number {
        if (!this.challengeResult) return 0;
        return this.challengeResult.completed ? this.challengeResult.reward : 0;
    }

    get totalDelta(): number {
        return (this.rewardAmount ?? 0) + this.challengeDelta;
    }

    ngOnInit(): void {
        const gameId = window.history.state.gameId;
        if (!gameId) {
            return;
        }
        this.gameService.myPlayer$.subscribe((myPlayer: Player | null) => {
            this.myPlayer = myPlayer;
            this.computeReward();
        });
        this.gameService.gameInstance$.subscribe((game) => {
            this.gameInstance = game;
            this.computeReward();
        });
        this.currencyStore.wallet$.subscribe((w) => {
            this.newBalance = w.balance;
        });
        this.challengeService.challengeResult$.subscribe((result) => {
            this.challengeResult = result;
        });
        this.gameService.statsSnapshot$.subscribe((snapshot) => {
            if (snapshot) {
                this.playerStats = snapshot.playerStats;
                this.globalStats = snapshot.globalStats;
                return;
            }
            if (this.socketService.isConnected()) {
                this.emitGetStats(gameId);
                this.emitGetGlobalStats(gameId);
            } else {
                this.socketService.onConnect().subscribe(() => {
                    this.emitGetStats(gameId);
                    this.emitGetGlobalStats(gameId);
                });
            }
        });
    }

    emitGetGlobalStats(gameId: string): void {
        this.endGameService.loadGlobalStats(gameId).subscribe((stats) => {
            this.globalStats = stats;
        });
    }

    emitGetStats(gameId: string): void {
        this.endGameService.getEndGameStats(gameId).subscribe((stats) => {
            this.playerStats = stats;
        });
    }

    sortByStat(stat: keyof PlayerStats, orderUp: boolean): void {
        this.sortStat = stat;
        this.sortOrderUp = orderUp;
        this.playerStats = this.endGameService.sortStats(this.playerStats, stat, orderUp);
    }

    ngOnDestroy(): void {
        this.stopVictoryMusic();
    }

    navBack(): void {
        this.stopVictoryMusic();
        this.router.navigate(['/'], { replaceUrl: true });
    }

    private playVictoryMusicIfOwned(): void {
        const ownsSnd = this.currencyStore.wallet.owned?.sounds?.includes('snd_win_music');
        if (!ownsSnd || !this.gameInstance || !this.myPlayer) return;

        // Ne jouer que si la partie est vraiment terminée
        if (!this.gameInstance.ended) return;

        if (!this.isMyPlayerWinner(this.gameInstance, this.myPlayer)) return;
        if (this.victoryAudio) return;
        this.victoryAudio = new Audio('assets/sounds/victory.wav');
        this.victoryAudio.volume = 0.6;
        this.victoryAudio.play().catch((_) => _);
    }

    private stopVictoryMusic(): void {
        if (this.victoryAudio) {
            this.victoryAudio.pause();
            this.victoryAudio = null;
        }
    }

    private computeReward(): void {
        if (!this.gameInstance || !this.myPlayer) return;
        const game = this.gameInstance;
        const isWinner = this.isMyPlayerWinner(game, this.myPlayer);
        this.playVictoryMusicIfOwned();

        const hasPot = (game.pot ?? 0) > 0;
        const pot = game.pot ?? 0;

        if (hasPot) {
            if (isWinner) {
                const winners = this.countWinners(game);
                this.rewardAmount = Math.floor(pot / winners) + EndGameComponent.victoryReward;
            } else {
                this.rewardAmount = Math.floor(EndGameComponent.consolationReward / 2);
            }
        } else {
            this.rewardAmount = isWinner ? EndGameComponent.victoryReward : EndGameComponent.consolationReward;
        }
    }

    private countWinners(game: Game): number {
        const activeHumans = game.players.filter((p) => !p.isBot && !p.hasLeft);

        if (game.map?.gameMode === 'CTF' && (game.winner === 'red' || game.winner === 'blue')) {
            return activeHumans.filter((p) => game.teams[game.winner as 'red' | 'blue']?.includes(p.socketId)).length || 1;
        }

        const battleWinners = activeHumans.filter((p) => (p.battlesWon || 0) >= 3);
        if (battleWinners.length > 0) return battleWinners.length;

        const maxBattlesWon = Math.max(...activeHumans.map((p) => p.battlesWon || 0));
        return activeHumans.filter((p) => (p.battlesWon || 0) === maxBattlesWon).length || 1;
    }

    private isMyPlayerWinner(game: Game, myPlayer: Player): boolean {
        if (game.map?.gameMode === 'CTF' && (game.winner === 'red' || game.winner === 'blue')) {
            return game.teams[game.winner]?.includes(myPlayer.socketId) ?? false;
        }

        const activeHumans = game.players.filter((p) => !p.isBot && !p.hasLeft);

        const battleWinners = activeHumans.filter((p) => (p.battlesWon || 0) >= 3);
        if (battleWinners.length > 0) {
            return battleWinners.some((p) => p.name === myPlayer.name);
        }

        const maxBattlesWon = Math.max(...activeHumans.map((p) => p.battlesWon || 0));
        const byBestScore = activeHumans.filter((p) => (p.battlesWon || 0) === maxBattlesWon);
        return byBestScore.some((p) => p.name === myPlayer.name);
    }
}
