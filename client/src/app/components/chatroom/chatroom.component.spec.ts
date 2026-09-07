/* eslint-disable no-unused-vars */
/* tslint:disable:no-unused-variable */
/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable @typescript-eslint/no-magic-numbers */
/* eslint-disable max-lines */
import { ElementRef } from '@angular/core';
import { ComponentFixture, TestBed, fakeAsync, tick } from '@angular/core/testing';
import { ChatSocketService } from '@app/services/sockets/chatroom-socket/chatroom-socket.service';
import { BehaviorSubject, of, throwError } from 'rxjs';
import { ChatRoomComponent } from './chatroom.component';

class ChatSocketServiceStub {
    messages$ = new BehaviorSubject<any>({ gameId: 'testGame', message: 'initial message' });
    history$ = new BehaviorSubject<any[]>([]);
    joinRoom(gameId: string, playerName: string) {
        return of(null);
    }
    sendMessage(gameId: string, playerName: string, message: string, isLobby: boolean = false) {
        return of(null);
    }
    leaveRoom(gameId: string) {
        return of(null);
    }
    getMessageHistory(gameId: string) {
        return of(null);
    }
}

describe('ChatRoomComponent', () => {
    let component: ChatRoomComponent;
    let fixture: ComponentFixture<ChatRoomComponent>;
    let chatSocketService: ChatSocketService;

    beforeEach(async () => {
        await TestBed.configureTestingModule({
            imports: [ChatRoomComponent],
            providers: [{ provide: ChatSocketService, useClass: ChatSocketServiceStub }],
        }).compileComponents();
    });

    beforeEach(() => {
        fixture = TestBed.createComponent(ChatRoomComponent);
        component = fixture.componentInstance;
        component.gameId = 'testGame';
        component.playerName = 'Alice';
        component.isLobby = false;
        component.messages = [];
        chatSocketService = TestBed.inject(ChatSocketService);
        const div = document.createElement('div');
        Object.defineProperty(div, 'scrollHeight', { value: 200, configurable: true });
        component['messagesContainer'] = new ElementRef(div);
        fixture.detectChanges();
    });

    it('should create', () => {
        expect(component).toBeTruthy();
    });

    describe('ngOnInit', () => {
        it('should do nothing in ngOnInit if gameId is missing', () => {
            component.gameId = '';
            const joinSpy = spyOn(chatSocketService, 'joinRoom').and.callThrough();
            const getHistorySpy = spyOn(chatSocketService, 'getMessageHistory').and.callThrough();

            component.ngOnInit();

            expect(joinSpy).not.toHaveBeenCalled();
            expect(getHistorySpy).not.toHaveBeenCalled();
        });

        it('should join the room and subscribe to messages', fakeAsync(() => {
            chatSocketService.messages$ = new BehaviorSubject<any>({ gameId: 'dummy', message: 'ignored' });

            const joinSpy = spyOn(chatSocketService, 'joinRoom').and.returnValue(of(null));
            const getHistorySpy = spyOn(chatSocketService, 'getMessageHistory').and.returnValue(of(null));
            component.ngOnInit();
            tick();
            expect(joinSpy).toHaveBeenCalledWith('testGame', 'Alice');
            expect(getHistorySpy).toHaveBeenCalledWith('testGame');
            component.messages = [];
            (chatSocketService.messages$ as BehaviorSubject<any>).next({ gameId: 'testGame', message: 'hello world' });
            tick();
            expect(component.messages.length).toBe(1);
        }));

        it('should log error on joinRoom error', () => {
            const errorSpy = spyOn(console, 'error');
            spyOn(chatSocketService, 'joinRoom').and.returnValue(throwError(() => new Error('join error')));
            component.ngOnInit();
            expect(errorSpy).toHaveBeenCalledWith('error joining chat room:', jasmine.any(Error));
        });

        it('should update messages when history$ emits a non-empty array', () => {
            const testHistory = [{ gameId: 'testGame', message: 'history message' }];
            (chatSocketService.history$ as BehaviorSubject<any[]>).next(testHistory);

            expect(component.messages).toEqual(testHistory);
        });

        it('should not update messages when history$ emits null or empty array', () => {
            component.messages = [{ gameId: 'oldGame', message: 'old message' }];

            (chatSocketService.history$ as BehaviorSubject<any[]>).next(null as any);
            expect(component.messages).toEqual([{ gameId: 'oldGame', message: 'old message' }]);

            (chatSocketService.history$ as BehaviorSubject<any[]>).next([]);
            expect(component.messages).toEqual([{ gameId: 'oldGame', message: 'old message' }]);
        });
    });

    describe('send()', () => {
        it('should return early if gameId is missing', () => {
            component.gameId = '';
            component.currentMessage = 'Hello!';
            const sendSpy = spyOn(chatSocketService, 'sendMessage').and.callThrough();

            component.send();
            expect(sendSpy).not.toHaveBeenCalled();
        });

        it('should return early if currentMessage is empty or whitespace', () => {
            component.gameId = 'testGame';
            component.currentMessage = '   ';
            const sendSpy = spyOn(chatSocketService, 'sendMessage').and.callThrough();

            component.send();
            expect(sendSpy).not.toHaveBeenCalled();
        });

        it('should send message and reset currentMessage if valid', fakeAsync(() => {
            const sendSpy = spyOn(chatSocketService, 'sendMessage').and.returnValue(of(null));
            const scrollSpy = spyOn<any>(component, 'scrollToBottom').and.callThrough();

            component.gameId = 'testGame';
            component.currentMessage = 'Hello!';
            component.send();
            tick();

            expect(sendSpy).toHaveBeenCalledWith('testGame', 'Alice', 'Hello!', false);
            expect(component.currentMessage).toBe('');
            tick();
            expect(scrollSpy).toHaveBeenCalled();
        }));

        it('should log error on sendMessage error', () => {
            const errorSpy = spyOn(console, 'error');
            spyOn(chatSocketService, 'sendMessage').and.returnValue(throwError(() => new Error('send error')));
            component.currentMessage = 'Hello!';
            component.send();
            expect(errorSpy).toHaveBeenCalledWith('Error sending message:', jasmine.any(Error));
        });
    });
    describe('scrollToBottom', () => {
        it('should scroll to bottom if messagesContainer exists', () => {
            const fakeNativeElement = {
                scrollTop: 0,
                scrollHeight: 200,
            };
            component['messagesContainer'] = { nativeElement: fakeNativeElement } as ElementRef<any>;
            (component as any).scrollToBottom();
            expect(fakeNativeElement.scrollTop).toBe(200);
        });

        it('should do nothing if messagesContainer is undefined', () => {
            // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
            component['messagesContainer'] = undefined!;
            expect(() => (component as any).scrollToBottom()).not.toThrow();
        });
    });

    describe('send', () => {
        it('should send message, reset currentMessage and scroll to bottom on success', fakeAsync(() => {
            const sendSpy = spyOn(chatSocketService, 'sendMessage').and.returnValue(of(null));
            const scrollSpy = spyOn<any>(component, 'scrollToBottom').and.callThrough();
            component.currentMessage = 'Hello!';
            component.isLobby = false;
            component.send();
            tick();
            expect(sendSpy).toHaveBeenCalledWith('testGame', 'Alice', 'Hello!', false);
            expect(component.currentMessage).toBe('');
            expect(scrollSpy).toHaveBeenCalled();
        }));

        it('should log error on sendMessage error', () => {
            const errorSpy = spyOn(console, 'error');
            spyOn(chatSocketService, 'sendMessage').and.returnValue(throwError(() => new Error('send error')));
            component.currentMessage = 'Hello!';
            component.send();
            expect(errorSpy).toHaveBeenCalledWith('Error sending message:', jasmine.any(Error));
        });
    });

    describe('ngOnDestroy', () => {
        it('should leave room and unsubscribe from messages', () => {
            const leaveSpy = spyOn(chatSocketService, 'leaveRoom').and.returnValue(of(null));
            const unsubscribeSpy = jasmine.createSpy('unsubscribe');
            component['messageSub'] = { unsubscribe: unsubscribeSpy } as any;
            component['historySub'] = { unsubscribe: unsubscribeSpy } as any;
            component.ngOnDestroy();
            expect(leaveSpy).toHaveBeenCalledWith('testGame');
            expect(unsubscribeSpy).toHaveBeenCalledTimes(2);
        });
    });
});
