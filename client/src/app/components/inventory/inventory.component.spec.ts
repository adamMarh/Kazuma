/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { NO_ERRORS_SCHEMA } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { GameService } from '@app/services/game/game.service';
import { ITEM_SETTINGS, ItemType } from '@common/interfaces/item.interface';
import { Player } from '@common/interfaces/player.interface';
import { of } from 'rxjs';
import { InventoryComponent } from './inventory.component';

describe('InventoryComponent', () => {
    let component: InventoryComponent;
    let fixture: ComponentFixture<InventoryComponent>;
    let gameServiceSpy: jasmine.SpyObj<GameService>;
    let mockPlayer: Player;
    let chooseItemSubject: any;
    let itemEffectAppliedSubject: any;
    let itemEffectRemovedSubject: any;

    beforeEach(async () => {
        chooseItemSubject = of({
            item: {
                position: { x: 1, y: 1 },
                type: 'shield' as ItemType,
            },
        });

        itemEffectAppliedSubject = of({
            playerId: 'player1',
            itemType: 'potion',
            activated: true,
        });

        itemEffectRemovedSubject = of({
            playerId: 'player1',
            itemType: 'hourglass',
        });

        gameServiceSpy = jasmine.createSpyObj('GameService', [
            'onChooseItem',
            'onItemEffectApplied',
            'onItemEffectRemoved',
            'dropItem',
            'onItemDropped',
        ]);

        gameServiceSpy.onChooseItem.and.returnValue(chooseItemSubject);
        gameServiceSpy.onItemEffectApplied.and.returnValue(itemEffectAppliedSubject);
        gameServiceSpy.onItemEffectRemoved.and.returnValue(itemEffectRemovedSubject);
        gameServiceSpy.onItemDropped = jasmine.createSpy().and.returnValue(
            of({
                playerId: 'player1',
                itemType: 'shield',
            }),
        );

        mockPlayer = {
            socketId: 'player1',
            name: 'Player 1',
            inventory: ['shield', 'potion'] as ItemType[],
            isInventoryFull: false,
        } as Player;

        await TestBed.configureTestingModule({
            imports: [InventoryComponent],
            providers: [{ provide: GameService, useValue: gameServiceSpy }],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();

        fixture = TestBed.createComponent(InventoryComponent);
        component = fixture.componentInstance;
        component.player = mockPlayer;
        fixture.detectChanges();
    });

    it('should create the component', () => {
        expect(component).toBeTruthy();
    });

    it('should subscribe to onChooseItem events during initialization', () => {
        expect(gameServiceSpy.onChooseItem).toHaveBeenCalled();
        expect(component.currentEncounteredItemPosition).toEqual({ x: 1, y: 1 });
        expect(component.chooseItemVisible).toBeTrue();
        expect(component.itemsToChoose.length).toBe(3);
    });

    it('should subscribe to onItemEffectApplied events during initialization', fakeAsync(() => {
        component.showPotionMessage = false;
        component.showItemEffectMessage = false;

        component.ngOnDestroy();

        const potionEffect = {
            playerId: 'player1',
            itemType: 'potion',
            activated: true,
        };

        gameServiceSpy.onItemEffectApplied.and.returnValue(of(potionEffect as any));
        gameServiceSpy.onItemDropped.and.returnValue(of({ playerId: 'differentPlayer' }));
        gameServiceSpy.onItemEffectRemoved.and.returnValue(of({ playerId: 'differentPlayer', itemType: 'hourglass' }));

        component.ngOnInit();

        expect(component.showItemEffectMessage).toBeTrue();
        expect(component.itemEffectMessage).toBe('Vous avez obtenu: potion. ' + ITEM_SETTINGS['potion'].description);

        tick(3000);
        expect(component.showItemEffectMessage).toBeFalse();
    }));

    it('should subscribe to onItemEffectRemoved events during initialization', fakeAsync(() => {
        component.showItemEffectMessage = false;

        component.ngOnDestroy();

        const hourglassEffect = {
            playerId: 'player1',
            itemType: 'hourglass',
        };
        gameServiceSpy.onItemEffectRemoved.and.returnValue(of(hourglassEffect as any));
        gameServiceSpy.onItemDropped.and.returnValue(of({ playerId: 'differentPlayer' }));

        component.ngOnInit();

        expect(component.showItemEffectMessage).toBeTrue();
        expect(component.itemEffectMessage).toBe('Vous avez perdu le Sablier: vos PV reviennent à la normale');

        tick(3000);
        expect(component.showItemEffectMessage).toBeFalse();
    }));

    it('should display effect message for hourglass obtained', fakeAsync(() => {
        const hourglassGameServiceSpy = jasmine.createSpyObj('GameService', [
            'onChooseItem',
            'onItemEffectApplied',
            'onItemEffectRemoved',
            'dropItem',
            'onItemDropped',
        ]);

        hourglassGameServiceSpy.onChooseItem.and.returnValue(
            of({
                item: {
                    position: { x: 1, y: 1 },
                    type: 'shield' as ItemType,
                },
            }),
        );

        hourglassGameServiceSpy.onItemEffectApplied.and.returnValue(
            of({
                playerId: 'player1',
                itemType: 'hourglass',
                activated: false,
            }),
        );

        hourglassGameServiceSpy.onItemEffectRemoved.and.returnValue(
            of({
                playerId: 'differentPlayer',
                itemType: 'hourglass',
            }),
        );

        hourglassGameServiceSpy.onItemDropped.and.returnValue(
            of({
                playerId: 'differentPlayer',
            }),
        );

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [InventoryComponent],
            providers: [{ provide: GameService, useValue: hourglassGameServiceSpy }],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();

        const testFixture = TestBed.createComponent(InventoryComponent);
        const testComponent = testFixture.componentInstance;
        testComponent.player = {
            socketId: 'player1',
            name: 'Player 1',
            inventory: [] as ItemType[],
            isInventoryFull: false,
        } as Player;

        testFixture.detectChanges();

        expect(testComponent.itemEffectMessage).toBe('Vous avez obtenu le Sablier: -2 PV tant que vous le possédez!');
        expect(testComponent.showItemEffectMessage).toBeTrue();

        tick(3000);
        expect(testComponent.showItemEffectMessage).toBeFalse();
    }));

    it('should display effect message for automatically unlocked items', fakeAsync(() => {
        const itemTypes = ['shield', 'lance', 'crystal', 'compas'] as ItemType[];

        for (const itemType of itemTypes) {
            const itemGameServiceSpy = jasmine.createSpyObj('GameService', [
                'onChooseItem',
                'onItemEffectApplied',
                'onItemEffectRemoved',
                'dropItem',
                'onItemDropped',
            ]);

            itemGameServiceSpy.onChooseItem.and.returnValue(
                of({
                    item: { position: { x: 1, y: 1 }, type: 'shield' as ItemType },
                }),
            );

            itemGameServiceSpy.onItemEffectApplied.and.returnValue(
                of({
                    playerId: 'player1',
                    itemType,
                    activated: false,
                }),
            );

            itemGameServiceSpy.onItemEffectRemoved.and.returnValue(
                of({
                    playerId: 'differentPlayer',
                    itemType: 'hourglass',
                }),
            );

            itemGameServiceSpy.onItemDropped.and.returnValue(
                of({
                    playerId: 'differentPlayer',
                }),
            );

            TestBed.resetTestingModule();
            TestBed.configureTestingModule({
                imports: [InventoryComponent],
                providers: [{ provide: GameService, useValue: itemGameServiceSpy }],
                schemas: [NO_ERRORS_SCHEMA],
            }).compileComponents();

            const testFixture = TestBed.createComponent(InventoryComponent);
            const testComponent = testFixture.componentInstance;
            testComponent.player = {
                socketId: 'player1',
                name: 'Player 1',
                inventory: [] as ItemType[],
                isInventoryFull: false,
            } as Player;

            testFixture.detectChanges();

            expect(testComponent.itemEffectMessage).toBe(`Vous avez obtenu: ${itemType}. ${ITEM_SETTINGS[itemType].description}`);
            expect(testComponent.showItemEffectMessage).toBeTrue();

            tick(3000);
            expect(testComponent.showItemEffectMessage).toBeFalse();
        }
    }));

    it('should not display message if player ID does not match', () => {
        const noMatchGameServiceSpy = jasmine.createSpyObj('GameService', [
            'onChooseItem',
            'onItemEffectApplied',
            'onItemEffectRemoved',
            'dropItem',
            'onItemDropped',
        ]);

        noMatchGameServiceSpy.onChooseItem.and.returnValue(of({}));
        noMatchGameServiceSpy.onItemEffectApplied.and.returnValue(
            of({
                playerId: 'anotherPlayer',
                itemType: 'potion',
                activated: true,
            }),
        );
        noMatchGameServiceSpy.onItemEffectRemoved.and.returnValue(
            of({
                playerId: 'anotherPlayer',
                itemType: 'hourglass',
            }),
        );
        noMatchGameServiceSpy.onItemDropped.and.returnValue(
            of({
                playerId: 'anotherPlayer',
            }),
        );

        TestBed.resetTestingModule();
        TestBed.configureTestingModule({
            imports: [InventoryComponent],
            providers: [{ provide: GameService, useValue: noMatchGameServiceSpy }],
            schemas: [NO_ERRORS_SCHEMA],
        }).compileComponents();

        const testFixture = TestBed.createComponent(InventoryComponent);
        const testComponent = testFixture.componentInstance;
        testComponent.player = {
            socketId: 'player1',
            name: 'Player 1',
            inventory: [] as ItemType[],
            isInventoryFull: false,
        } as Player;

        testFixture.detectChanges();

        expect(testComponent.showPotionMessage).toBeFalse();
        expect(testComponent.showItemEffectMessage).toBeFalse();
    });

    it('should reset state after dropping an item', () => {
        component.dropItem('shield');

        expect(gameServiceSpy.dropItem).toHaveBeenCalledWith({
            position: { x: 1, y: 1 },
            type: 'shield',
        });
        expect(component.itemsToChoose).toEqual([]);
        expect(component.currentEncounteredItemPosition).toBeNull();
        expect(component.chooseItemVisible).toBeFalse();
        expect(component.currentTooltip).toBeNull();
    });

    it('should not call dropItem if currentEncounteredItemPosition is null', () => {
        component.currentEncounteredItemPosition = null;
        component.dropItem('shield');
        expect(gameServiceSpy.dropItem).not.toHaveBeenCalled();
    });

    it('should handle display and hiding of tooltips', () => {
        const item = { type: 'shield', description: 'Description', image: 'image.png' };

        component.showTooltip(item);
        expect(component.currentTooltip).toBe(item);

        component.hideTooltip();
        expect(component.currentTooltip).toBeNull();
    });

    it('should handle display and hiding of item tooltips with mouse event', () => {
        const item: ItemType = 'shield';
        const mockEvent = new MouseEvent('mouseover');
        Object.defineProperty(mockEvent, 'currentTarget', {
            value: {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 100,
                    right: 150,
                    bottom: 150,
                    width: 50,
                    height: 50,
                }),
            },
        });

        component.showItemTooltip(item, mockEvent);
        expect(component.hoveredItem).toBe(item);
        expect(component.tooltipPosition.x).toBeDefined();
        expect(component.tooltipPosition.y).toBeDefined();

        component.hideItemTooltip();
        expect(component.hoveredItem).toBeNull();
    });

    it('should handle display of item tooltips without mouse event', () => {
        const item: ItemType = 'shield';

        component.showItemTooltip(item);
        expect(component.hoveredItem).toBe(item);
        expect(component.tooltipPosition).toEqual({ x: 50, y: -80 });
    });

    it('should handle edge cases of tooltip position', () => {
        const item: ItemType = 'shield';

        const mockLeftEvent = {
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 5,
                    top: 100,
                    right: 55,
                    bottom: 150,
                    width: 50,
                    height: 50,
                }),
            },
        } as unknown as MouseEvent;

        spyOnProperty(window, 'innerWidth').and.returnValue(1000);

        component.showItemTooltip(item, mockLeftEvent);
        expect(component.tooltipPosition.x).toBeGreaterThanOrEqual(5);

        const mockRightEvent = {
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 900,
                    top: 100,
                    right: 950,
                    bottom: 150,
                    width: 50,
                    height: 50,
                }),
            },
        } as unknown as MouseEvent;

        component.showItemTooltip(item, mockRightEvent);
        expect(component.tooltipPosition.x).toBeLessThan(900);

        const mockTopEvent = {
            currentTarget: {
                getBoundingClientRect: () => ({
                    left: 100,
                    top: 5,
                    right: 150,
                    bottom: 55,
                    width: 50,
                    height: 50,
                }),
            },
        } as unknown as MouseEvent;

        component.showItemTooltip(item, mockTopEvent);
        expect(component.tooltipPosition.y).toBeGreaterThan(-80);
    });

    it('should unsubscribe on destruction', () => {
        spyOn(component['subscriptions'][0], 'unsubscribe');
        spyOn(component['subscriptions'][1], 'unsubscribe');
        spyOn(component['subscriptions'][2], 'unsubscribe');

        component.ngOnDestroy();

        expect(component['subscriptions'][0].unsubscribe).toHaveBeenCalled();
        expect(component['subscriptions'][1].unsubscribe).toHaveBeenCalled();
        expect(component['subscriptions'][2].unsubscribe).toHaveBeenCalled();
    });

    it('should hide itemEffectMessage after 3s when the player drops an item', fakeAsync(() => {
        gameServiceSpy.onItemDropped.and.returnValue(of({ playerId: 'player1' }));

        component.ngOnDestroy();
        component.ngOnInit();
        expect(component.showItemEffectMessage).toBeTrue();
        expect(component.itemEffectMessage).toBe('Vous êtes mort! Vous avez perdu tous vos items.');
        tick(3000);
        expect(component.showItemEffectMessage).toBeFalse();
    }));
});
