import { Injectable } from '@angular/core';
import { ATK, ATTRIBUTES, BONUS_VALUE, DEF, DEFAULT_DICE_VALUE, INITIAL_ATTRIBUTES, SELECTED_DICE_VALUE } from '@app/constants/character-form';
import { FormAttributes } from '@app/interfaces/form-attributes';

@Injectable({
    providedIn: 'root',
})
export class CharacterFormService {
    attributes: FormAttributes[] = [...ATTRIBUTES];
    initialAttributes: { [key: string]: { value: number; dice: number | null } } = { ...INITIAL_ATTRIBUTES };
    selectedAttribute: string | null = null;
    currentAttribute: string | null = null;
    selectedAvatar: number | null = null;
    playerName: string = '';

    constructor() {
        this.resetForm();
    }

    getDiceValue(name: string): number | null {
        return this.attributes.find((attr) => attr.name === name)?.dice ?? null;
    }

    selectAvatar(index: number | null): void {
        this.selectedAvatar = this.selectedAvatar === index ? null : index;
    }

    switchAttribute(newAttribute: string): void {
        if (this.currentAttribute === newAttribute) return;
        const previousAttribute = this.attributes.find((attr) => attr.name === this.currentAttribute);
        if (previousAttribute) {
            previousAttribute.value -= BONUS_VALUE;
            previousAttribute.bonusApplied = false;
        }
        this.currentAttribute = newAttribute;
    }

    applyBonus(type: string): void {
        this.switchAttribute(type);
        const currentAttribute = this.attributes.find((attr) => attr.name === type);
        if (currentAttribute && !currentAttribute.bonusApplied) {
            currentAttribute.value += BONUS_VALUE;
            currentAttribute.bonusApplied = true;
        }
    }

    assignDice(attributeName: 'atk' | 'def'): void {
        this.attributes.forEach((attr) => {
            if (attr.name === attributeName) {
                attr.dice = SELECTED_DICE_VALUE;
            } else if (attr.name === (attributeName === ATK ? DEF : ATK)) {
                attr.dice = DEFAULT_DICE_VALUE;
            }
        });
        this.selectedAttribute = attributeName;
    }

    hasIncreasedValue(attrName: string): boolean {
        const attribute = this.attributes.find((attr) => attr.name === attrName);
        if (!attribute) {
            return false;
        }
        return attribute.value > this.initialAttributes[attrName].value;
    }

    isBonusApplied(type: string): boolean {
        return this.attributes.find((attr) => attr.name === type)?.bonusApplied ?? false;
    }

    isDiceAssigned(): boolean {
        return this.selectedAttribute === ATK || this.selectedAttribute === DEF;
    }

    resetForm(): void {
        this.attributes.forEach((attr) => {
            attr.value = this.initialAttributes[attr.name].value;
            attr.bonusApplied = false;
            attr.dice = null;
        });
        this.selectedAttribute = null;
        this.selectedAvatar = null;
        this.currentAttribute = null;
    }
}
