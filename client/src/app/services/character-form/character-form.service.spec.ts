import { TestBed } from '@angular/core/testing';
import { CharacterFormService } from './character-form.service';
import { FormAttributes } from '@app/interfaces/form-attributes';
import {
    ATTRIBUTE_VALUE,
    ATTRIBUTE_VALUE_ADDED,
    AVATAR_SELECTED,
    SELECTED_DICE_VALUE,
    ATTRIBUTES,
    HP,
    SPD,
    ATK,
    DEF,
    NON_EXISTENT,
} from '@app/constants/character-form';

describe('CharacterFormService', () => {
    let service: CharacterFormService;

    beforeEach(() => {
        TestBed.configureTestingModule({ providers: [CharacterFormService] });
        service = TestBed.inject(CharacterFormService);
        service.attributes = [...ATTRIBUTES];
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('Name Verification', () => {
        it('should return false if name does not match the pattern', () => {
            const result = service.nameVerification('invalid-name!');
            expect(result).toBeFalse();
        });

        it('should return false if name length is less than the minimum', () => {
            const result = service.nameVerification('aBc');
            expect(result).toBeFalse();
        });

        it('should return false if name is longer than the maximum', () => {
            const result = service.nameVerification('characterName123456789');
            expect(result).toBeFalse();
        });

        it('should return true for a valid name', () => {
            const result = service.nameVerification('validName123');
            expect(result).toBeTrue();
        });
    });

    describe('Avatar Selection', () => {
        it('should select an avatar', () => {
            service.selectAvatar(2);
            expect(service.selectedAvatar).toBe(2);
        });

        it('should deselect the same avatar when clicked again', () => {
            service.selectAvatar(2);
            service.selectAvatar(2);
            expect(service.selectedAvatar).toBeNull();
        });

        it('should update the selection of a different avatar', () => {
            service.selectAvatar(2);
            service.selectAvatar(AVATAR_SELECTED);
            expect(service.selectedAvatar).toBe(AVATAR_SELECTED);
        });
    });

    describe('Value added Check and attribute changement', () => {
        it('should return true if attribute value is greater than original value', () => {
            const hp = service.attributes.find((attr) => attr.name === HP);
            expect(hp).toBeDefined();
            if (hp) {
                hp.value = ATTRIBUTE_VALUE_ADDED;
                const result = service.hasIncreasedValue(HP);
                expect(result).toBeTrue();
            }
        });

        it('should return false if attribute value is equal to original value', () => {
            const result = service.hasIncreasedValue(SPD);
            expect(result).toBeFalse();
        });

        it('should return false if attribute does not exist', () => {
            const result = service.hasIncreasedValue(NON_EXISTENT);
            expect(result).toBeFalse();
        });

        it('should return false if attribute value is less than original value', () => {
            const attack = service.attributes.find((attr) => attr.name === ATK);
            expect(attack).toBeDefined();
            if (attack) {
                attack.value = 2;
                const result = service.hasIncreasedValue(ATK);
                expect(result).toBeFalse();
            }
        });

        it('should reset and update the attribute when newAttribute is different', () => {
            service.currentAttribute = HP;
            const previousAttribute: FormAttributes | null = service.attributes.find((attr) => attr.name === HP) || null;

            if (previousAttribute) {
                previousAttribute.value = ATTRIBUTE_VALUE_ADDED;
                previousAttribute.bonusApplied = true;
            }
            service.switchAttribute(SPD);
            expect(previousAttribute?.value).toBe(ATTRIBUTE_VALUE);
            expect(previousAttribute?.bonusApplied).toBeFalse();
            expect(service.currentAttribute).toBe(SPD);
        });

        it('should return null when newAttribute is the same as currentAttribute', () => {
            service.currentAttribute = HP;
            service.switchAttribute(HP);
            expect(service.currentAttribute).toBe(HP);
        });
    });

    describe('Bonus assignment', () => {
        it('should return true if bonus is applied to the attribute', () => {
            service.applyBonus(HP);
            const result = service.isBonusApplied(HP);
            expect(result).toBeTrue();
        });

        it('should return false if no bonus is applied to the attribute', () => {
            const result = service.isBonusApplied(SPD);
            expect(result).toBeFalse();
        });

        it('should return false for a non-existent attribute', () => {
            const result = service.isBonusApplied('inexistant');
            expect(result).toBeFalse();
        });

        it('should remove the bonus from the previous attribute when a new bonus is assigned', () => {
            service.applyBonus(HP);
            service.applyBonus(SPD);
            const hp = service.attributes.find((attr) => attr.name === HP);
            const rapidité = service.attributes.find((attr) => attr.name === SPD);
            expect(hp?.value).toBe(ATTRIBUTE_VALUE);
            expect(hp?.bonusApplied).toBeFalse();
            expect(rapidité?.value).toBe(ATTRIBUTE_VALUE_ADDED);
            expect(rapidité?.bonusApplied).toBeTrue();
        });
    });

    describe('Dice assignment', () => {
        it('should return true if selectedAttribute is either "attaque" or "défense"', () => {
            service.assignDice(ATK);
            expect(service.isDiceAssigned()).toBeTrue();

            service.assignDice(DEF);
            expect(service.isDiceAssigned()).toBeTrue();
        });

        it('should return false if no dice is selected', () => {
            service.selectedAttribute = null;
            const result = service.isDiceAssigned();
            expect(result).toBeFalse();
        });

        it('should call getDiceValue for specific attribute dice', () => {
            service.assignDice(DEF);
            const spy = spyOn(service, 'getDiceValue').and.callThrough();
            const diceValue = service.getDiceValue(DEF);

            expect(spy).toHaveBeenCalledWith(DEF);
            expect(diceValue).toBe(SELECTED_DICE_VALUE);
        });

        it('should return null for a non-existent attribute', () => {
            const diceValue = service.getDiceValue('inexistant');
            expect(diceValue).toBeNull();
        });
    });

    describe('Form Reset', () => {
        it('should reset all attributes to their initial values', () => {
            service.applyBonus(HP);
            service.assignDice(ATK);
            service.resetForm();
            const hp = service.attributes.find((attr) => attr.name === HP);
            const attack = service.attributes.find((attr) => attr.name === ATK);
            expect(hp?.value).toBe(ATTRIBUTE_VALUE);
            expect(hp?.bonusApplied).toBeFalse();
            expect(attack?.dice).toBeNull();
            expect(service.selectedAttribute).toBeNull();
            expect(service.selectedAvatar).toBeNull();
        });
    });
});
