import { Map } from "./map.interface";
import { Player } from "./player.interface";

export interface ActionFailure {
  success: false;
  message: string;
}

export interface DoorAction {
  success: true;
  type: 'door';
  updatedMap: Map;
}

export interface CombatAction {
  success: true;
  type: 'combat';
  target: Player;
}

export type ActionResult = ActionFailure | DoorAction | CombatAction;
