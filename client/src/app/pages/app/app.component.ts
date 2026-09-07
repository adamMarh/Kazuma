import { Component, HostListener, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { AuthService } from '@app/services/auth/auth.service';
import { ChallengeService } from '@app/services/challenge/challenge.service';
import { LanguageService } from '@app/services/language/language.service';
import { ThemeService } from '@app/services/theme/theme.service';

@Component({
    selector: 'app-root',
    templateUrl: './app.component.html',
    styleUrls: ['./app.component.scss'],
    imports: [RouterOutlet],
})
export class AppComponent {
    private authService = inject(AuthService);
    private challengeService = inject(ChallengeService);
    private readonly isChatPopup = window.location.hash.includes('chat-popup');
    private themeService = inject(ThemeService);
    private languageService = inject(LanguageService);

    constructor() {
        this.themeService.initializeTheme();
        this.languageService.initializeLanguage();
    }

    @HostListener('window:beforeunload')
    async handleBeforeUnload(): Promise<void> {
        if (this.isChatPopup) return;
        if (this.authService.isLoggedIn) {
            this.challengeService.clearActiveChallenge();
            await this.authService.clearSession();
        }
    }
}
