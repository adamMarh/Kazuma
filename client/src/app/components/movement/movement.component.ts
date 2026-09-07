import { Component, HostListener, inject, Input, OnDestroy, OnInit } from '@angular/core';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { GridCanvasComponent } from '@app/components/grid-canvas/grid-canvas.component';
import { TILE_SETTINGS } from '@app/interfaces/tile.interface';
import { GameService } from '@app/services/game/game.service';
import { GridService } from '@app/services/grid/grid.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { Game } from '@common/interfaces/game.interface';
import { ITEM_SETTINGS } from '@common/interfaces/item.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-movement-test',
    imports: [GridCanvasComponent, ErrorPopupComponent, TranslatePipe],
    providers: [],
    templateUrl: './movement.component.html',
    styleUrl: './movement.component.scss',
})
export class MovementTestComponent implements OnInit, OnDestroy {
    @Input() displayedPlayers: Player[] = [];
    @Input() players!: Player[];
    @Input() myPlayer: Player | null;
    @Input() gameInstance: Game | null;
    @Input() actionEnabled: boolean;
    errorPopupVisible = false;
    errorPopupMessage = '';
    game: Game | null = null;

    readonly titleSettings = TILE_SETTINGS;
    readonly itemSettings = ITEM_SETTINGS;

    protected gridService = inject(GridService);
    protected movementSocketService = inject(MovementSocketService);
    protected possibleMovements: Position[] = [];
    protected path: Position[] = [];
    protected timerCounter: number;
    protected tileInfo: TileInfo | null = null;
    protected showTileInfo = false;
    protected tileInfoPosition = { x: 0, y: 0 };

    private gameService = inject(GameService);
    private languageService = inject(LanguageService);
    private currentTurn: number = 0;
    private rightClick: boolean = false;
    private mySubscription!: Subscription;
    private myOtherSubscription!: Subscription;
    private myOtherOtherSubscription!: Subscription;
    private subscriptions: Subscription[] = [];

    @HostListener('document:click', ['$event'])
    onDocumentClick(): void {
        this.showTileInfo = false;
    }
    @HostListener('contextmenu', ['$event']) onContextMenu(event: MouseEvent): void {
        event.preventDefault();
    }

    ngOnInit(): void {
        this.gameService.gameInstance$.subscribe((game) => {
            this.game = game;
        });
        this.gridService.loadMap(this.game!.map);
        this.subscribeOnPossibleMovements();
        this.subscribeToError();
        this.subscribeToDoorOpen();
        this.subscribeToMapUpdated();
        this.onGameStart();
        this.subscribeToPreTimerStart();
    }

    getCurrentTurn(): number {
        return this.currentTurn;
    }

    onInvalidMove() {
        if (this.errorPopupMessage) {
            return;
        }
        this.errorPopupVisible = true;
        this.errorPopupMessage = this.languageService.translate('movement.movementImpossible');
    }

    onErrorPopupClosed() {
        this.errorPopupVisible = false;
    }

    ngOnDestroy(): void {
        if (this.mySubscription) {
            this.mySubscription.unsubscribe();
        }
        if (this.myOtherSubscription) {
            this.myOtherSubscription.unsubscribe();
        }
        if (this.myOtherOtherSubscription) {
            this.myOtherOtherSubscription.unsubscribe();
        }
    }

    subscribeOnPossibleMovements() {
        this.gameService.onActionEnded().subscribe((possibleMovements) => {
            this.possibleMovements = possibleMovements || [];
        });
    }

    onGameStart() {
        if (this.myPlayer?.isMyTurn) {
            this.gameService.changeTurn();
        }
    }

    subscribeToPreTimerStart(): void {
        const preStartSub = this.gameService.onPreTimerStart().subscribe(() => {
            this.possibleMovements = [];
        });
        this.subscriptions.push(preStartSub);
    }

    handleCellMouseDown({ event, x, y }: { event: MouseEvent; x: number; y: number }) {
        this.rightClick = event.button === 2;
        const position: Position = { x, y };
        if (this.rightClick) {
            event.preventDefault();
            this.gameService.getInformation(position, this.gameInstance!.gameId).subscribe((data: TileInfo) => {
                this.tileInfo = data;
                this.showTileInfo = true;
                this.tileInfoPosition = {
                    x: event.clientX + 5,
                    y: event.clientY - 100,
                };
            });
        } else {
            this.handleCellAction(position);
        }
    }

    handleCellMouseEnter(targetPos: Position) {
        if (this.possibleMovements) {
            const isValidMove = this.possibleMovements.some((m) => m.x === targetPos.x && m.y === targetPos.y);
            if (isValidMove) {
                this.movementSocketService.getShortestPath(targetPos, this.gameInstance!.gameId).subscribe((data) => {
                    this.path = data;
                });
            } else {
                this.path = [];
            }
        } else return;
    }

    isAdjacent(pos1: Position, pos2: Position): boolean {
        return Math.abs(pos1.x - pos2.x) + Math.abs(pos1.y - pos2.y) === 1;
    }

    handleCellAction(position: Position) {
        if (!this.myPlayer!.isMyTurn) {
            this.errorPopupVisible = true;
            this.errorPopupMessage = this.languageService.translate('movement.notYourTurn');
            return;
        }
        if (this.actionEnabled) {
            this.gameService.sendAction(position, this.actionEnabled, this.gameInstance!.gameId);
        } else {
            const isValidMove = this.possibleMovements.some((m) => m.x === position.x && m.y === position.y);
            if (!isValidMove) {
                this.onInvalidMove();
            } else {
                this.gameService.sendAction(position, this.actionEnabled, this.gameInstance!.gameId);
            }
        }
    }

    subscribeToDoorOpen(): void {
        const doorOpen = this.gameService.onDoorOpen().subscribe((updatedMap) => {
            this.gridService.loadMap(updatedMap);
        });
        this.subscriptions.push(doorOpen);
    }

    subscribeToError(): void {
        const errorSub = this.gameService.onError().subscribe((error) => {
            this.errorPopupVisible = true;
            this.errorPopupMessage = error.errorMessage;
        });
        this.subscriptions.push(errorSub);
    }

    subscribeToMapUpdated(): void {
        const mapUpdatedSub = this.movementSocketService.onMapUpdated().subscribe((updatedMap) => {
            this.gridService.loadMap(updatedMap);
        });
        this.subscriptions.push(mapUpdatedSub);
    }

    clearPossibleMoves() {
        this.possibleMovements = [];
        this.path = [];
    }
}
