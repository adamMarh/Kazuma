/* eslint-disable @typescript-eslint/no-explicit-any */
/* tslint:disable:no-unused-variable */
import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { ChatSocketService } from '@app/services/sockets/chatroom-socket/chatroom-socket.service';
import { SocketService } from '@app/services/sockets/socket.service';
import { ChatMessage } from '@common/interfaces/chatmessage.interface';
import { CHAT_EVENTS } from '@common/socket-events/chatroom.events';
import { of, Subject } from 'rxjs';

describe('ChatSocketService', () => {
    let service: ChatSocketService;
    let socketServiceSpy: jasmine.SpyObj<SocketService>;
    let receiveMessageSubject: Subject<any>;

    @Component({ template: '' })
    class EmptyTestComponent {}

    beforeEach(() => {
        socketServiceSpy = jasmine.createSpyObj<SocketService>('SocketService', ['on', 'emit']);

        receiveMessageSubject = new Subject<any>();
        socketServiceSpy.on.and.returnValue(receiveMessageSubject.asObservable());
        socketServiceSpy.emit.and.returnValue(of(true));

        TestBed.configureTestingModule({
            imports: [EmptyTestComponent],
            providers: [{ provide: SocketService, useValue: socketServiceSpy }, ChatSocketService],
        });

        service = TestBed.inject(ChatSocketService);
    });

    it('devrait être créé', () => {
        expect(service).toBeTruthy();
    });

    it('doit s’abonner à CHAT_EVENTS.RECEIVE_MESSAGE dès la création (constructor)', () => {
        expect(socketServiceSpy.on).toHaveBeenCalledWith(CHAT_EVENTS.RECEIVE_MESSAGE);
    });

    it('devrait émettre un message reçu dans messages$', (done) => {
        service.messages$.subscribe((message: any) => {
            expect(message).toEqual({ text: 'test message' });
            done();
        });

        receiveMessageSubject.next({ text: 'test message' });
    });

    it('joinRoom doit appeler socketService.emit avec les bons paramètres', () => {
        const gameId = 'game123';
        const playerName = 'John Doe';
        socketServiceSpy.emit.and.returnValue(of(true));
        service.joinRoom(gameId, playerName).subscribe((res) => {
            expect(res).toBeTrue();
        });
        expect(socketServiceSpy.emit).toHaveBeenCalledWith(CHAT_EVENTS.JOIN_ROOM, { gameId, playerName });
    });

    it('leaveRoom doit appeler socketService.emit avec le bon paramètre', () => {
        const gameId = 'game123';
        socketServiceSpy.emit.and.returnValue(of(true));
        service.leaveRoom(gameId).subscribe((res) => {
            expect(res).toBeTrue();
        });
        expect(socketServiceSpy.emit).toHaveBeenCalledWith(CHAT_EVENTS.LEAVE_ROOM, { gameId });
    });

    it('sendMessage doit construire et émettre un ChatMessage', () => {
        const gameId = 'game123';
        const author = 'Jane';
        const content = 'Bonjour';
        socketServiceSpy.emit.and.returnValue(of(true));
        service.sendMessage(gameId, author, content).subscribe((res) => {
            expect(res).toBeTrue();
        });
        const [[eventName, messageArg]] = socketServiceSpy.emit.calls.allArgs();
        expect(eventName).toEqual(CHAT_EVENTS.SEND_MESSAGE);
        const msg = messageArg as ChatMessage;
        expect(msg.gameId).toBe(gameId);
        expect(msg.author).toBe(author);
        expect(msg.content).toBe(content);
        expect(typeof msg.timestamp).toBe('string');
    });

    it('getMessageHistory should emit GET_HISTORY event with correct parameters', (done) => {
        const gameId = 'game123';
        socketServiceSpy.emit.and.returnValue(of(true));

        service.getMessageHistory(gameId).subscribe((res) => {
            expect(res).toBeTrue();
            done();
        });
        expect(socketServiceSpy.emit).toHaveBeenCalledWith(CHAT_EVENTS.GET_HISTORY, { gameId });
    });
});
