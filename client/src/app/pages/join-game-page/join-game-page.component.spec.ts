import { ComponentFixture, TestBed } from '@angular/core/testing';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { ID_TEST, NAME_TEST } from '@app/constants/character-form';
import {
    ALLOWED_ELEMENTS,
    ASCII_A,
    ASCII_Z,
    AVATAR_NUM_TEST,
    MAX_ALLOWED_NUMBER,
    MIN_ALLOWED_NUMBER,
    MOCK_GAME,
    MOCK_JOIN_RESPONSE,
    MOCK_PLAYER_DATA,
    SPECIAL_CHARS,
} from '@app/constants/join-page';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { of, throwError } from 'rxjs';
import { JoinGamePageComponent } from './join-game-page.component';
import SpyObj = jasmine.SpyObj;
import { GameService } from '@app/services/game/game.service';

describe('JoinGamePageComponent', () => {
    let component: JoinGamePageComponent;
    let fixture: ComponentFixture<JoinGamePageComponent>;
    let socketServiceMock: SpyObj<LobbySocketService>;
    let routerMock: SpyObj<Router>;
    let gameServiceMock: jasmine.SpyObj<GameService>;

    beforeEach(async () => {
        routerMock = jasmine.createSpyObj('Router', ['navigate']);
        socketServiceMock = jasmine.createSpyObj('LobbySocketService', [
            'checkGameId',
            'onLobbyUpdate',
            'sendPlayerData',
            'setGameInstance',
            'getGameInstance',
            'onForceLockRoom',
        ]);
        gameServiceMock = jasmine.createSpyObj('GameService', ['joinGame']);

        TestBed.configureTestingModule({
            imports: [FormsModule],
            providers: [
                { provide: LobbySocketService, useValue: socketServiceMock },
                { provide: Router, useValue: routerMock },
                { provide: GameService, useValue: gameServiceMock },
            ],
        }).compileComponents();
        socketServiceMock.onLobbyUpdate.and.returnValue(of(MOCK_GAME));
        socketServiceMock.onForceLockRoom.and.returnValue(of({ gameId: ID_TEST, target: 'form' }));
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(JoinGamePageComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('allowOnlyNumbers()', () => {
        function createKeyboardEvent(key: string): KeyboardEvent {
            const event = new KeyboardEvent('keydown', { key });
            spyOn(event, 'preventDefault');
            return event;
        }

        it('should allow numeric keys (0-9)', () => {
            for (let i = MIN_ALLOWED_NUMBER; i <= MAX_ALLOWED_NUMBER; i++) {
                const event = createKeyboardEvent(i.toString());
                component.allowOnlyNumbers(event);
                expect(event.preventDefault).not.toHaveBeenCalled();
            }
        });

        it('should allow navigation keys', () => {
            const allowedKeys = ALLOWED_ELEMENTS;
            allowedKeys.forEach((key) => {
                const event = createKeyboardEvent(key);
                component.allowOnlyNumbers(event);
                expect(event.preventDefault).not.toHaveBeenCalled();
            });
        });

        it('should block letters (A-Z)', () => {
            for (let i = ASCII_A; i <= ASCII_Z; i++) {
                const event = createKeyboardEvent(String.fromCharCode(i));
                component.allowOnlyNumbers(event);
                expect(event.preventDefault).toHaveBeenCalled();
            }
        });

        it('should block special characters', () => {
            const specialChars = SPECIAL_CHARS;
            specialChars.forEach((char) => {
                const event = createKeyboardEvent(char);
                component.allowOnlyNumbers(event);
                expect(event.preventDefault).toHaveBeenCalled();
            });
        });
    });

    describe('joinGame()', () => {
        it('should show character form on successful game ID check', () => {
            socketServiceMock.checkGameId.and.returnValue(of(MOCK_GAME));
            component.gameAccessCode = ID_TEST;
            component.joinGame();
            fixture.detectChanges();
            expect(socketServiceMock.checkGameId).toHaveBeenCalledWith(ID_TEST);
            expect(component.showCharacterForm).toBeTrue();
            expect(component.errorMessage).toBe('');
        });
        it('should show error and reset gameAccessCode on failed game ID check', () => {
            socketServiceMock.checkGameId.and.returnValue(throwError(() => 'Invalid code'));
            component.gameAccessCode = ID_TEST;
            component.joinGame();
            expect(socketServiceMock.checkGameId).toHaveBeenCalledWith(ID_TEST);
            expect(component.showCharacterForm).toBeFalse();
            expect(component.errorMessage).toBe('Invalid code');
            expect(component.gameAccessCode).toBe('');
        });
    });

    describe('submitCharacterForm()', () => {
        it('should send player data and navigate to waiting room on success', () => {
            gameServiceMock.joinGame.and.returnValue(of(MOCK_JOIN_RESPONSE));
            component.gameAccessCode = ID_TEST;

            component.submitCharacterForm(MOCK_PLAYER_DATA);

            expect(gameServiceMock.joinGame).toHaveBeenCalledWith(ID_TEST, NAME_TEST, AVATAR_NUM_TEST, {
                def: { value: 6, dice: 4 },
            });

            expect(routerMock.navigate).toHaveBeenCalledWith(['/waiting-room']);
        });
    });

    describe('closeCharacterForm()', () => {
        it('should hide character form and reset gameAccessCode', () => {
            component.showCharacterForm = true;
            component.gameAccessCode = ID_TEST;
            component.closeCharacterForm();
            expect(component.showCharacterForm).toBeFalse();
            expect(component.gameAccessCode).toBe('');
        });
    });
});
