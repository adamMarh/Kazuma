import { Component, OnInit, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { ChatRoomComponent } from '@app/components/chatroom/chatroom.component';
import { ElectronService } from '@app/services/electron/electron.service';
import { TranslatePipe } from '@app/services/language/translate.pipe';

@Component({
    selector: 'app-chat-popup-page',
    standalone: true,
    imports: [ChatRoomComponent, TranslatePipe],
    templateUrl: './chat-popup-page.component.html',
    styleUrls: ['./chat-popup-page.component.scss'],
})
export class ChatPopupPageComponent implements OnInit {
    gameId = 'global';
    private route = inject(ActivatedRoute);
    private electron = inject(ElectronService);

    ngOnInit(): void {
        this.route.params.subscribe((params) => {
            if (params['gameId']) {
                this.gameId = params['gameId'];
            }
        });
    }

    anchor(): void {
        this.electron.send('chat:anchor');
    }
}
