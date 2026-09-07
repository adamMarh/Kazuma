import { CommonModule } from '@angular/common';
import { AfterViewInit, Component, ElementRef, Input, OnChanges, SimpleChanges, ViewChild, inject } from '@angular/core';
import { LanguageService } from '@app/services/language/language.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';
import * as qrCode from 'qrcode';

const GAME_ID_PATTERN = /^\d{4}$/;

@Component({
    standalone: true,
    selector: 'app-qr-code',
    templateUrl: './qr-code.component.html',
    styleUrls: ['./qr-code.component.scss'],
    imports: [CommonModule, TranslatePipe],
})
export class QrCodeComponent implements AfterViewInit, OnChanges {
    @Input() gameId: string = '';
    @ViewChild('qrCanvas', { static: false }) qrCanvas!: ElementRef<HTMLCanvasElement>;

    errorMessage: string = '';
    private languageService = inject(LanguageService);

    ngAfterViewInit(): void {
        this.renderQrCode();
    }

    ngOnChanges(changes: SimpleChanges): void {
        if (changes['gameId'] && !changes['gameId'].firstChange) {
            this.renderQrCode();
        }
    }

    private renderQrCode(): void {
        this.errorMessage = '';

        if (!this.gameId || !GAME_ID_PATTERN.test(this.gameId)) {
            this.errorMessage = this.languageService.translate('qrCode.invalidCode');
            return;
        }

        if (!this.qrCanvas?.nativeElement) return;

        qrCode.toCanvas(
            this.qrCanvas.nativeElement,
            this.gameId,
            {
                width: 160,
                margin: 1,
                color: { dark: '#1a0f08', light: '#ffdeab' },
            },
            (error: Error | null | undefined) => {
                if (error) {
                    this.errorMessage = this.languageService.translate('qrCode.generationError');
                }
            },
        );
    }
}
