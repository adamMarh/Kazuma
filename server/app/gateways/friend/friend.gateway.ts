import { FriendService } from '@app/services/friend/friend.service';
import { GameService } from '@app/services/game/game.service';
import { StatusService } from '@app/services/status/status.service';
import { UserStatus } from '@common/interfaces/friend.interface';
import { FRIEND_EVENTS } from '@common/socket-events/friend.events';
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
export class FriendGateway implements OnGatewayDisconnect, OnGatewayInit {
    @WebSocketServer() server: Server;

    constructor(
        private friendService: FriendService,
        private statusService: StatusService,
        private gameService: GameService,
    ) {}

    @SubscribeMessage(FRIEND_EVENTS.REGISTER_USER)
    async handleRegisterUser(@ConnectedSocket() client: Socket, @MessageBody() payload: { uid: string; username?: string }) {
        const username = payload.username || payload.uid;
        this.statusService.registerUser(payload.uid, client.id, username);

        // Cache friend list for status broadcasting
        const friends = await this.friendService.getFriends(payload.uid);
        this.statusService.setFriends(
            payload.uid,
            friends.map((f) => f.uid),
        );

        this.sendPendingRequestsToUser(payload.uid, client);
        client.broadcast.emit(FRIEND_EVENTS.USERS_UPDATED);

        // Broadcast status to online friends
        this.broadcastStatusToFriends(payload.uid);

        // Send enriched friend list
        const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
        client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);

        // Send blocked users list on initial connect
        const blockedList = await this.friendService.getBlockedUsersList(payload.uid);
        client.emit(FRIEND_EVENTS.BLOCKED_LIST_UPDATED, blockedList);

