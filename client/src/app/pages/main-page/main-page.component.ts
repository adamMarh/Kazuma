import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { Router, RouterLink } from '@angular/router';
import { ChatRoomComponent } from '@app/components/chatroom/chatroom.component';
import { FriendListComponent } from '@app/components/friend-list/friend-list.component';
import { GameInvitationDialogComponent } from '@app/components/game-invitation-dialog/game-invitation-dialog.component';
import { StatusIndicatorComponent } from '@app/components/status-indicator/status-indicator.component';
import { WalletComponent } from '@app/components/wallet/wallet.component';
import { AuthService } from '@app/services/auth/auth.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { AvatarService } from '@app/services/avatar/avatar.service';
import { CurrencyStoreService } from '@app/services/currency/currency-store.service';
import { FriendService } from '@app/services/friend/friend.service';
import { LobbySocketService } from '@app/services/sockets/lobby-socket/lobby-socket.service';
import { GameInvitation } from '@common/interfaces/friend.interface';
import { Subscription } from 'rxjs';

@Component({
    selector: 'app-main-page',
    standalone: true,
    templateUrl: './main-page.component.html',
    styleUrls: ['./main-page.component.scss'],
    imports: [
        CommonModule,
        RouterLink,
        ChatRoomComponent,
        FriendListComponent,
        GameInvitationDialogComponent,
        StatusIndicatorComponent,
        WalletComponent,
        TranslatePipe,
    ],
})
export class MainPageComponent implements OnInit, OnDestroy {
    avatarImage: string | null = null;
    hasWhiteAura = false;
    hasEnchantedName = false;
    hasStellarCrown = false;
    pendingInvitation: GameInvitation | null = null;
    ownStatus: import('@common/interfaces/friend.interface').UserStatus = 'online';

    private authService = inject(AuthService);
    private avatarService = inject(AvatarService);
    private currencyStore = inject(CurrencyStoreService);
    private friendService = inject(FriendService);
    private lobbySocketService = inject(LobbySocketService);
    private subscriptions: Subscription[] = [];
    private router = inject(Router);

    get userName(): string | null {
        return this.authService.currentUser?.displayName ?? null;
    }
    ngOnInit(): void {
        const userSub = this.authService.currentUser$.subscribe((user) => {
            if (!user?.avatar) {
                this.avatarImage = null;
                return;
            }

            this.loadAvatar(user.avatar);
        });
        this.subscriptions.push(userSub);

        const walletSub = this.currencyStore.wallet$.subscribe((wallet) => {
            const visuals = wallet?.owned?.visuals ?? [];
            this.hasWhiteAura = visuals.includes('vis_aura') || visuals.includes('visual-aura');
            this.hasEnchantedName = visuals.includes('vis_rainbow') || visuals.includes('vis_police_nom') || visuals.includes('visual-enchanted');
            this.hasStellarCrown = visuals.includes('vis_starry_name') || visuals.includes('vis_flag_custom') || visuals.includes('visual-stars');
            // Debug: log visuals and computed flags so we can see what the client received
            // eslint-disable-next-line no-console
            console.debug('[MainPage] visuals:', visuals, 'flags:', {
                hasWhiteAura: this.hasWhiteAura,
                hasEnchantedName: this.hasEnchantedName,
                hasStellarCrown: this.hasStellarCrown,
            });
        });
        this.subscriptions.push(walletSub);

        if (!this.currencyStore.isInitialized) {
            void this.currencyStore.refresh();
        }

        const busySub = this.friendService.isBusy$.subscribe((busy) => {
            this.ownStatus = busy ? 'busy' : 'online';
        });
        this.subscriptions.push(busySub);

        const inviteSub = this.friendService.invitation$.subscribe((invitation) => {
            if (!this.friendService.isBusy) {
                this.pendingInvitation = invitation;
            }
        });
        this.subscriptions.push(inviteSub);
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.subscriptions = [];
    }

    onLogout(): void {
        this.authService.signOutUser();
    }

    onAcceptInvitation(invitation: GameInvitation): void {
        this.pendingInvitation = null;
        this.lobbySocketService.checkGameId(invitation.gameId).subscribe({
            next: () => {
                this.router.navigate(['/join-game'], { queryParams: { code: invitation.gameId } });
            },
        });
    }

    onDeclineInvitation(): void {
        this.pendingInvitation = null;
    }

    private loadAvatar(avatarId: string): void {
        this.avatarService.getAvatarSrcById(avatarId).subscribe((src) => {
            this.avatarImage = src !== this.avatarService.defaultAvatarSrc ? src : null;
        });
    }
}
