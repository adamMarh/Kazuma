import { Pipe, PipeTransform, inject } from '@angular/core';
import { LanguageService } from './language.service';

@Pipe({
    name: 'translate',
    pure: false,
    standalone: true,
})
export class TranslatePipe implements PipeTransform {
    private languageService = inject(LanguageService);

    transform(key: string, params?: { [key: string]: string | number }): string {
        return this.languageService.translate(key, params);
    }
}
