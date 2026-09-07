import { CommonModule } from '@angular/common';
import { Component, inject, OnDestroy, OnInit } from '@angular/core';
import { AbstractControl, FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router } from '@angular/router';
import { LanguageSelectorComponent } from '@app/components/language-selector/language-selector.component';
import { MAX_USERNAME_LENGTH, MIN_PASSWORD_LENGTH, MIN_USERNAME_LENGTH } from '@app/constants/auth-error-messages';
import { AuthService } from '@app/services/auth/auth.service';
import { AvatarService } from '@app/services/avatar/avatar.service';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import { ThemeService } from '@app/services/theme/theme.service';
import { environment } from '@environments/environment';
import { firstValueFrom } from 'rxjs';

interface Avatar {
    id: string;
    imageBase64: string;
    name: string;
}
@Component({
    selector: 'app-auth-page, app-auth-component',
    imports: [CommonModule, ReactiveFormsModule, TranslatePipe, LanguageSelectorComponent],
    templateUrl: './auth-page.component.html',
    styleUrls: ['./auth-page.component.scss'],
})
export class AuthPageComponent implements OnInit, OnDestroy {
    authForm: FormGroup;
    isLoginMode = true;
    isLoading = false;
    errorMessage: string | null = null;
    avatars: Avatar[] = [];
    selectedAvatarId: string = '';
    uploadingAvatar = false;
    uploadError: string | null = null;
    pendingCustomBase64: string | null = null;

    private fb = inject(FormBuilder);
    private authService = inject(AuthService);
    private avatarService = inject(AvatarService);
    private languageService = inject(LanguageService);
    private router = inject(Router);
    private themeService = inject(ThemeService);
    constructor() {
        this.authForm = this.fb.group({
            username: [''],
            email: ['', [Validators.required]],
            password: ['', [Validators.required, Validators.minLength(MIN_PASSWORD_LENGTH)]],
            confirmPassword: [''],
        });
        this.applyModeValidators();
    }

    get username() {
        return this.authForm.get('username');
    }

    get email() {
        return this.authForm.get('email');
    }

    get password() {
        return this.authForm.get('password');
    }

    get confirmPassword() {
        return this.authForm.get('confirmPassword');
    }

    toggleMode(): void {
        this.isLoginMode = !this.isLoginMode;
        this.errorMessage = null;
        this.applyModeValidators();
    }
    selectAvatar(id: string): void {
        this.selectedAvatarId = id;
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
            this.pendingCustomBase64 = base64;
            this.avatars = this.avatars.filter((a) => a.id !== '__pending__');
            this.avatars = [...this.avatars, { id: '__pending__', name: 'custom', imageBase64: base64 }];
            this.selectedAvatarId = '__pending__';
            input.value = '';
        } catch (error: unknown) {
            const err = error as { message?: string };
            this.uploadError = err.message ?? this.languageService.translate('messages.avatarUploadError');
        } finally {
            this.uploadingAvatar = false;
        }
    }
    async ngOnInit() {
        this.themeService.suspendTheme();
        try {
            const res = await fetch(`${environment.serverUrl}/avatars`);
            const data = await res.json();

            this.avatars = data;
        } catch (error) {
            /* empty */
        }
    }

    ngOnDestroy() {
        this.themeService.restoreTheme();
    }

    async onSubmit(): Promise<void> {
        if (this.authForm.invalid) {
            return;
        }

        this.isLoading = true;
        this.errorMessage = null;

        const { email, password, username } = this.authForm.value;

        try {
            if (this.isLoginMode) {
                await this.authService.signIn(email, password);
            } else {
                const avatarForSignup =
                    this.selectedAvatarId === '__pending__' ? this.avatars.find((a) => a.id !== '__pending__')?.id ?? '' : this.selectedAvatarId;
                await this.authService.signUp(email, password, username, avatarForSignup);
                if (this.pendingCustomBase64) {
                    try {
                        const newAvatar = await firstValueFrom(this.avatarService.uploadAvatar(this.pendingCustomBase64));
                        await this.authService.updateProfile(username, email, newAvatar.id);
                    } catch {
                        // non-critical: account created, custom avatar upload failed
                    }
                }
            }
            this.router.navigate(['/home']);
        } catch (error: unknown) {
            const firebaseError = error as { code?: string };
            this.errorMessage = this.authService.getFirebaseErrorMessage(firebaseError.code || '');
        } finally {
            this.isLoading = false;
        }
    }
    private applyModeValidators(): void {
        const usernameControl = this.authForm.get('username');
        const emailControl = this.authForm.get('email');
        const confirmControl = this.authForm.get('confirmPassword');
        if (!usernameControl) return;
        if (!emailControl) return;
        if (!confirmControl) return;
        if (this.isLoginMode) {
            usernameControl.clearValidators();
            usernameControl.setValue('');
            emailControl.setValidators([Validators.required]);
            confirmControl.clearValidators();
            confirmControl.setValue('');
            this.authForm.setValidators(null);
        } else {
            usernameControl.setValidators([
                Validators.required,
                Validators.minLength(MIN_USERNAME_LENGTH),
                Validators.maxLength(MAX_USERNAME_LENGTH),
            ]);
            emailControl.setValidators([Validators.required, Validators.email]);
            confirmControl.setValidators([Validators.required]);
            this.authForm.setValidators(this.passwordMatchValidator);
        }

        usernameControl.updateValueAndValidity();
        emailControl.updateValueAndValidity();
        confirmControl.updateValueAndValidity();
        this.authForm.updateValueAndValidity();
    }

    private passwordMatchValidator = (control: AbstractControl) => {
        const group = control as FormGroup;
        const pw = group.get('password')?.value;
        const cpw = group.get('confirmPassword')?.value;
        return pw === cpw ? null : { passwordMismatch: true };
    };
}
