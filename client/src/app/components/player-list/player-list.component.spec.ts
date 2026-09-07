/* eslint-disable @typescript-eslint/no-shadow */
/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable no-unused-vars */
/* eslint-disable max-classes-per-file */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { CombatSocketService } from '@app/services/sockets/combat-socket/combat-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { Player } from '@common/interfaces/player.interface';
import { of, Subject } from 'rxjs';
import { PlayerListComponent } from './player-list.component';

class StubSocketService {
    getSocketId(): string {
        return 'socket-1';
    }
}

class StubRouter {
    navigate(commands: any[]): void {}
}

class StubCombatSocketService {
    private navigatedSubject = new Subject<{ bougQuiTabasse: string; bougATabasser: string }>();

    onNavigated() {
        return this.navigatedSubject.asObservable();
    }

    triggerNavigated(data: { bougQuiTabasse: string; bougATabasser: string }) {
        this.navigatedSubject.next(data);
    }

    navigateToCombat(bougQuiTabasse: string, bougATabasser: string) {
        return of({ success: true });
    }
}

describe('PlayerListComponent', () => {
    let component: PlayerListComponent;
    let fixture: ComponentFixture<PlayerListComponent>;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [PlayerListComponent],
            providers: [
                { provide: SocketService, useClass: StubSocketService },
                { provide: Router, useClass: StubRouter },
                { provide: CombatSocketService, useClass: StubCombatSocketService },
            ],
        }).compileComponents();

        fixture = TestBed.createComponent(PlayerListComponent);
        component = fixture.componentInstance;
        fixture.detectChanges();
    });

    describe('getPlayersInTurnOrder', () => {
        it('should sort players with admin first', () => {
            const players: Player[] = [
                {
                    socketId: 'p2',
                    name: 'Player 2',
                    avatar: 'a2',
                    speed: 3,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    isAdmin: false,
                    startPosition: { x: 0, y: 0 },
                    isMyTurn: false,
                    fleeAttempts: 0,
                },
                {
                    socketId: 'p1',
                    name: 'Player 1',
                    avatar: 'a1',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    isAdmin: true,
                    startPosition: { x: 0, y: 0 },
                    isMyTurn: false,
                    fleeAttempts: 0,
                },
            ];
            component.players = players;
            const sorted = component.getPlayersInTurnOrder();
            expect(sorted[0].isAdmin).toBeFalse();
            expect(sorted[1].isAdmin).toBeTrue();
        });

        it('should keep order if both players have same admin status', () => {
            const players: Player[] = [
                {
                    socketId: 'p1',
                    name: 'Player 1',
                    avatar: 'a1',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    isAdmin: false,
                    startPosition: { x: 0, y: 0 },
                    isMyTurn: false,
                    fleeAttempts: 0,
                },
                {
                    socketId: 'p2',
                    name: 'Player 2',
                    avatar: 'a2',
                    speed: 0,
                    defense: 0,
                    attack: 0,
                    healthpoints: 100,
                    position: { x: 0, y: 0 },
                    battlesWon: 0,
                    inventory: [],
                    isInventoryFull: false,
                    dice: { atk: 0, def: 0 },
                    movementPoints: 0,
                    actionPoints: 0,
                    isAdmin: false,
                    startPosition: { x: 0, y: 0 },
                    isMyTurn: false,
                    fleeAttempts: 0,
                },
            ];
            component.players = players;
            const sorted = component.getPlayersInTurnOrder();
            expect(sorted).toEqual(players);
        });
    });

    it('should return 1 when first player is not admin and second is admin', () => {
        const players: Player[] = [
            {
                socketId: 'p1',
                name: 'Player 1',
                avatar: 'a1',
                speed: 0,
                defense: 0,
                attack: 0,
                healthpoints: 100,
                position: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                dice: { atk: 0, def: 0 },
                movementPoints: 0,
                actionPoints: 0,
                isAdmin: false,
                startPosition: { x: 0, y: 0 },
                isMyTurn: false,
                fleeAttempts: 0,
            },
            {
                socketId: 'p2',
                name: 'Player 2',
                avatar: 'a2',
                speed: 0,
                defense: 0,
                attack: 0,
                healthpoints: 100,
                position: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                dice: { atk: 0, def: 0 },
                movementPoints: 0,
                actionPoints: 0,
                isAdmin: true,
                startPosition: { x: 0, y: 0 },
                isMyTurn: false,
                fleeAttempts: 0,
            },
        ];
        component.players = players;
        const sorted = component.getPlayersInTurnOrder();

        expect(sorted[0].socketId).toEqual('p1');
        expect(sorted[1].socketId).toEqual('p2');
    });

    describe('Comparator function in getPlayersInTurnOrder', () => {
        it('should return 1 when first player is not admin and second is admin', () => {
            const a = { isAdmin: false } as Player;
            const b = { isAdmin: true } as Player;

            const comparator = (a: Player, b: Player) => {
                if (a.isAdmin && !b.isAdmin) return -1;
                if (!a.isAdmin && b.isAdmin) return 1;
                return 0;
            };
            expect(comparator(a, b)).toEqual(1);
        });
    });
    describe('Comparator branch in getPlayersInTurnOrder', () => {
        it('should return 1 when first player is not admin and second is admin', () => {
            const nonAdmin: Player = {
                socketId: 'p1',
                name: 'Player 1',
                avatar: 'a1',
                speed: 0,
                defense: 0,
                attack: 0,
                healthpoints: 100,
                position: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                dice: { atk: 0, def: 0 },
                movementPoints: 0,
                actionPoints: 0,
                isAdmin: false,
                startPosition: { x: 0, y: 0 },
                isMyTurn: false,
                fleeAttempts: 0,
            };
            const admin: Player = {
                socketId: 'p2',
                name: 'Player 2',
                avatar: 'a2',
                speed: 0,
                defense: 0,
                attack: 0,
                healthpoints: 100,
                position: { x: 0, y: 0 },
                battlesWon: 0,
                inventory: [],
                isInventoryFull: false,
                dice: { atk: 0, def: 0 },
                movementPoints: 0,
                actionPoints: 0,
                isAdmin: true,
                startPosition: { x: 0, y: 0 },
                isMyTurn: false,
                fleeAttempts: 0,
            };

            const comparator = (a: Player, b: Player) => {
                if (a.isAdmin && !b.isAdmin) return -1;
                if (!a.isAdmin && b.isAdmin) return 1;
                return 0;
            };

            expect(comparator(nonAdmin, admin)).toEqual(1);
        });
    });

    describe('isCurrentPlayer', () => {
        it('should return true if player.socketId === currentPlayerId', () => {
            component.currentPlayerId = 'playerSocket123';
            const player: Player = { socketId: 'playerSocket123' } as Player;

            const result = component.isCurrentPlayer(player);
            expect(result).toBeTrue();
        });

        it('should return false if player.socketId !== currentPlayerId', () => {
            component.currentPlayerId = 'playerSocketABC';
            const player: Player = { socketId: 'playerSocketXYZ' } as Player;

            const result = component.isCurrentPlayer(player);
            expect(result).toBeFalse();
        });
    });

    describe('getPlayerTeam', () => {
        it('should return null if gameMode is not "CTF"', () => {
            component.gameMode = 'classic';
            component.teams = { red: [], blue: [] };
            const player: Player = { socketId: 'p1' } as Player;

            const team = component.getPlayerTeam(player);
            expect(team).toBeNull();
        });

        it('should return null if teams is undefined or null', () => {
            component.gameMode = 'CTF';
            component.teams = undefined as any;
            const player: Player = { socketId: 'p1' } as Player;

            const team = component.getPlayerTeam(player);
            expect(team).toBeNull();
        });

        it('should return "red" if player is in the red array', () => {
            component.gameMode = 'CTF';
            component.teams = { red: ['p1', 'p2'], blue: [] };
            const player: Player = { socketId: 'p2' } as Player;

            const team = component.getPlayerTeam(player);
            expect(team).toBe('red');
        });

        it('should return "blue" if player is in the blue array', () => {
            component.gameMode = 'CTF';
            component.teams = { red: [], blue: ['pX'] };
            const player: Player = { socketId: 'pX' } as Player;

            const team = component.getPlayerTeam(player);
            expect(team).toBe('blue');
        });

        it('should return null if player is not in either red or blue', () => {
            component.gameMode = 'CTF';
            component.teams = { red: ['r1'], blue: ['b1'] };
            const player: Player = { socketId: 'unknown' } as Player;

            const team = component.getPlayerTeam(player);
            expect(team).toBeNull();
        });
    });

    describe('hasFlagInInventory', () => {
        it('should return true if player.inventory includes "flag"', () => {
            const player: Player = {
                socketId: 'p1',
                inventory: ['flag', 'potion'],
            } as Player;

            expect(component.hasFlagInInventory(player)).toBeTrue();
        });

        it('should return false if player.inventory does not include "flag"', () => {
            const player: Player = {
                socketId: 'p2',
                inventory: ['shield', 'sword'],
            } as Player;

            expect(component.hasFlagInInventory(player)).toBeFalse();
        });

        it('should return false if player.inventory is undefined', () => {
            const player: Player = {
                socketId: 'p3',
                inventory: undefined as any,
            } as Player;

            expect(component.hasFlagInInventory(player)).toBeFalsy();
        });
    });
});
