import { CommonModule } from '@angular/common';
import { Component, HostListener, inject, OnDestroy, OnInit } from '@angular/core';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { ConfirmationPopupComponent } from '@app/components/confirmation-popup/confirmation-popup.component';
import { AuthService } from '@app/services/auth/auth.service';
import { AvatarDoc, AvatarService } from '@app/services/avatar/avatar.service';
import { FriendService } from '@app/services/friend/friend.service';
import { Language, LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { AccountStats, StatsService } from '@app/services/stats/stats.service';
import { ThemeService } from '@app/services/theme/theme.service';
import { ThemeName } from '@common/interfaces/theme.interface';
import { Subscription } from 'rxjs';

interface Avatar extends AvatarDoc {}

@Component({
    selector: 'app-account-settings',
    standalone: true,
    imports: [CommonModule, ReactiveFormsModule, TranslatePipe, ConfirmationPopupComponent],
    templateUrl: './account-settings.component.html',
    styleUrls: ['./account-settings.component.scss'],
})
export class AccountSettingsComponent implements OnInit, OnDestroy {
    form!: FormGroup;
    errorMessage: string | null = null;
    successMessage: string | null = null;
    showDeleteConfirm = false;
    showUnsavedDialog = false;
    leavingConfirmed = false;
    isBusy = false;

    avatars: Avatar[] = [];
    selectedAvatar: string | null = null;
    uploadingAvatar = false;
    uploadError: string | null = null;

    showDeleteAvatarConfirm = false;
    deleteAvatarConfirmId: string | null = null;

    stats: AccountStats | null = null;
    statsLoading = true;

    pendingLanguage: Language = 'fr';
    pendingTheme: ThemeName = 'normal';
    availableLanguages: Language[] = ['fr', 'en'];
    themes: ThemeName[] = ['normal', 'cyberpunk', 'forest'];

    private initialLanguage: Language = 'fr';
    private initialTheme: ThemeName = 'normal';

    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private avatarService = inject(AvatarService);
    private statsService = inject(StatsService);
    private friendService = inject(FriendService);
    private router = inject(Router);
    private subscriptions: Subscription[] = [];
    private initialUsername = '';
    private initialEmail = '';
    private initialAvatar: string | null = null;
    private languageService = inject(LanguageService);
    private themeService = inject(ThemeService);

    @HostListener('window:beforeunload', ['$event'])
    onBeforeUnload(event: BeforeUnloadEvent): void {
        if (this.hasUnsavedChanges()) {
            event.preventDefault();
        }
    }

    ngOnInit(): void {
        const user = this.authService.currentUser;

        this.form = this.fb.group({
            username: [user?.displayName ?? '', [Validators.required]],
            email: [user?.email ?? '', [Validators.required, Validators.email]],
        });

        this.selectedAvatar = user?.avatar ?? null;

        this.initialUsername = user?.displayName ?? '';
        this.initialEmail = user?.email ?? '';
        this.initialAvatar = this.selectedAvatar;

        this.initialLanguage = this.languageService.currentLanguage;
        this.pendingLanguage = this.initialLanguage;
        this.initialTheme = this.themeService.currentTheme;
        this.pendingTheme = this.initialTheme;
        this.availableLanguages = this.languageService.getAvailableLanguages();

        this.subscriptions.push(
            this.friendService.isBusy$.subscribe((busy) => {
                this.isBusy = busy;
            }),
        );

        this.subscriptions.push(
            this.friendService.isBusy$.subscribe((busy) => {
                this.isBusy = busy;
            }),
        );
        this.avatarService.getMyAvatars().subscribe({
            next: (data) => {
                this.avatars = data;
            },
        });
        this.loadStats();
    }

    ngOnDestroy(): void {
        this.subscriptions.forEach((sub) => sub.unsubscribe());
        this.languageService.previewLanguage(this.initialLanguage);
        this.themeService.previewTheme(this.initialTheme);
    }

    hasUnsavedChanges(): boolean {
        if (!this.form) return false;
        const usernameChanged = this.form.value.username !== this.initialUsername;
        const emailChanged = this.form.value.email !== this.initialEmail;
        const avatarChanged = this.selectedAvatar !== this.initialAvatar;
        const languageChanged = this.pendingLanguage !== this.initialLanguage;
        const themeChanged = this.pendingTheme !== this.initialTheme;
        return usernameChanged || emailChanged || avatarChanged || languageChanged || themeChanged;
    }

    onLanguagePreview(event: Event): void {
        const lang = (event.target as HTMLSelectElement).value as Language;
        this.pendingLanguage = lang;
        this.languageService.previewLanguage(lang);
    }

    onThemePreview(theme: ThemeName): void {
        this.pendingTheme = theme;
        this.themeService.previewTheme(theme);
    }

    getLanguageLabel(language: Language): string {
        return this.languageService.getLanguageLabel(language);
    }

    goBack(): void {
        if (this.hasUnsavedChanges()) {
            this.showUnsavedDialog = true;
        } else {
            this.router.navigate(['/home']);
        }
    }

    confirmLeave(): void {
        this.showUnsavedDialog = false;
        this.leavingConfirmed = true;
        this.router.navigate(['/home']);
    }

    cancelLeave(): void {
        this.showUnsavedDialog = false;
    }

    onUnsavedConfirm(choice: boolean): void {
        if (choice) {
            this.confirmLeave();
        } else {
            this.cancelLeave();
        }
    }

    selectAvatar(id: string): void {
        this.selectedAvatar = id;
    }

    toggleBusy(): void {
        this.friendService.setBusy(!this.isBusy);
    }
    deleteAvatar(event: Event, avatarId: string): void {
        event.stopPropagation();
        this.deleteAvatarConfirmId = avatarId;
        this.showDeleteAvatarConfirm = true;
    }

    async onFileSelected(event: Event): Promise<void> {
        const input = event.target as HTMLInputElement;
        const file = input.files?.[0];

        if (!file) return;

        if (!file.type.startsWith('image/')) {
            this.uploadError = this.languageService.translate('settings.selectImage');
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            this.uploadError = this.languageService.translate('settings.imageSizeLimit');
            return;
        }

        this.uploadError = null;
        this.uploadingAvatar = true;

        try {
            const base64 = await this.avatarService.compressImageFile(file);
            this.avatarService.uploadAvatar(base64).subscribe({
                next: (newAvatar) => {
                    this.avatars.push(newAvatar);
                    this.selectAvatar(newAvatar.id);
                    this.successMessage = this.languageService.translate('messages.avatarUploadSuccess');
                    this.uploadingAvatar = false;
                    input.value = '';
                },
                error: (err: unknown) => {
                    const e = err as { message?: string };
                    this.uploadError = e.message ?? this.languageService.translate('messages.avatarUploadError');
                    this.uploadingAvatar = false;
                    input.value = '';
                },
            });
        } catch (error: unknown) {
            const err = error as { message?: string };
            this.uploadError = err.message ?? this.languageService.translate('messages.avatarUploadError');
            this.uploadingAvatar = false;
            input.value = '';
        }
    }
    getTotalGamesPlayed(): number {
        if (!this.stats) return 0;
        return this.statsService.getTotalGamesPlayed(this.stats);
    }

    getAverageGameTime(): string {
        if (!this.stats) return '0:00';
        return this.statsService.getAverageGameTime(this.stats);
    }
    async onDeleteAccount(): Promise<void> {
        try {
            await this.authService.deleteAccount();
        } catch (error: unknown) {
            const err = error as { message?: string };
            this.errorMessage = err.message ?? this.languageService.translate('messages.accountDeleteError');
            this.showDeleteConfirm = false;
        }
    }
    confirmDeleteAvatar(): void {
        if (!this.deleteAvatarConfirmId) return;

        const avatarId = this.deleteAvatarConfirmId;

        this.avatarService.deleteAvatar(avatarId).subscribe({
            next: () => {
                this.avatars = this.avatars.filter((a) => a.id !== avatarId);
                if (this.selectedAvatar === avatarId) {
                    this.selectedAvatar = null;
                }
                this.successMessage = this.languageService.translate('messages.avatarDeleteSuccess');
                this.showDeleteAvatarConfirm = false;
                this.deleteAvatarConfirmId = null;
            },
            error: (err) => {
                const error = err as { message?: string; error?: string };
                this.errorMessage = error.message ?? error.error ?? this.languageService.translate('messages.avatarDeleteError');
                this.showDeleteAvatarConfirm = false;
                this.deleteAvatarConfirmId = null;
            },
        });
    }

    cancelDeleteAvatar(): void {
        this.showDeleteAvatarConfirm = false;
        this.deleteAvatarConfirmId = null;
    }

    async onSubmit(): Promise<void> {
        this.errorMessage = null;
        this.successMessage = null;

        if (this.form.invalid) return;

        try {
            const previousUsername = this.authService.currentUser?.displayName;

            await this.authService.updateProfile(
                this.form.value.username,
                this.form.value.email,
                this.selectedAvatar,
                this.pendingTheme,
                this.pendingLanguage,
            );

            const user = this.authService.currentUser;
            this.avatarService.invalidateUser(user?.uid, user?.displayName ?? undefined);
            if (previousUsername && previousUsername !== user?.displayName) {
                this.avatarService.invalidateUser(undefined, previousUsername ?? undefined);
            }

            this.initialUsername = user?.displayName ?? '';
            this.initialEmail = user?.email ?? '';
            this.initialAvatar = this.selectedAvatar;

            this.languageService.persistLanguage(this.pendingLanguage);
            this.themeService.persistTheme(this.pendingTheme);
            this.initialLanguage = this.pendingLanguage;
            this.initialTheme = this.pendingTheme;

            this.successMessage = this.languageService.translate('messages.profileUpdateSuccess');
        } catch (error: unknown) {
            const err = error as { message?: string };
            this.errorMessage = err.message ?? this.languageService.translate('messages.profileUpdateError');
        }
    }

    private async loadStats(): Promise<void> {
        try {
            this.stats = await this.statsService.getStats();
            this.statsLoading = false;
        } catch (error) {
            this.statsLoading = false;
        }
    }
}