        return { registered: true };
    }

    @SubscribeMessage(FRIEND_EVENTS.SET_BUSY)
    async handleSetBusy(@ConnectedSocket() client: Socket, @MessageBody() payload: { uid: string; busy: boolean }) {
        this.statusService.setBusy(payload.uid, payload.busy);
        this.broadcastStatusToFriends(payload.uid);

        // Also send updated friend list to the user (their own status is reflected)
        const friends = await this.friendService.getFriends(payload.uid);
        const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
        client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);

        return { success: true, busy: payload.busy };
    }

    @SubscribeMessage(FRIEND_EVENTS.INVITE_TO_GAME)
    async handleInviteToGame(@ConnectedSocket() client: Socket, @MessageBody() payload: { fromUid: string; toUid: string; gameId: string }) {
        const targetStatus = this.statusService.getStatus(payload.toUid);

        // Cannot invite players who are in a game
        if (targetStatus === 'inGame') {
            client.emit(FRIEND_EVENTS.ERROR, { message: 'Ce joueur est déjà en partie.' });
            return { success: false, error: 'Ce joueur est déjà en partie.' };
        }

        if (targetStatus === 'offline') {
            client.emit(FRIEND_EVENTS.ERROR, { message: "Ce joueur n'est pas en ligne." });
            return { success: false, error: "Ce joueur n'est pas en ligne." };
        }

        const targetSocketId = this.statusService.getSocketId(payload.toUid);
        const fromUsername = this.statusService.getUsername(payload.fromUid) || payload.fromUid;

        if (targetSocketId) {
            this.server.to(targetSocketId).emit(FRIEND_EVENTS.GAME_INVITATION, {
                fromUid: payload.fromUid,
                fromUsername,
                gameId: payload.gameId,
                timestamp: new Date().toISOString(),
            });
        }

        return { success: true };
    }

    @SubscribeMessage(FRIEND_EVENTS.SEND_REQUEST)
    async handleSendRequest(@ConnectedSocket() client: Socket, @MessageBody() payload: { fromUid: string; toUid: string }) {
        try {
            const request = await this.friendService.sendFriendRequest(payload.fromUid, payload.toUid);

            const targetSocketId = this.statusService.getSocketId(payload.toUid);
            if (targetSocketId) {
                this.server.to(targetSocketId).emit(FRIEND_EVENTS.RECEIVE_REQUEST, request);
            }

            return { success: true, request };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.ACCEPT_REQUEST)
    async handleAcceptRequest(@ConnectedSocket() client: Socket, @MessageBody() payload: { requestId: string; userUid: string }) {
        try {
            const request = await this.friendService.acceptFriendRequest(payload.requestId, payload.userUid);

            const friends = await this.friendService.getFriends(payload.userUid);
            this.statusService.setFriends(
                payload.userUid,
                friends.map((f) => f.uid),
            );
            const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
            client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);

            const updatedPending = await this.friendService.getPendingRequests(payload.userUid);
            client.emit(FRIEND_EVENTS.PENDING_REQUESTS_UPDATED, updatedPending);

            const senderSocketId = this.statusService.getSocketId(request.fromUid);
            if (senderSocketId) {
                this.server.to(senderSocketId).emit(FRIEND_EVENTS.REQUEST_ACCEPTED, request);
                const senderFriends = await this.friendService.getFriends(request.fromUid);
                this.statusService.setFriends(
                    request.fromUid,
                    senderFriends.map((f) => f.uid),
                );
                const enrichedSenderFriends = this.statusService.enrichFriendsWithStatus(senderFriends);
                this.server.to(senderSocketId).emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedSenderFriends);
            }

            return { success: true, request };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.DECLINE_REQUEST)
    async handleDeclineRequest(@ConnectedSocket() client: Socket, @MessageBody() payload: { requestId: string; userUid: string }) {
        try {
            const request = await this.friendService.declineFriendRequest(payload.requestId, payload.userUid);

            const updatedPending = await this.friendService.getPendingRequests(payload.userUid);
            client.emit(FRIEND_EVENTS.PENDING_REQUESTS_UPDATED, updatedPending);

            const senderSocketId = this.statusService.getSocketId(request.fromUid);
            if (senderSocketId) {
                this.server.to(senderSocketId).emit(FRIEND_EVENTS.REQUEST_DECLINED, request);
            }

            return { success: true, request };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.REMOVE_FRIEND)
    async handleRemoveFriend(@ConnectedSocket() client: Socket, @MessageBody() payload: { userUid: string; friendUid: string }) {
        try {
            await this.friendService.removeFriend(payload.userUid, payload.friendUid);

            const friends = await this.friendService.getFriends(payload.userUid);
            this.statusService.setFriends(
                payload.userUid,
                friends.map((f) => f.uid),
            );
            const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
            client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);

            const friendSocketId = this.statusService.getSocketId(payload.friendUid);
            if (friendSocketId) {
                this.server.to(friendSocketId).emit(FRIEND_EVENTS.FRIEND_REMOVED, { uid: payload.userUid });
                const friendFriends = await this.friendService.getFriends(payload.friendUid);
                this.statusService.setFriends(
                    payload.friendUid,
                    friendFriends.map((f) => f.uid),
                );
                const enrichedFriendFriends = this.statusService.enrichFriendsWithStatus(friendFriends);
                this.server.to(friendSocketId).emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriendFriends);
            }

            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.GET_FRIENDS)
    async handleGetFriends(@ConnectedSocket() client: Socket, @MessageBody() payload: { userUid: string }) {
        try {
            const friends = await this.friendService.getFriends(payload.userUid);
            this.statusService.setFriends(
                payload.userUid,
                friends.map((f) => f.uid),
            );
            const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
            client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);
            return { success: true, friends: enrichedFriends };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.GET_PENDING_REQUESTS)
    async handleGetPendingRequests(@ConnectedSocket() client: Socket, @MessageBody() payload: { userUid: string }) {
        try {
            const requests = await this.friendService.getPendingRequests(payload.userUid);
            client.emit(FRIEND_EVENTS.PENDING_REQUESTS_UPDATED, requests);
            return { success: true, requests };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.SEARCH_USERS)
    async handleSearchUsers(@ConnectedSocket() client: Socket, @MessageBody() payload: { query: string; userUid: string }) {
        try {
            const results = await this.friendService.searchUsers(payload.query, payload.userUid);
            client.emit(FRIEND_EVENTS.SEARCH_RESULTS, results);
            return { success: true, results };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.BLOCK_USER)
    async handleBlockUser(@ConnectedSocket() client: Socket, @MessageBody() payload: { blockerUid: string; blockedUid: string }) {
        try {
            await this.friendService.blockUser(payload.blockerUid, payload.blockedUid);

            const friends = await this.friendService.getFriends(payload.blockerUid);
            this.statusService.setFriends(
                payload.blockerUid,
                friends.map((f) => f.uid),
            );
            const enrichedFriends = this.statusService.enrichFriendsWithStatus(friends);
            client.emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedFriends);

            const blockedList = await this.friendService.getBlockedUsersList(payload.blockerUid);
            client.emit(FRIEND_EVENTS.BLOCKED_LIST_UPDATED, blockedList);

            client.emit(FRIEND_EVENTS.USER_BLOCKED, { blockedUid: payload.blockedUid });

            const blockedSocketId = this.statusService.getSocketId(payload.blockedUid);
            if (blockedSocketId) {
                const blockedFriends = await this.friendService.getFriends(payload.blockedUid);
                this.statusService.setFriends(
                    payload.blockedUid,
                    blockedFriends.map((f) => f.uid),
                );
                const enrichedBlockedFriends = this.statusService.enrichFriendsWithStatus(blockedFriends);
                this.server.to(blockedSocketId).emit(FRIEND_EVENTS.FRIEND_LIST_UPDATED, enrichedBlockedFriends);
                this.server.to(blockedSocketId).emit(FRIEND_EVENTS.FRIEND_REMOVED, { uid: payload.blockerUid });
            }

            const blockerSocketId = this.statusService.getSocketId(payload.blockerUid);
            if (blockerSocketId && blockedSocketId) {
                const games = Object.values(this.gameService.getGames());
                const sharedGame = games.find(
                    (g) =>
                        !g.started && g.players.some((p) => p.socketId === blockerSocketId) && g.players.some((p) => p.socketId === blockedSocketId),
                );
                if (sharedGame) {
                    const blockerPlayer = sharedGame.players.find((p) => p.socketId === blockerSocketId);
                    if (blockerPlayer?.isAdmin) {
                        // Admin blocks someone: auto-kick the blocked user
                        const playerIndex = sharedGame.players.findIndex((p) => p.socketId === blockedSocketId);
                        if (playerIndex !== -1) {
                            sharedGame.players.splice(playerIndex, 1);
                        }
                        delete sharedGame.selectedAvatars[blockedSocketId];
                        sharedGame.playerTurns = sharedGame.playerTurns?.filter((id) => id !== blockedSocketId);

                        const kickedUid = this.statusService.getUidBySocketId(blockedSocketId);
                        if (kickedUid && !this.statusService.isBusy(kickedUid)) {
                            this.updateUserStatus(kickedUid, 'online');
                        }

                        this.server.to(blockedSocketId).emit(LOBBY_EVENTS.PLAYER_KICKED, {
                            message: "Vous avez été exclu de la salle car l'administrateur vous a bloqué.",
                            shouldRedirect: true,
                        });
                        this.server.to(sharedGame.gameId).emit(LOBBY_EVENTS.UPDATE_LOBBY, sharedGame);
                        this.server.emit(LOBBY_EVENTS.UPDATE_GAMES, Object.values(this.gameService.getGames()));
                    } else {
                        // Non-admin blocks someone: ask blocker to stay or leave
                        const blockedPlayer = sharedGame.players.find((p) => p.socketId === blockedSocketId);
                        client.emit(FRIEND_EVENTS.LOBBY_BLOCK_STAY_OR_LEAVE, {
                            gameId: sharedGame.gameId,
                            blockedUsername: blockedPlayer?.name || '',
                        });
                    }
                }
            }

            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    @SubscribeMessage(FRIEND_EVENTS.UNBLOCK_USER)
    async handleUnblockUser(@ConnectedSocket() client: Socket, @MessageBody() payload: { blockerUid: string; blockedUid: string }) {
        try {
            await this.friendService.unblockUser(payload.blockerUid, payload.blockedUid);

            const blockedList = await this.friendService.getBlockedUsersList(payload.blockerUid);
            client.emit(FRIEND_EVENTS.BLOCKED_LIST_UPDATED, blockedList);

            client.emit(FRIEND_EVENTS.USER_UNBLOCKED, { unblockedUid: payload.blockedUid });

            const unblockedSocketId = this.statusService.getSocketId(payload.blockedUid);
            if (unblockedSocketId) {
                this.server.to(unblockedSocketId).emit(FRIEND_EVENTS.USER_UNBLOCKED, { unblockedUid: payload.blockerUid });
            }

            return { success: true };
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Une erreur est survenue.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
            return { success: false, error: errorMessage };
        }
    }

    afterInit() {
        this.friendService.on('newUser', () => {
            this.server.emit(FRIEND_EVENTS.NEW_USER);
        });
    }

    handleDisconnect(client: Socket) {
        const uid = this.statusService.getUidBySocketId(client.id);
        if (!uid) return;

        // Save data BEFORE unregistering so we can broadcast properly
        const username = this.statusService.getUsername(uid);
        const friendSocketIds = this.statusService.getOnlineFriendSocketIds(uid);

        // Unregister removes the user from all status maps
        this.statusService.unregisterUser(client.id);

        // Broadcast 'offline' to all friends using the saved data
        for (const socketId of friendSocketIds) {
            this.server.to(socketId).emit(FRIEND_EVENTS.STATUS_CHANGED, {
                uid,
                username,
                status: 'offline',
            });
        }
    }

    /**
     * Called by LobbyGateway to update a user's status when they create/join/leave a game
     */
    updateUserStatus(uid: string, status: UserStatus): void {
        this.statusService.setStatus(uid, status);
        this.broadcastStatusToFriends(uid);
    }

    /**
     * Get the StatusService instance for use by other gateways
     */
    getStatusService(): StatusService {
        return this.statusService;
    }

    private broadcastStatusToFriends(uid: string): void {
        const status = this.statusService.getStatus(uid);
        const username = this.statusService.getUsername(uid);
        const friendSocketIds = this.statusService.getOnlineFriendSocketIds(uid);

        for (const socketId of friendSocketIds) {
            this.server.to(socketId).emit(FRIEND_EVENTS.STATUS_CHANGED, {
                uid,
                username,
                status,
            });
        }
    }

    private async sendPendingRequestsToUser(uid: string, client: Socket) {
        try {
            const requests = await this.friendService.getPendingRequests(uid);
            if (requests.length > 0) {
                client.emit(FRIEND_EVENTS.PENDING_REQUESTS_UPDATED, requests);
            }
        } catch (error) {
            const errorMessage = error instanceof Error ? error.message : 'Erreur lors du chargement des demandes en attente.';
            client.emit(FRIEND_EVENTS.ERROR, { message: errorMessage });
        }
    }
}
