import { CommonModule } from '@angular/common';
import { Component, OnInit, inject } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { Language, LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';

@Component({
    selector: 'app-language-selector',
    standalone: true,
    imports: [CommonModule, TranslatePipe, FormsModule],
    templateUrl: './language-selector.component.html',
    styleUrls: ['./language-selector.component.scss'],
})
export class LanguageSelectorComponent implements OnInit {
    availableLanguages: Language[] = [];

    private languageService = inject(LanguageService);

    get currentLanguage(): Language {
        return this.languageService.currentLanguage;
    }

    set currentLanguage(lang: Language) {
        this.languageService.setLanguage(lang);
    }

    ngOnInit(): void {
        this.availableLanguages = this.languageService.getAvailableLanguages();
    }

    onLanguageChange(event: Event): void {
        const target = event.target as HTMLSelectElement;
        const language = target.value as Language;
        this.languageService.setLanguage(language);
    }

    getLanguageLabel(language: Language): string {
        return this.languageService.getLanguageLabel(language);
    }
}
