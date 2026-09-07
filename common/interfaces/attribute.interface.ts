export interface AttributeInput {
  name: string;
  value: number;
  dice: number | null;
}

export interface Attribute {
  value: number;
  dice: number | null;
}

export interface PlayerAttributes {
  spd: Attribute;
  atk: Attribute;
  def: Attribute;
  hp: Attribute;
}