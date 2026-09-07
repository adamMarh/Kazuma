/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-unused-vars */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { Component } from '@angular/core';
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ErrorPopupComponent } from '@app/components/error-popup/error-popup.component';
import { GridCanvasComponent } from '@app/components/grid-canvas/grid-canvas.component';
import { GameMap } from '@app/interfaces/game-map.interface';
import { GameService } from '@app/services/game/game.service';
import { GridService } from '@app/services/grid/grid.service';
import { MovementSocketService } from '@app/services/sockets/movement-socket/movement-socket.service';
import { Game } from '@common/interfaces/game.interface';
import { Player } from '@common/interfaces/player.interface';
import { Position } from '@common/interfaces/position.interface';
import { TileInfo } from '@common/interfaces/tileInfo.interface';
import { of, Subject } from 'rxjs';
import { MovementTestComponent } from './movement.component';

@Component({
    selector: 'app-grid-canvas',
    template: '',
})
class FakeGridCanvasComponent {}

@Component({
    selector: 'app-error-popup',
    template: '',
})
class FakeErrorPopupComponent {}

class FakeGameService {
    private gameInstanceSubject = new Subject<Game>();
    private actionEndedSubject = new Subject<Position[]>();
    private preTimerStartSubject = new Subject<void>();
    private doorOpenSubject = new Subject<any>();
    private errorSubject = new Subject<{ errorMessage: string }>();

    // eslint-disable-next-line @typescript-eslint/member-ordering
    gameInstance$ = this.gameInstanceSubject.asObservable();

    sendAction(position: Position, actionEnabled: boolean, gameId: string) {}
    changeTurn() {}

    onActionEnded() {
        return this.actionEndedSubject.asObservable();
    }
    emitActionEnded(movements: Position[]) {
        this.actionEndedSubject.next(movements);
    }

    onPreTimerStart() {
        return this.preTimerStartSubject.asObservable();
    }
    emitPreTimerStart() {
        this.preTimerStartSubject.next();
    }

    onDoorOpen() {
        return this.doorOpenSubject.asObservable();
    }
    emitDoorOpen(updatedMap: any) {
        this.doorOpenSubject.next(updatedMap);
    }

    onError() {
        return this.errorSubject.asObservable();
    }
    emitError(error: { errorMessage: string }) {
        this.errorSubject.next(error);
    }

    setGameInstance(game: Game) {
        this.gameInstanceSubject.next(game);
    }

    getInformation(position: Position, gameId: string) {
        const fakeTileInfo: TileInfo = {
            tileType: 'default',
            tileCost: '1',
            isActionTile: false,
        };
        return of(fakeTileInfo);
    }
}

class FakeGridService {
    get gridSize() {
        return () => ({ width: 100, height: 100 });
    }
    get grid() {
        return () => [
            ['grass', 'grass'],
            ['grass', 'grass'],
        ];
    }
    get items() {
        return () => [
            ['empty', 'empty'],
            ['empty', 'empty'],
        ];
    }
    loadMap(map: GameMap): void {}
}

class FakeMovementSocketService {
    getShortestPath(target: Position, gameId: string) {
        return of([{ x: 0, y: 0 }, target]);
    }
    onMapUpdated() {
        return of(null);
    }
}

