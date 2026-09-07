/* eslint-disable max-lines */
import { FriendGateway } from '@app/gateways/friend/friend.gateway';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { ChatService } from '@app/services/chatroom/chatroom.service';
import { CombatService } from '@app/services/combat/combat.service';
import { CurrencyService } from '@app/services/currency/currency.service';
import { FriendService } from '@app/services/friend/friend.service';
import { GameService as NewGameService } from '@app/services/game/game.service';
import { LobbyService } from '@app/services/lobby/lobby.service';
import { MovementService } from '@app/services/movement/movement.service';
import { StatsService } from '@app/services/stats/stats.service';
import { StatusService } from '@app/services/status/status.service';
import { TurnService } from '@app/services/turn/turn.service';
import { Attribute } from '@common/interfaces/attribute.interface';
import { Map } from '@common/interfaces/map.interface';
import { REASON } from '@common/socket-constants/game.constants';
import { COMBAT_EVENTS } from '@common/socket-events/combat.events';
import { FRIEND_EVENTS } from '@common/socket-events/friend.events';
import { GAME_EVENTS } from '@common/socket-events/game.events';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import {
    ConnectedSocket,
    MessageBody,
    OnGatewayDisconnect,
    OnGatewayInit,
    SubscribeMessage,
    WebSocketGateway,
    WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';

@WebSocketGateway({ cors: true })
export class LobbyGateway implements OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() server: Server;

    constructor(
        private lobbyService: LobbyService,
        private newGameService: NewGameService,
        private movementService: MovementService,
        private turnService: TurnService,
        private combatService: CombatService,
        private statsService: StatsService,
        private currencyService: CurrencyService,
        private challengeService: ChallengeService,
        private friendService: FriendService,
        private friendGateway: FriendGateway,
        private statusService: StatusService,
        private chatService: ChatService,
    ) {}

    @SubscribeMessage(LOBBY_EVENTS.CREATE_ROOM)
    async handleCreateRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody()
        payload: {
            name: string;
            avatar: number;
            map: Map;
            attributes: Record<string, Attribute>;
            entryFee?: number;
            friendsOnly?: boolean;
            creatorUid?: string;
        },
    ) {
        const existingGame = this.newGameService.getGameByPlayer(client.id);
        if (existingGame) {
            await this.handleQuitGame(client, { gameId: existingGame.gameId, uid: payload.creatorUid });
        }

        const game = this.newGameService.createGame(client.id, payload);

        // Debit entry fee from creator if applicable
        if (game.entryFee && game.entryFee > 0) {
            const result = await this.currencyService.addBalanceByUsername(payload.name, -game.entryFee);
            if (!result) {
                delete this.newGameService.getGames()[game.gameId];
                this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                    errorMessage: 'Solde insuffisant pour créer cette partie.',
                    shouldRedirect: false,
                });
                return;
            }
        }

        client.join(game.gameId);
        const myPlayer = this.newGameService.getPlayer(client.id, game);
        if (myPlayer) {
            myPlayer.hasFlagMusicOption = await this.currencyService.hasOwnedSoundByUsername(payload.name, 'snd_flag_music');
        }
        // Update status to creatingGame
        const creatorUid = this.statusService.getUidBySocketId(client.id);
        if (creatorUid && !this.statusService.isBusy(creatorUid)) {
            this.friendGateway.updateUserStatus(creatorUid, 'creatingGame');
        }
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        return { game, myPlayer };
    }

    @SubscribeMessage(LOBBY_EVENTS.GET_GAMES)
    handleGetGames() {
        const games = this.newGameService.getGames();
        return Object.values(games);
    }

    @SubscribeMessage(LOBBY_EVENTS.CHECK_GAME_ID)
    async handleCheckGameId(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string; joinerUid?: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) {
            return { error: 'Code invalide, veuillez essayer à nouveau.' };
        }
        if (game.isLocked && !game.started) {
            return { error: 'La salle est verrouillée, veuillez essayer à nouveau.' };
        }
        if (!game.dropInActive && game.started) {
            return { error: 'Le drop-in est inactif, veuillez essayer à nouveau.' };
        }
        if (game.ended) {
            return { error: 'La partie est terminée, il est impossible de la rejoindre.' };
        }
        if (game.friendsOnly && game.creatorUid) {
            if (!payload.joinerUid) {
                return { error: 'Cette salle est réservée aux amis du créateur.' };
            }
            const isFriend = await this.friendService.areFriends(game.creatorUid, payload.joinerUid);
            if (!isFriend) {
                return { error: 'Cette salle est réservée aux amis du créateur.' };
            }
        }

        if (payload.joinerUid) {
            const hardBlockedNames: string[] = [];
            const softConflictNames: string[] = [];
            for (const player of game.players.filter((p) => !p.isBot)) {
                const playerUid = this.statusService.getUidBySocketId(player.socketId);
                if (playerUid) {
                    const blockedByPlayer = await this.friendService.isBlocked(playerUid, payload.joinerUid);
                    if (blockedByPlayer) {
                        hardBlockedNames.push(player.name);
                        continue;
                    }
                    const blockerHasBlocked = await this.friendService.isBlocked(payload.joinerUid, playerUid);
                    if (blockerHasBlocked) {
                        softConflictNames.push(player.name);
                    }
                }
            }
            if (hardBlockedNames.length > 0) {
                return { error: 'Un joueur dans cette salle vous a bloqué. Vous ne pouvez pas la rejoindre.' };
            }
            if (softConflictNames.length > 0) {
                client.emit(FRIEND_EVENTS.LOBBY_BLOCK_CONFLICT, {
                    gameId: payload.gameId,
                    conflictUsers: softConflictNames,
                });
                return { blockConflict: true, conflictUsers: softConflictNames };
            }
        }

        client.join(`pending_${payload.gameId}`);
        return { ...game };
    }

    @SubscribeMessage(LOBBY_EVENTS.LEAVE_PENDING)
    handleLeavePending(client: Socket, gameId: string) {
        client.leave(`pending_${gameId}`);
    }

    @SubscribeMessage(LOBBY_EVENTS.JOIN_ROOM)
    async handleJoinRoom(
        @ConnectedSocket() client: Socket,
        @MessageBody() payload: { gameId: string; name: string; avatar: number; attributes: Record<string, Attribute>; uid: string },
    ) {
        const existingGame = this.newGameService.getGameByPlayer(client.id);
        if (existingGame) {
            await this.handleQuitGame(client, { gameId: existingGame.gameId, uid: payload.uid });
        }

        const game = this.newGameService.getGame(payload.gameId);
        if (!game) {
            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, { errorMessage: "La salle n'existe pas.", shouldRedirect: false });
            return;
        }
        if (game.isLocked && !game.started) {
            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, { errorMessage: 'La salle est verrouillée.', shouldRedirect: false });
            return;
        }

        // Friends-only guard
        if (game.friendsOnly && game.creatorUid) {
            const joinerUid = await this.friendService.getUidByUsername(payload.name);
            if (!joinerUid || !(await this.friendService.areFriends(game.creatorUid, joinerUid))) {
                this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                    errorMessage: 'Cette salle est réservée aux amis du créateur.',
                    shouldRedirect: false,
                });
                return;
            }
        }

        {
            const joinerUid = this.statusService.getUidBySocketId(client.id);
            if (joinerUid) {
                for (const player of game.players.filter((p) => !p.isBot)) {
                    const playerUid = this.statusService.getUidBySocketId(player.socketId);
                    if (playerUid) {
                        const blocked = await this.friendService.isBlocked(playerUid, joinerUid);
                        if (blocked) {
                            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                                errorMessage: 'Un joueur dans cette salle vous a bloqué. Vous ne pouvez pas la rejoindre.',
                                shouldRedirect: false,
                            });
                            return;
                        }
                    }
                }
            }
        }

        // Debit entry fee from joiner if applicable
        if (game.entryFee && game.entryFee > 0) {
            try {
                const result = await this.currencyService.addBalanceByUsername(payload.name, -game.entryFee);
                if (!result) {
                    this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                        errorMessage: 'Solde insuffisant pour rejoindre cette partie.',
                        shouldRedirect: false,
                    });
                    return;
                }
                game.pot = (game.pot || 0) + game.entryFee;
            } catch {
                this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                    errorMessage: 'Solde insuffisant pour rejoindre cette partie.',
                    shouldRedirect: false,
                });
                return;
            }
        }

        const previouslyInactivePlayer = game.inactivePlayers.find((p) => p.socketId === client.id);
        this.lobbyService.joinGame(client.id, game, payload.name, payload.avatar, payload.attributes);
        client.leave(`pending_${payload.gameId}`);
        client.join(game.gameId);
        let myPlayer = this.newGameService.getPlayer(client.id, game);
        if (myPlayer) {
            myPlayer.hasFlagMusicOption = await this.currencyService.hasOwnedSoundByUsername(payload.name, 'snd_flag_music');
        }
        if (game.started) {
            if (previouslyInactivePlayer) {
                const wantedAvatar = myPlayer.avatar;
                const wantedDice = myPlayer.dice;
                myPlayer = previouslyInactivePlayer;
                myPlayer.avatar = wantedAvatar;
                myPlayer.dice = wantedDice;
                myPlayer.hasFlagMusicOption = await this.currencyService.hasOwnedSoundByUsername(payload.name, 'snd_flag_music');
                game.players[game.players.findIndex((p) => p.socketId === client.id)] = myPlayer;
            }
            // Update status to inGame for drop-in player
            const joinerUid = this.statusService.getUidBySocketId(client.id);
            if (joinerUid && !this.statusService.isBusy(joinerUid)) {
                this.friendGateway.updateUserStatus(joinerUid, 'inGame');
            }
            this.movementService.dropInPlayer(game, myPlayer);
            if (game.map.gameMode === 'CTF') {
                this.lobbyService.rebalanceTeams(game);
            }
            this.turnService.orderTurnsAfterDropIn(game);
            game.inactivePlayers = game.inactivePlayers.filter((p) => p.socketId !== client.id);
            this.server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
            this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.to(game.gameId).emit(GAME_EVENTS.PLAYER_TURN_CHANGED, game.playerTurns[game.currentPlayerIndex]);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        } else {
            // Update status to creatingGame for lobby joiner
            const joinerUid = this.statusService.getUidBySocketId(client.id);
            if (joinerUid && !this.statusService.isBusy(joinerUid)) {
                this.friendGateway.updateUserStatus(joinerUid, 'creatingGame');
            }
            this.server.to(game.gameId).except(client.id).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        }
        return { game, myPlayer };
    }

    @SubscribeMessage(LOBBY_EVENTS.ADD_BOT)
    handleAddBot(@ConnectedSocket() client: Socket, @MessageBody() payload: { isAgressive: boolean; gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (game.isLocked) {
            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                errorMessage: 'La salle est verrouillée,' + 'vous ne pouvez plus rajouter de joueurs virtuels',
                shouldRedirect: false,
            });
            return;
        }
        this.lobbyService.addBot(payload.isAgressive, game);
        this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
    }

    @SubscribeMessage(LOBBY_EVENTS.START_GAME)
    async handleStartGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        game.startTime = new Date();
        if (game.map.gameMode === 'CTF') {
            try {
                game.teams = this.lobbyService.generateTeams(game);
            } catch (error) {
                const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue';
                this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                    errorMessage,
                    shouldRedirect: false,
                });
                return;
            }
        }
        if (game.map.gameMode !== 'CTF' && game.players.length === 1) {
            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                errorMessage: "Vous ne pouvez pas démarrer une partie tout seul. Veuillez attendre d'autres joueurs.",
                shouldRedirect: false,
            });
            return;
        }

        game.started = true;

        // Update all human players to inGame status
        for (const player of game.players.filter((p) => !p.isBot)) {
            const uid = this.statusService.getUidBySocketId(player.socketId);
            if (uid && !this.statusService.isBusy(uid)) {
                this.friendGateway.updateUserStatus(uid, 'inGame');
            }
        }

        this.movementService.placePlayers(game, game.players);
        this.turnService.orderPlayerTurns(game);

        // Assign a challenge to each human player
        game.players
            .filter((p) => !p.isBot)
            .forEach((player) => {
                const challenge = this.challengeService.assignChallenge(player.socketId, game.map.gameMode);
                this.server.to(player.socketId).emit(GAME_EVENTS.CHALLENGE_ASSIGNED, challenge);
            });

        this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.to(payload.gameId).emit(LOBBY_EVENTS.GAME_STARTED, { gameId: game.gameId });
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        const firstPlayerId = game.playerTurns[0];
        const firstPlayer = this.newGameService.getPlayer(firstPlayerId, game);
        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
        const logEntry = {
            timestamp,
            message: `Début de tour de ${firstPlayer.name}`,
            players: [firstPlayer.name],
            type: 'turn',
        };
        this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);

        if (firstPlayer.isBot) {
            game.currentPlayerIndex = game.players.length - 1;
            this.turnService.turnBehaviour(this.server, game);
            return;
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.LOCK_ROOM)
    handleLockRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.lockRoom(game, client.id);
        if (success) {
            this.server.emit('forceLockRoom', { gameId: payload.gameId, target: 'form' });
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        } else {
            client.emit(LOBBY_EVENTS.ERROR, { errorMessage: 'Impossible de verrouiller la salle.' });
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.UNLOCK_ROOM)
    handleUnlockRoom(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.unlockRoom(game, client.id);
        if (success) {
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        } else {
            client.emit(LOBBY_EVENTS.ERROR, {
                message: 'Impossible de déverrouiller la salle. Le nombre de joueurs maximal a été atteint',
                shouldRedirect: false,
            });
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.ACTIVATE_DROP_IN)
    handleActivateDropIn(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.activateDropIn(game, client.id);
        if (success) {
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.DEACTIVATE_DROP_IN)
    handleDeactivateDropIn(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.deactivateDropIn(game, client.id);
        if (success) {
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.ACTIVATE_FAST_ELIMINATION)
    handleActivateFastElimination(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.activateFastElimination(game, client.id);
        if (success) {
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.DEACTIVATE_FAST_ELIMINATION)
    handleDeactivateFastElimination(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;
        const success = this.lobbyService.deactivateFastElimination(game, client.id);
        if (success) {
            this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
        }
    }

    @SubscribeMessage(LOBBY_EVENTS.KICK_PLAYER)
    handleKickPlayer(@MessageBody() payload: { gameId: string; targetSocketId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return;

        // Update kicked player's status back to online
        const kickedUid = this.statusService.getUidBySocketId(payload.targetSocketId);
        if (kickedUid && !this.statusService.isBusy(kickedUid)) {
            this.friendGateway.updateUserStatus(kickedUid, 'online');
        }

        const playerIndex = game.players.findIndex((p) => p.socketId === payload.targetSocketId);
        if (playerIndex !== -1) {
            game.players.splice(playerIndex, 1);
        }

        delete game.selectedAvatars[payload.targetSocketId];
        game.playerTurns = game.playerTurns?.filter((id) => id !== payload.targetSocketId);
        this.server.to(payload.targetSocketId).emit(LOBBY_EVENTS.PLAYER_KICKED, {
            message: "Vous avez été exclu de la partie par l'organisateur. Vous allez être redirigé vers l'accueil.",
            shouldRedirect: true,
        });
        this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
    }

    @SubscribeMessage(LOBBY_EVENTS.SELECT_AVATAR)
    handleSelectAvatar(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string; avatar: number }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return { success: false };
        if (Object.values(game.selectedAvatars).includes(payload.avatar)) {
            return { success: false };
        }
        this.handleDeselectAvatar(client, { gameId: payload.gameId });
        game.selectedAvatars[client.id] = payload.avatar;
        this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.to(`pending_${payload.gameId}`).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        return { success: true };
    }

    @SubscribeMessage(LOBBY_EVENTS.DESELECT_AVATAR)
    handleDeselectAvatar(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (game.selectedAvatars[client.id]) {
            delete game.selectedAvatars[client.id];
        }
        this.server.to(payload.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.to(`pending_${payload.gameId}`).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        return { success: true };
    }

    @SubscribeMessage(LOBBY_EVENTS.QUIT_GAME)
    async handleQuitGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string; uid: string }) {
        client.leave(payload.gameId);

        // Update status back to online when quitting
        const quitterUid = this.statusService.getUidBySocketId(client.id);
        if (quitterUid && !this.statusService.isBusy(quitterUid)) {
            this.friendGateway.updateUserStatus(quitterUid, 'online');
        }

        const game = this.newGameService.getGame(payload.gameId);
        if (!game) return { error: 'Partie introuvable.' };
        const player = game.players.find((givenPlayer) => givenPlayer.socketId === client.id);
        if (!player) return { error: 'Joueur introuvable dans cette partie.' };

        this.handleDeselectAvatar(client, { gameId: payload.gameId });
        await this.chatService.leaveRoom(client, payload.gameId, payload.uid);
        if (player.isAdmin && !game.started) {
            // Also reset status for all players in the lobby
            for (const p of game.players.filter((pl) => !pl.isBot && pl.socketId !== client.id)) {
                const pUid = this.statusService.getUidBySocketId(p.socketId);
                if (pUid && !this.statusService.isBusy(pUid)) {
                    this.friendGateway.updateUserStatus(pUid, 'online');
                }
            }
            this.server.to(game.gameId).except(client.id).emit(GAME_EVENTS.ON_ERROR, {
                errorMessage: "L'organisateur a supprimé la partie. Vous allez être redirigé vers la page d'accueil.",
                shouldRedirect: true,
            });
            this.server.to(client.id).emit(GAME_EVENTS.ON_ERROR, {
                errorMessage: "Vous avez supprimé cette partie. Vous allez être redirigé vers la page d'accueil.",
                shouldRedirect: true,
            });
            delete this.newGameService.getGames()[game.gameId];
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
            return { success: true };
        } else if (!player.isAdmin && !game.started) {
            this.lobbyService.removePlayer(game, client.id);
            this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            this.server.to(game.gameId).emit(GAME_EVENTS.PLAYER_TURN_CHANGED, game.playerTurns[game.currentPlayerIndex]);
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
            return { success: true };
        } else if (game.started) {
            if (player.isAdmin && game.isInDebugMode) {
                game.isInDebugMode = false;
                this.server.to(game.gameId).emit(GAME_EVENTS.DEBUG, { message: 'Mode Débug désactivé' });
            }
            this.combatService.dropPlayerItems(player, game);
            this.lobbyService.removePlayer(game, client.id);
            if (this.newGameService.isPlayerInCombat(player, game.gameId)) {
                const combatState = this.combatService.getCombatState(game.gameId);
                let gameEnded = false;

                const winnerS = combatState.attacker === player ? combatState.target : combatState.attacker;
                const loserS = winnerS === combatState.target ? combatState.attacker : combatState.target;
                if (game.fastEliminationActive) {
                    this.newGameService.eliminatePlayer(game, loserS.socketId);
                }
                const combatResult = this.combatService.endCombat(game, winnerS);
                winnerS.battlesWon++;
                if (game.map.gameMode !== 'CTF' && winnerS.battlesWon === 3) {
                    gameEnded = true;
                    game.ended = true;
                    game.winner = winnerS.name;
                }
                loserS.position = loserS.startPosition;
                if (loserS.isFlagHolder) {
                    loserS.isFlagHolder = false;
                }

                loserS.battlesLost = (loserS.battlesLost || 0) + 1;
                winnerS.combatsParticipated = (winnerS.combatsParticipated || 0) + 1;
                loserS.combatsParticipated = (loserS.combatsParticipated || 0) + 1;
                combatState.combatAlreadyCounted = true;
                const originalHp = this.combatService['defaultHp'].get(loserS.socketId) || 0;
                const damageDealt = originalHp;
                winnerS.totalDamageDone = (winnerS.totalDamageDone || 0) + damageDealt;
                loserS.totalDamageTaken = (loserS.totalDamageTaken || 0) + damageDealt;
                this.server.to(game.gameId).emit(COMBAT_EVENTS.COMBAT_ENDED, {
                    combatState: combatResult.combatState,
                    reason: REASON.DEATH,
                    actionPlayer: combatResult.actionPlayer,
                    gameEnded,
                });

                this.server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);

                if (gameEnded) {
                    // Let turnBehaviour handle rewards, challenges, UPDATE_LOBBY
                    await this.turnService.turnBehaviour(this.server, game);
                } else {
                    this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
                }
                this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
                const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });
                const logEntry = {
                    timestamp,
                    message: `Fin de combat : ${winnerS.name} a vaincu ${loserS.name}`,
                    players: [winnerS.name, loserS.name],
                    type: 'combat',
                };
                this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
                if (!gameEnded && player === combatState.combatInitiator) {
                    this.turnService.turnBehaviour(this.server, game);
                }
            } else if (player.isMyTurn) {
                this.turnService.turnBehaviour(this.server, game);
            }
            game.inactivePlayers.push(player);
            const humanPlayers = game.players.filter((givenPlayer) => !givenPlayer.isBot);
            const onlyHumans = humanPlayers.length === game.players.length;
            const activeEliminatedPlayers = game.eliminatedPlayers.filter(
                (p) => !game.inactivePlayers.some((inactive) => inactive.socketId === p.socketId),
            );

            if (humanPlayers.length === 1 && onlyHumans && game.map.gameMode !== 'CTF') {
                if (game.started) {
                    game.endTime = new Date();
                    this.statsService.persistGameStats(game);
                }
                game.ended = true;
                this.server.to(game.gameId).except(player.socketId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            } else {
                this.server.to(game.gameId).emit(GAME_EVENTS.MAP_UPDATED, game.map);
                this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
                this.server.to(game.gameId).emit(GAME_EVENTS.PLAYER_TURN_CHANGED, game.playerTurns[game.currentPlayerIndex]);
            }
            if (game.map.gameMode !== 'CTF' && humanPlayers.length === 0 && game.players.length === 1) {
                if (game.started) {
                    game.endTime = new Date();
                    this.statsService.persistGameStats(game);
                }
                game.ended = true;
                this.server.to(game.gameId).except(player.socketId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            }
            if (game.map.gameMode !== 'CTF' && game.fastEliminationActive && activeEliminatedPlayers.length === game.players.length - 1) {
                if (game.started) {
                    game.endTime = new Date();
                    this.statsService.persistGameStats(game);
                }
                game.ended = true;
                this.server.to(game.gameId).except(player.socketId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
            }
            this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
            if (game.ended) {
                this.newGameService.finalizeGame(game);
            }
            return { success: true };
        }
    }

    @SubscribeMessage(GAME_EVENTS.DEBUG)
    handleDebug(client: Socket, payload: { gameId: string }): void {
        const game = this.newGameService.getGame(payload.gameId);
        game.isInDebugMode = !game.isInDebugMode;
        const debugMessage = game.isInDebugMode ? 'Mode Débug activé' : 'Mode Débug désactivé';
        const player = this.newGameService.getPlayer(client.id, game);

        this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.to(game.gameId).emit(GAME_EVENTS.DEBUG, { message: debugMessage });

        const timestamp = new Date().toLocaleTimeString('fr-FR', { hour12: false });

        const logEntry = {
            timestamp,
            message: debugMessage,
            players: [player.name],
            type: 'debug',
        };
        this.server.to(game.gameId).emit(GAME_EVENTS.LOG, logEntry);
    }

    @SubscribeMessage('forceLockRoom')
    handleForceLockRoom(@MessageBody() payload: { gameId: string }) {
        this.server.to(payload.gameId).emit('forceLockRoom');
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));
    }

    @SubscribeMessage(FRIEND_EVENTS.LOBBY_BLOCK_CONFIRM)
    async handleLobbyBlockConfirm(@ConnectedSocket() client: Socket, @MessageBody() payload: { gameId: string }) {
        const game = this.newGameService.getGame(payload.gameId);
        if (!game) {
            client.emit(GAME_EVENTS.ON_ERROR, { errorMessage: "La salle n'existe plus.", shouldRedirect: false });
            return;
        }

        client.join(`pending_${payload.gameId}`);
        this.server.to(game.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, game);
        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.newGameService.getGames()));

        return { success: true, game };
    }

    afterInit(server: Server) {
        this.newGameService.setServer(server);
    }

    handleDisconnect(@ConnectedSocket() client: Socket) {
        // Only handle game cleanup here.
        // FriendGateway.handleDisconnect will take care of broadcasting 'offline' to friends.
        const game = this.newGameService.getGameByPlayer(client.id);
        if (!game) return;
        this.handleQuitGame(client, { gameId: game.gameId, uid: '' });
    }
}
