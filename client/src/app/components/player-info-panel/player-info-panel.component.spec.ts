import { ComponentFixture, TestBed } from '@angular/core/testing';
import { MAX_HEALTH_PTS, MOCK_PLAYER, NULL_HEALTH_PTS } from '@app/constants/player';
import { PlayerInfoPanelComponent } from './player-info-panel.component';

describe('PlayerInfoPanelComponent', () => {
    let component: PlayerInfoPanelComponent;
    let fixture: ComponentFixture<PlayerInfoPanelComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PlayerInfoPanelComponent],
        }).compileComponents();

        fixture = TestBed.createComponent(PlayerInfoPanelComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    it('should return player healthpoints if player exists', () => {
        component.player = MOCK_PLAYER;
        fixture.detectChanges();
        expect(component.maxHealthpoints).toBe(MAX_HEALTH_PTS);
    });

    it('should return 0 if player is null', () => {
        component.player = null;
        fixture.detectChanges();
        expect(component.maxHealthpoints).toBe(NULL_HEALTH_PTS);
    });
    it('should set atkDiceType and defDiceType based on player dice values', () => {
        component.player = {
            ...MOCK_PLAYER,
            dice: { atk: 6, def: 4 },
        };

        (component as any).setupDiceType();

        expect(component['atkDiceType']).toBe('D6');
        expect(component['defDiceType']).toBe('D4');
    });

    it('should fallback to D4 if atk or def dice is not 6', () => {
        component.player = {
            ...MOCK_PLAYER,
            dice: { atk: 4, def: 4 },
        };

        (component as any).setupDiceType();

        expect(component['atkDiceType']).toBe('D4');
        expect(component['defDiceType']).toBe('D4');
    });

    it('should set defDiceType to D4 when def dice is not 6', () => {
        component.player = {
            ...MOCK_PLAYER,
            dice: { atk: 6, def: 4 },
        };

        (component as any).setupDiceType();

        expect(component['atkDiceType']).toBe('D6');
        expect(component['defDiceType']).toBe('D4');
    });
    it('should set defDiceType to D6 when def dice is 6', () => {
        component.player = {
            ...MOCK_PLAYER,
            dice: { atk: 4, def: 6 },
        };

        (component as any).setupDiceType();

        expect(component['atkDiceType']).toBe('D4');
        expect(component['defDiceType']).toBe('D6');
    });
});
