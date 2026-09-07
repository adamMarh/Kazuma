/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, fakeAsync, TestBed, tick } from '@angular/core/testing';
import { ReactiveFormsModule } from '@angular/forms';
import { By } from '@angular/platform-browser';
import { Router } from '@angular/router';
import {
    ADDITIONAL_LENGTH,
    ATK,
    DEF,
    DEFAULT_DICE_VALUE,
    HP,
    ID_TEST,
    MAX_NAME_LENGTH,
    MESSAGES,
    NAME_TEST,
    NON_EXISTENT,
    SELECTED_DICE_VALUE,
    TEST_NAMES,
    TOOLTIPS,
} from '@app/constants/character-form';
import { CharacterFormService } from '@app/services/character-form/character-form.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { Game } from '@common/interfaces/game.interface';
import { of, Subject, throwError } from 'rxjs';
import { CharacterFormComponent } from './character-form.component';
import SpyObj = jasmine.SpyObj;

describe('CharacterFormComponent', () => {
    let component: CharacterFormComponent;
    let fixture: ComponentFixture<CharacterFormComponent>;
    let mockService: SpyObj<any>;
    let mockRouter: SpyObj<Router>;
    let mockLobbySocket: SpyObj<any>;
    let lobbyUpdateSubject: Subject<Game>;

    beforeEach(async () => {
        mockService = jasmine.createSpyObj('CharacterFormService', [
            'selectAvatar',
            'applyBonus',
            'assignDice',
            'hasIncreasedValue',
            'nameVerification',
            'isBonusApplied',
            'isDiceAssigned',
            'getDiceValue',
            'resetForm',
        ]);
        mockRouter = jasmine.createSpyObj('Router', ['navigate']);
        mockLobbySocket = jasmine.createSpyObj('LobbySocketService', [
            'getGameInstance',
            'onLobbyUpdate',
            'getGameId',
            'deselectAvatar',
            'selectAvatar',
            'onForceLockRoom',
            'updateAvailableAvatars',
            'checkGameId',
            'leavePendingRoom',
        ]);

        mockLobbySocket.updateAvailableAvatars.and.returnValue(of({ success: true }));
        mockLobbySocket.onForceLockRoom.and.returnValue(of({ gameId: ID_TEST, target: 'form' }));

        mockLobbySocket.onForceLockRoom.and.returnValue(of({ gameId: ID_TEST, target: 'form' }));

        mockLobbySocket.getGameInstance.and.returnValue({
            gameId: ID_TEST,
            players: [],
            map: {},
            isLocked: false,
            maxPlayers: 4,
            playerTurns: [],
            currentPlayer: 0,
            startingPoints: [],
            selectedAvatars: { player1: 'avatar1.png' },
        } as unknown as Game);

        mockService.getDiceValue.and.callFake((name: string) => {
            if (name === ATK) return SELECTED_DICE_VALUE;
            if (name === DEF) return DEFAULT_DICE_VALUE;
            return null;
        });

        lobbyUpdateSubject = new Subject<Game>();
        mockLobbySocket.onLobbyUpdate.and.returnValue(lobbyUpdateSubject.asObservable());
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.deselectAvatar.and.returnValue(of({ success: true }));
        mockLobbySocket.selectAvatar.and.returnValue(of({ success: true }));

        await TestBed.configureTestingModule({
            imports: [ReactiveFormsModule, CharacterFormComponent],
            providers: [
                { provide: CharacterFormService, useValue: mockService },
                { provide: Router, useValue: mockRouter },
                { provide: LobbySocketService, useValue: mockLobbySocket },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(CharacterFormComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();

        lobbyUpdateSubject.next({
            gameId: ID_TEST,
            selectedAvatars: { player1: 'avatar1.png' },
        } as unknown as Game);
        fixture.detectChanges();
    });

    function setCharacterName(value: string) {
        component.characterForm.get('characterName')?.setValue(value);
        component.characterForm.get('characterName')?.markAsTouched();
        fixture.detectChanges();
    }

    function updateForm(name: string, avatar: number | null, bonus: boolean, dice: boolean) {
        component.characterForm.patchValue({ characterName: name, selectedAvatar: avatar });
        mockService.isBonusApplied.and.returnValue(bonus);
        mockService.isDiceAssigned.and.returnValue(dice);
        fixture.detectChanges();
    }

    it('should show error popup if gameId is undefined during reconnect', fakeAsync(async () => {
        mockLobbySocket.getGameId.and.returnValue(undefined);

        await component.handleReconnect();
        tick();

        expect(component.errorPopupVisible).toBeTrue();
    }));

    describe('Component Initialization', () => {
        it('should create', () => {
            expect(component).toBeTruthy();
        });

        it('should initialize the form with default values', () => {
            expect(component.characterForm.value).toEqual({
                characterName: '',
                selectedAvatar: null,
            });
        });

        it('should set currentGame when getGameInstance returns a game', () => {
            expect(component.currentGame).toEqual(
                jasmine.objectContaining({
                    gameId: ID_TEST,
                    selectedAvatars: { player1: 'avatar1.png' },
                }),
            );
        });

        it('should subscribe to lobby updates and update currentGame', () => {
            expect(mockLobbySocket.onLobbyUpdate).toHaveBeenCalled();
        });

        it('should return the correct attributes from CharacterFormService', () => {
            mockService.attributes = [
                { name: 'hp', value: 10, dice: 6, bonusApplied: false },
                { name: 'atk', value: 5, dice: 4, bonusApplied: false },
            ];
            expect(component.attributes).toEqual(mockService.attributes);
        });
    });

    describe('Form validation and submission', () => {
        it('should mark form as invalid if fields are empty', () => {
            component.characterForm.patchValue({ characterName: '', selectedAvatar: null });
            expect(component.characterForm.valid).toBeFalse();
        });

        it('should mark form as invalid if no avatar is selected', () => {
            component.characterForm.patchValue({ characterName: NAME_TEST, selectedAvatar: null });
            expect(component.characterForm.valid).toBeFalse();
        });

        it('should mark form as valid if all fields are filled', () => {
            component.characterForm.patchValue({ characterName: NAME_TEST, selectedAvatar: 1 });
            expect(component.characterForm.valid).toBeTrue();
        });

        it('should display an error message when the characterName is invalid', () => {
            setCharacterName(TEST_NAMES['short']);
            expect(fixture.debugElement.query(By.css('.error-message')).nativeElement.textContent).toContain(MESSAGES['shortName']);

            setCharacterName(TEST_NAMES['validMax']);
            component.verifyName();
            expect(component.characterForm.get('characterName')?.value.length).toBe(MAX_NAME_LENGTH);

            setCharacterName(TEST_NAMES['overMax']);
            component.verifyName();
            expect(component.characterForm.get('characterName')?.value.length).toBe(MAX_NAME_LENGTH);

            setCharacterName(TEST_NAMES['invalidChars']);
            expect(fixture.debugElement.query(By.css('.error-message')).nativeElement.textContent).toContain(MESSAGES['invalidName']);
        });

        it('should call verifyName and update isNameValid', () => {
            mockService.nameVerification.and.returnValue(true);
            component.characterForm.get('characterName')?.setValue(NAME_TEST);
            component.verifyName();
            expect(mockService.nameVerification).toHaveBeenCalledWith(NAME_TEST.slice(0, MAX_NAME_LENGTH));
        });

        it('should enable the submit button only when all required conditions are met', () => {
            const submitButton: HTMLButtonElement = fixture.debugElement.query(By.css('.btn-form')).nativeElement;

            updateForm('', null, false, false);
            expect(submitButton.disabled).toBeTrue();

            updateForm(NAME_TEST, 1, false, false);
            expect(submitButton.disabled).toBeTrue();

            updateForm(NAME_TEST, 1, true, true);
            expect(submitButton.disabled).toBeFalse();
        });
    });

    describe('Avatar Selection', () => {
        beforeEach(() => {
            (component as any).avatars = [{ image: 'avatar1.png' }, { image: 'avatar2.png' }];
        });

        it('should show an error if the avatar is already selected in currentGame', () => {
            component.currentGame = { selectedAvatars: { player1: 1 } } as any;
            component.selectAvatar(1);
            expect(component.avatarErrorMessage).toBe('');
        });

        it('should patch form and select avatar if no gameId exists', () => {
            const index = 1;
            (component as any).avatars = [{ image: 'avatar1.png' }, { image: 'avatar2.png' }];
            mockLobbySocket.getGameId.and.returnValue(null);
            const patchSpy = spyOn(component.characterForm, 'patchValue').and.callThrough();

            component.selectAvatar(index);

            expect(patchSpy).toHaveBeenCalledWith({ selectedAvatar: index });
            expect(mockService.selectAvatar).toHaveBeenCalledWith(index);
        });

        it('should do nothing if index is out-of-range', () => {
            const spyPatch = spyOn(component.characterForm, 'patchValue');
            component.selectAvatar(1000);
            expect(spyPatch).not.toHaveBeenCalled();
        });

        it('should select avatar if gameId exists and response is successful', fakeAsync(() => {
            mockLobbySocket.getGameId.and.returnValue(ID_TEST);
            component.currentAvatar = null;
            const spyPatch = spyOn(component.characterForm, 'patchValue').and.callThrough();
            mockLobbySocket.selectAvatar.and.returnValue(of({ success: true }));

            component.selectAvatar(1);
            tick();

            expect(component.currentAvatar as any).toEqual(1);
            expect(spyPatch).toHaveBeenCalledWith({ selectedAvatar: 1 });
            expect(mockService.selectAvatar).toHaveBeenCalledWith(1);
        }));

        it('should deselect avatar, reset currentAvatar and patch form when currentAvatar is set', fakeAsync(() => {
            component.currentAvatar = 2;
            (component as any).avatars = [{ image: 'avatar1.png' }, { image: 'avatar2.png' }];
            mockLobbySocket.getGameId.and.returnValue(ID_TEST);
            mockLobbySocket.deselectAvatar.and.returnValue(of({ success: true }));
            mockLobbySocket.selectAvatar.and.returnValue(of({ success: true }));
            const patchSpy = spyOn(component.characterForm, 'patchValue').and.callThrough();
            component.selectAvatar(1);
            tick();
            expect(mockLobbySocket.deselectAvatar).toHaveBeenCalledWith(ID_TEST);
            expect(component.currentAvatar).toBe(1);
            expect(patchSpy).toHaveBeenCalledWith({ selectedAvatar: null });
            expect(patchSpy).toHaveBeenCalledWith({ selectedAvatar: 1 });
            expect(mockService.selectAvatar).toHaveBeenCalledWith(null);
            expect(mockService.selectAvatar).toHaveBeenCalledWith(1);
        }));

        it('should patch selectedAvatar to null after deselectAvatar completes', fakeAsync(() => {
            component.currentAvatar = 1;
            mockLobbySocket.getGameId.and.returnValue(ID_TEST);
            mockLobbySocket.deselectAvatar.and.returnValue(of({ success: true }));
            mockLobbySocket.selectAvatar.and.returnValue(of({ success: true }));

            const patchSpy = spyOn(component.characterForm, 'patchValue').and.callThrough();

            component.selectAvatar(1);
            tick();

            expect(patchSpy).toHaveBeenCalledWith({ selectedAvatar: null });
        }));

        it('should set error message and reset selectedAvatar if avatar selection fails', fakeAsync(() => {
            (component as any).avatars = [{ image: 'avatar1.png' }];
            mockLobbySocket.getGameId.and.returnValue(ID_TEST);
            mockLobbySocket.selectAvatar.and.returnValue(of({ success: false }));

            const patchSpy = spyOn(component.characterForm, 'patchValue').and.callThrough();
            component.selectAvatar(1);
            tick();
            expect(component.avatarErrorMessage).toBe("Cet avatar n'est pas disponible.");
            expect(patchSpy).toHaveBeenCalledWith({ selectedAvatar: null });

            tick(5000);
            expect(component.avatarErrorMessage).toBe('');
        }));

        it('should handle handleAvatarClick without selecting if avatar is unavailable', () => {
            spyOn(component, 'selectAvatar');
            spyOnProperty(component, 'unavailableAvatars', 'get').and.returnValue([1]);
            component.handleAvatarClick(1);
            expect(component.selectAvatar).not.toHaveBeenCalled();
        });

        it('should handle handleAvatarClick and call selectAvatar if avatar is available', () => {
            spyOn(component, 'selectAvatar');
            spyOnProperty(component, 'unavailableAvatars', 'get').and.returnValue([]);
            component.handleAvatarClick(2);
            expect(component.selectAvatar).toHaveBeenCalledWith(2);
        });

        it('should deselect avatar on form close if reservedAvatar exists', () => {
            component.currentAvatar = 1;
            mockLobbySocket.getGameId.and.returnValue(ID_TEST);
            spyOn(component.closeForm, 'emit');
            component.closeCharacterForm();
            expect(mockLobbySocket.deselectAvatar).toHaveBeenCalledWith(ID_TEST);
            expect(component.currentAvatar).toBeNull();
            expect(component.characterFormService.resetForm).toHaveBeenCalled();
            expect(component.closeForm.emit).toHaveBeenCalled();
        });

        it('should close form even if no gameId is returned', () => {
            mockLobbySocket.getGameId.and.returnValue(null);
            spyOn(component.closeForm, 'emit');
            component.closeCharacterForm();
            expect(mockLobbySocket.deselectAvatar).not.toHaveBeenCalled();
            expect(component.characterFormService.resetForm).toHaveBeenCalled();
            expect(component.closeForm.emit).toHaveBeenCalled();
        });
    });

    describe('Dice Getters', () => {
        it('should return the correct dice value for attaque and défense', () => {
            expect(component.attackDice).toBe(SELECTED_DICE_VALUE);
            expect(component.defenseDice).toBe(DEFAULT_DICE_VALUE);
        });

        it('should return null if no dice is assigned', () => {
            mockService.getDiceValue.and.returnValue(null);
            expect(component.attackDice).toBeNull();
            expect(mockService.getDiceValue).toHaveBeenCalledWith(ATK);
        });
    });

    describe('Bonus and dice selection', () => {
        it('should call hasIncreasedValue and return its value', () => {
            mockService.hasIncreasedValue.and.returnValue(true);
            const result = component.hasIncreasedValue(HP);
            expect(mockService.hasIncreasedValue).toHaveBeenCalledWith(HP);
            expect(result).toBeTrue();
        });

        it('should assign bonus correctly', () => {
            component.applyBonus(HP);
            expect(mockService.applyBonus).toHaveBeenCalledWith(HP);
        });

        it('should assign dice correctly', () => {
            component.assignDice(DEF);
            expect(mockService.assignDice).toHaveBeenCalledWith(DEF);
        });
    });

    describe('Tooltips', () => {
        it('should return the correct tooltip for known attributes', () => {
            const tooltip = component.printTooltip(HP);
            expect(tooltip).toBe(TOOLTIPS[HP] || ' ');
        });

        it('should return an empty string for unknown attributes', () => {
            const tooltip = component.printTooltip(NON_EXISTENT);
            expect(tooltip).toBe(' ');
        });
    });

    describe('Popup behavior : closing and submitting the form', () => {
        it('should display the closing popup when openClosingPopup is called', () => {
            component.openClosingPopup();
            fixture.detectChanges();
            expect(component.showClosingPopup).toBeTrue();
        });

        it('should close the closing popup without closing form when response is false', () => {
            spyOn(component.closeForm, 'emit');
            component.openClosingPopup();
            fixture.detectChanges();
            component.confirmClosingForm(false);
            fixture.detectChanges();
            expect(component.showClosingPopup).toBeFalse();
            expect(component.closeForm.emit).not.toHaveBeenCalled();
        });

        it('should close the closing popup and close the form when response is true', () => {
            spyOn(component.closeForm, 'emit');
            component.openClosingPopup();
            fixture.detectChanges();
            component.confirmClosingForm(true);
            fixture.detectChanges();
            expect(component.showClosingPopup).toBeFalse();
            expect(component.closeForm.emit).toHaveBeenCalled();
        });

        it('should display the sending popup when openSendingPopup is called', () => {
            component.openSendingPopup();
            fixture.detectChanges();
            expect(component.showSendingPopup).toBeTrue();
        });

        it('should close the sending popup without navigation when response is false', () => {
            component.openSendingPopup();
            fixture.detectChanges();
            component.confirmSendingForm(false);
            fixture.detectChanges();
            expect(component.showSendingPopup).toBeFalse();
            expect(mockRouter.navigate).not.toHaveBeenCalled();
        });

        it('should emit characterCreated when confirming sending and form is valid', () => {
            spyOn(component.characterCreated, 'emit');
            mockService.attributes = [
                { name: 'hp', value: 5, dice: 6, bonusApplied: false },
                { name: 'atk', value: 4, dice: 4, bonusApplied: false },
            ];
            component.characterForm.patchValue({
                characterName: NAME_TEST,
                selectedAvatar: 1,
            });
            component.confirmSendingForm(true);
            expect(component.characterCreated.emit).toHaveBeenCalledWith({
                name: NAME_TEST,
                avatar: 1,
                attributes: [
                    { name: 'hp', value: 5, dice: 6 },
                    { name: 'atk', value: 4, dice: 4 },
                ],
            });
        });

        it('should not emit characterCreated if required form fields or attributes are missing', () => {
            spyOn(component.characterCreated, 'emit');
            component.characterForm.patchValue({
                characterName: '',
                selectedAvatar: 1,
            });
            component.confirmSendingForm(true);
            expect(component.characterCreated.emit).not.toHaveBeenCalled();
            component.characterForm.patchValue({
                characterName: NAME_TEST,
                selectedAvatar: null,
            });
            component.confirmSendingForm(true);
            expect(component.characterCreated.emit).not.toHaveBeenCalled();
            component.characterForm.patchValue({
                characterName: NAME_TEST,
                selectedAvatar: 1,
            });
            mockService.attributes = [];
            component.confirmSendingForm(true);
            expect(component.characterCreated.emit).not.toHaveBeenCalled();
        });
    });

    describe('verifyName', () => {
        it('should trim the name to MAX_NAME_LENGTH and update isNameValid when control has a value', () => {
            mockService.nameVerification.and.returnValue(false);
            component.characterForm.get('characterName')?.setValue('a'.repeat(MAX_NAME_LENGTH + ADDITIONAL_LENGTH));
            component.verifyName();
            expect(component.characterForm.get('characterName')?.value.length).toBe(MAX_NAME_LENGTH);
            expect(component.isNameValid).toBeFalse();
        });

        it('should do nothing if there is no value in the characterName control', () => {
            component.characterForm.get('characterName')?.setValue('');
            const previous = component.isNameValid;
            component.verifyName();
            expect(component.isNameValid).toBe(previous);
        });
    });

    describe('Getter: unavailableAvatarImages', () => {
        it('should return an empty array if currentGame is null', () => {
            component.currentGame = null;
            expect(component.unavailableAvatars).toEqual([]);
        });

        it('should return an empty array if currentGame.selectedAvatars is undefined', () => {
            component.currentGame = { ...mockLobbySocket.getGameInstance(), selectedAvatars: undefined };
            expect(component.unavailableAvatars).toEqual([]);
        });

        it('should return the array of values if currentGame.selectedAvatars exists', () => {
            component.currentGame = { ...mockLobbySocket.getGameInstance(), selectedAvatars: { p1: 1, p2: 2 } };
            expect(component.unavailableAvatars).toEqual([1, 2]);
        });
    });

    describe('confirmSendingForm (dice mapping)', () => {
        it('should emit characterCreated with dice property set to null if attr.dice is falsy', () => {
            spyOn(component.characterCreated, 'emit');
            mockService.attributes = [
                { name: 'hp', value: 5, dice: undefined, bonusApplied: false },
                { name: 'atk', value: 4, dice: 4, bonusApplied: false },
            ];
            component.characterForm.patchValue({ characterName: NAME_TEST, selectedAvatar: 1 });
            component.confirmSendingForm(true);
            expect(component.characterCreated.emit).toHaveBeenCalledWith({
                name: NAME_TEST,
                avatar: 1,
                attributes: [
                    { name: 'hp', value: 5, dice: null },
                    { name: 'atk', value: 4, dice: 4 },
                ],
            });
        });
    });

    it('should hide error popup and navigate home if errorShouldRedirect is true', () => {
        component.errorPopupVisible = true;
        component.errorShouldRedirect = true;
        spyOn(component.closeForm, 'emit');

        component.handleErrorPopupClosed();

        expect(component.errorPopupVisible).toBeFalse();
        expect(component.closeForm.emit).toHaveBeenCalled();
        expect(mockRouter.navigate).toHaveBeenCalledWith(['/home']);
    });

    it('should only hide error popup if errorShouldRedirect is false', () => {
        component.errorPopupVisible = true;
        component.errorShouldRedirect = false;
        spyOn(component.closeForm, 'emit');

        component.handleErrorPopupClosed();

        expect(component.errorPopupVisible).toBeFalse();
        expect(component.closeForm.emit).not.toHaveBeenCalled();
        expect(mockRouter.navigate).not.toHaveBeenCalled();
    });

    it('should show an error popup if the game is locked during reconnection', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(of({ isLocked: true }));

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('La salle est toujours verrouillée.');
        expect(component.errorPopupVisible).toBeTrue();
    }));

    it('should clear error popup if game is not locked and deselect avatar', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(of({ isLocked: false }));
        mockLobbySocket.deselectAvatar.and.returnValue(of({ success: true }));
        component.currentAvatar = 1;

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('');
        expect(component.errorPopupVisible).toBeFalse();
        expect(mockLobbySocket.deselectAvatar).toHaveBeenCalledWith(ID_TEST);
        expect(component.currentAvatar).toBeNull();
    }));

    it('should show an error popup if checkGameId fails', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(throwError(() => new Error('Erreur test')));

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('Erreur lors de la vérification de la salle.');
        expect(component.errorPopupVisible).toBeTrue();
    }));

    it('should show an error popup if checkGameId fails', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(throwError(() => new Error('Erreur test')));

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('Erreur lors de la vérification de la salle.');
        expect(component.errorPopupVisible).toBeTrue();
    }));

    it('should show an error popup if the game is locked during reconnection', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(of({ isLocked: true }));

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('La salle est toujours verrouillée.');
        expect(component.errorPopupVisible).toBeTrue();
    }));

    it('should clear error popup if game is not locked and deselect avatar', fakeAsync(() => {
        mockLobbySocket.getGameId.and.returnValue(ID_TEST);
        mockLobbySocket.checkGameId.and.returnValue(of({ isLocked: false }));
        mockLobbySocket.deselectAvatar.and.returnValue(of({ success: true }));

        component.currentAvatar = 1;

        component.handleReconnect();
        tick();

        expect(component.errorPopupMessage).toBe('');
        expect(component.errorPopupVisible).toBeFalse();
        expect(mockLobbySocket.deselectAvatar).toHaveBeenCalledWith(ID_TEST);
        expect(component.currentAvatar).toBeNull();
    }));

    describe('ngOnDestroy', () => {
        it('should unsubscribe all subscriptions and clear the subscriptions array', () => {
            const sub = jasmine.createSpyObj('Subscription', ['unsubscribe']);
            (component as any).subscriptions = [sub];
            component.ngOnDestroy();
            expect(sub.unsubscribe).toHaveBeenCalled();
            expect((component as any).subscriptions.length).toBe(0);
        });
    });
});