describe('MovementTestComponent', () => {
    let component: MovementTestComponent;
    let fixture: ComponentFixture<MovementTestComponent>;
    let gameService: FakeGameService;
    let gridService: FakeGridService;
    let movementSocketService: FakeMovementSocketService;

    const fakeGame: Game = {
        gameId: '123',
        players: [],
        inactivePlayers: [],
        map: {
            _id: 'map1',
            name: 'Test Map',
            size: '10x10',
            gameMode: 'default',
            description: 'Carte de test',
            lastSave: new Date(),
            imageUrl: 'http://example.com/image.png',
            hidden: false,
            tiles: [
                ['tile1', 'tile2'],
                ['tile3', 'tile4'],
            ],
            items: [
                ['item1', 'item2'],
                ['item3', 'item4'],
            ],
            nbCheckpoints: '3',
            nbRandomItems: '5',
        },
        isLocked: false,
        dropInActive: false,
        started: false,
        ended: false,
        maxPlayers: 4,
        playerTurns: [],
        currentPlayerIndex: 0,
        startingPoints: [],
        selectedAvatars: {},
        isInDebugMode: false,
        teams: {
            red: [],
            blue: [],
        },
        winner: '',
    };

    const fakePlayer: Player = { isMyTurn: true } as Player;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [MovementTestComponent, FakeGridCanvasComponent, FakeErrorPopupComponent],
            providers: [
                { provide: GameService, useClass: FakeGameService },
                { provide: GridService, useClass: FakeGridService },
                { provide: MovementSocketService, useClass: FakeMovementSocketService },
            ],
        })

            .overrideComponent(GridCanvasComponent, { set: { template: '' } })
            .overrideComponent(ErrorPopupComponent, { set: { template: '' } })
            .compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(MovementTestComponent);
        component = fixture.componentInstance;
        gameService = TestBed.inject(GameService) as any;
        gridService = TestBed.inject(GridService) as any;
        movementSocketService = TestBed.inject(MovementSocketService) as any;

        component.gameInstance = fakeGame;
        component.myPlayer = fakePlayer;
        component.players = [fakePlayer];
        component.actionEnabled = false;

        component.game = fakeGame;

        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should hide tileInfo when clicking on the document (HostListener)', () => {
        (component as any).showTileInfo = true;
        component.onDocumentClick();
        expect((component as any).showTileInfo).toBeFalse();
    });
    it('should update the game property via gameInstance$ subscription in ngOnInit', fakeAsync(() => {
        (gameService as FakeGameService).setGameInstance(fakeGame);
        tick();
        expect(component.game).toEqual(fakeGame);
    }));

    it('should return the value of currentTurn via getCurrentTurn', () => {
        (component as any).currentTurn = 5;
        expect(component.getCurrentTurn()).toEqual(5);
    });

    it('should prevent default behavior on contextmenu (HostListener)', () => {
        const event = new MouseEvent('contextmenu');
        spyOn(event, 'preventDefault');
        component.onContextMenu(event);
        expect(event.preventDefault).toHaveBeenCalled();
    });

    it('should display an error on invalid movement', () => {
        (component as any).errorPopupMessage = '';
        component.onInvalidMove();
        expect(component.errorPopupVisible).toBeTrue();
        expect(component.errorPopupMessage).toEqual('Movement Impossible');
    });

    it('should close the error popup', () => {
        component.errorPopupVisible = true;
        component.onErrorPopupClosed();
        expect(component.errorPopupVisible).toBeFalse();
    });

    it('should unsubscribe from subscriptions on ngOnDestroy', () => {
        (component as any).mySubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
        (component as any).myOtherSubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
        (component as any).myOtherOtherSubscription = { unsubscribe: jasmine.createSpy('unsubscribe') };
        component.ngOnDestroy();
        expect((component as any).mySubscription.unsubscribe).toHaveBeenCalled();
        expect((component as any).myOtherSubscription.unsubscribe).toHaveBeenCalled();
        expect((component as any).myOtherOtherSubscription.unsubscribe).toHaveBeenCalled();
    });

    it('should update possibleMovements in subscribeOnPossibleMovements', fakeAsync(() => {
        const fakeMovements: Position[] = [{ x: 1, y: 2 }];
        (gameService as FakeGameService).emitActionEnded(fakeMovements);
        tick();
        expect((component as any).possibleMovements).toEqual(fakeMovements);
    }));

    it("should call changeTurn in onGameStart if it is the player's turn", () => {
        spyOn(gameService, 'changeTurn');
        component.onGameStart();
        expect(gameService.changeTurn).toHaveBeenCalled();
    });

    it('should reset possibleMovements in subscribeToPreTimerStart', fakeAsync(() => {
        (component as any).possibleMovements = [{ x: 3, y: 4 }];
        (gameService as FakeGameService).emitPreTimerStart();
        tick();
        expect((component as any).possibleMovements).toEqual([]);
    }));

    it('should call getInformation on right click on a cell in handleCellMouseDown', fakeAsync(() => {
        spyOn(gameService, 'getInformation').and.callThrough();
        const fakeEvent = new MouseEvent('mousedown', { button: 2, clientX: 100, clientY: 200 });
        component.handleCellMouseDown({ event: fakeEvent, x: 5, y: 6 });
        tick();
        expect(gameService.getInformation).toHaveBeenCalledWith({ x: 5, y: 6 }, fakeGame.gameId);
        expect((component as any).tileInfo).toBeDefined();
        expect((component as any).showTileInfo).toBeTrue();
        expect((component as any).tileInfoPosition).toEqual({ x: 105, y: 100 });
    }));

    it('should call handleCellAction on left click on a cell in handleCellMouseDown', () => {
        spyOn(component, 'handleCellAction');
        const fakeEvent = new MouseEvent('mousedown', { button: 0 });
        component.handleCellMouseDown({ event: fakeEvent, x: 2, y: 3 });
        expect(component.handleCellAction).toHaveBeenCalledWith({ x: 2, y: 3 });
    });

    it('should update the path in handleCellMouseEnter if the movement is valid', fakeAsync(() => {
        (component as any).possibleMovements = [{ x: 10, y: 10 }];
        const fakeTarget: Position = { x: 10, y: 10 };
        spyOn(movementSocketService, 'getShortestPath').and.callThrough();
        component.handleCellMouseEnter(fakeTarget);
        tick();
        expect(movementSocketService.getShortestPath).toHaveBeenCalledWith(fakeTarget, fakeGame.gameId);
        expect((component as any).path).toEqual([{ x: 0, y: 0 }, fakeTarget]);
    }));

    it('should reset the path in handleCellMouseEnter if the movement is not valid', () => {
        (component as any).possibleMovements = [{ x: 1, y: 1 }];
        const fakeTarget: Position = { x: 5, y: 5 };
        (component as any).path = [{ x: 9, y: 9 }];
        component.handleCellMouseEnter(fakeTarget);
        expect((component as any).path).toEqual([]);
    });

    it('should check if two positions are adjacent via isAdjacent', () => {
        const pos1 = { x: 1, y: 1 };
        const pos2 = { x: 1, y: 2 };
        const pos3 = { x: 3, y: 3 };
        expect(component.isAdjacent(pos1, pos2)).toBeTrue();
        expect(component.isAdjacent(pos1, pos3)).toBeFalse();
    });

    describe('handleCellAction', () => {
        it("should display an error if it is not the player's turn", () => {
            component.myPlayer = { isMyTurn: false } as Player;
            (component as any).errorPopupMessage = '';
            component.handleCellAction({ x: 0, y: 0 });
            expect(component.errorPopupVisible).toBeTrue();
            expect(component.errorPopupMessage).toContain("Ce n'est pas votre tour");
        });

        it('should call sendAction if actionEnabled is true', () => {
            component.myPlayer = { isMyTurn: true } as Player;
            component.actionEnabled = true;
            spyOn(gameService, 'sendAction');
            component.handleCellAction({ x: 2, y: 2 });
            expect(gameService.sendAction).toHaveBeenCalledWith({ x: 2, y: 2 }, true, fakeGame.gameId);
        });

        it('should call sendAction if the movement is valid when actionEnabled is false', () => {
            component.myPlayer = { isMyTurn: true } as Player;
            component.actionEnabled = false;
            (component as any).possibleMovements = [{ x: 5, y: 5 }];
            spyOn(gameService, 'sendAction');
            component.handleCellAction({ x: 5, y: 5 });
            expect(gameService.sendAction).toHaveBeenCalledWith({ x: 5, y: 5 }, false, fakeGame.gameId);
        });

        it('should call onInvalidMove if the movement is invalid when actionEnabled is false', () => {
            component.myPlayer = { isMyTurn: true } as Player;
            component.actionEnabled = false;
            (component as any).possibleMovements = [{ x: 1, y: 1 }];
            spyOn(component, 'onInvalidMove');
            component.handleCellAction({ x: 9, y: 9 });
            expect(component.onInvalidMove).toHaveBeenCalled();
        });
    });

    it('should display the error in subscribeToError', fakeAsync(() => {
        const errorMessage = 'Erreur test';
        (gameService as FakeGameService).emitError({ errorMessage });
        tick();
        expect(component.errorPopupVisible).toBeTrue();
        expect(component.errorPopupMessage).toEqual(errorMessage);
    }));

    it('should reset possibleMovements and path via clearPossibleMoves', () => {
        (component as any).possibleMovements = [{ x: 1, y: 1 }];
        (component as any).path = [{ x: 2, y: 2 }];
        component.clearPossibleMoves();
        expect((component as any).possibleMovements).toEqual([]);
        expect((component as any).path).toEqual([]);
    });

    it('should subscribe to gameInstance updates in ngOnInit', fakeAsync(() => {
        fixture.destroy();
        fixture = TestBed.createComponent(MovementTestComponent);
        component = fixture.componentInstance;
        spyOn(gridService, 'loadMap');

        component.game = fakeGame;
        fixture.detectChanges();
        expect(gridService.loadMap).toHaveBeenCalledWith(fakeGame.map);
    }));

    it('should update possibleMovements with the value emitted by onActionEnded', fakeAsync(() => {
        const fakeMovements: Position[] = [{ x: 1, y: 2 }];
        (gameService as FakeGameService).emitActionEnded(fakeMovements);
        tick();
        expect((component as any).possibleMovements).toEqual(fakeMovements);
    }));

    it('should initialize possibleMovements to an empty array if onActionEnded emits a falsy value', fakeAsync(() => {
        (gameService as FakeGameService).emitActionEnded(null as any);
        tick();
        expect((component as any).possibleMovements).toEqual([]);
    }));

    describe('onInvalidMove', () => {
        it('does nothing if errorPopupMessage is already defined', () => {
            (component as any).errorPopupMessage = 'Une erreur existe déjà';
            component.onInvalidMove();
            expect(component.errorPopupVisible).toBeFalse();
            expect(component.errorPopupMessage).toEqual('Une erreur existe déjà');
        });

        it('displays popup and sets message when errorPopupMessage is empty', () => {
            (component as any).errorPopupMessage = '';
            component.onInvalidMove();
            expect(component.errorPopupVisible).toBeTrue();
            expect(component.errorPopupMessage).toEqual('Movement Impossible');
        });
    });

    describe('handleCellMouseEnter', () => {
        it('returns immediately if possibleMovements is falsey', () => {
            (component as any).possibleMovements = null;

            (component as any).path = [{ x: 99, y: 99 }];

            component.handleCellMouseEnter({ x: 5, y: 5 });

            expect((component as any).path).toEqual([{ x: 99, y: 99 }]);
        });
    });

    it('should call gridService.loadMap when doorOpen event is emitted', fakeAsync(() => {
        const updatedMap = {
            _id: 'updatedMap',
            name: 'Updated Map',
            size: '5x5',
            gameMode: 'default',
            description: 'A newly opened door scenario',
            lastSave: new Date(),
            imageUrl: 'http://example.com/updated.png',
            hidden: false,
            tiles: [
                ['tile1', 'tile2'],
                ['tile3', 'tile4'],
            ],
            items: [
                ['item1', 'item2'],
                ['item3', 'item4'],
            ],
            nbCheckpoints: '2',
            nbRandomItems: '1',
        };
        spyOn(gridService, 'loadMap').and.callThrough();
        (gameService as FakeGameService).emitDoorOpen(updatedMap);

        tick();
        expect(gridService.loadMap).toHaveBeenCalledWith(updatedMap);
    }));
});
