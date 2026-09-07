/* eslint-disable @typescript-eslint/no-empty-function */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { TestBed } from '@angular/core/testing';
import { LOBBY_EVENTS } from '@common/socket-events/lobby.events';
import { SocketService } from './socket.service';

describe('SocketService', () => {
    let service: SocketService;
    let mockSocket: any;

    beforeEach(() => {
        mockSocket = {
            id: '12345',
            emit: jasmine.createSpy('emit'),
            on: jasmine.createSpy('on'),
            off: jasmine.createSpy('off'),
        };

        TestBed.configureTestingModule({
            providers: [SocketService],
        });
        service = TestBed.inject(SocketService);
        service['socket'] = mockSocket;
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    describe('emit', () => {
        it('should emit an event and complete with a response on success', (done) => {
            const testEvent = 'testEvent';
            const testData = { some: 'data' };
            const testResponse = 'success response';

            mockSocket.emit.and.callFake((event: string, data: any, callback: (response: any) => void) => {
                expect(event).toBe(testEvent);
                expect(data).toEqual(testData);
                callback(testResponse);
            });

            service.emit<string>(testEvent, testData).subscribe({
                next: (response) => {
                    expect(response).toEqual(testResponse);
                },
                complete: () => done(),
            });
        });

        it('should emit an event and return an error if response contains an error', (done) => {
            const testEvent = 'testEvent';
            const testData = { some: 'data' };
            const testError = 'error occurred';

            mockSocket.emit.and.callFake((event: string, data: any, callback: (response: any) => void) => {
                expect(event).toBe(testEvent);
                expect(data).toEqual(testData);
                callback({ error: testError });
            });

            service.emit<string>(testEvent, testData).subscribe({
                error: (err) => {
                    expect(err).toEqual(testError);
                    done();
                },
            });
        });
    });

    describe('getSocketId', () => {
        it('should return the socket id if defined', () => {
            expect(service.getSocketId()).toEqual('12345');
        });

        it('should return null if socket is not defined', () => {
            service['socket'] = null as any;
            expect(service.getSocketId()).toBeNull();
        });
    });

    describe('onError', () => {
        it('should listen to error events and emit received data', () => {
            let capturedHandler: ((data: any) => void) | undefined;
            mockSocket.on.and.callFake((event: string, callback: (...args: any[]) => void) => {
                if (event === LOBBY_EVENTS.ERROR) {
                    capturedHandler = callback as (data: any) => void;
                }
            });
            let errorData: any;
            service.onError().subscribe((data) => {
                errorData = data;
            });
            const testError = 'socket error';
            if (!capturedHandler) {
                fail('capturedHandler was not assigned for the error event');
                return;
            }
            capturedHandler(testError);
            expect(errorData).toEqual(testError);
        });
    });

    describe('on', () => {
        it('should listen to an event and unsubscribe correctly', () => {
            const testEvent = 'test-event';
            let capturedHandler: ((data: any) => void) | undefined;

            mockSocket.off.and.callFake((event: string, callback: (...args: any[]) => void) => {
                if (event === testEvent) {
                    capturedHandler = callback as (data: any) => void;
                }
            });

            mockSocket.off.and.callFake((event: string, callback: (...args: any[]) => void) => {
                expect(event).toBe(testEvent);
                if (capturedHandler) {
                    expect(callback).toBe(capturedHandler);
                }
            });

            const subscription = service.on<any>(testEvent).subscribe();
            subscription.unsubscribe();
            expect(mockSocket.off).toHaveBeenCalled();
        });

        it('should unsubscribe from on event', () => {
            const testEvent = 'test-event';
            const handler = jasmine.createSpy();

            mockSocket.on.and.callFake((event: string, callback: any) => {
                if (event === testEvent) {
                    handler.and.callFake(callback);
                }
            });

            const subscription = service.on(testEvent).subscribe(() => {});
            subscription.unsubscribe();

            expect(mockSocket.off).toHaveBeenCalled();
        });
    });

    describe('onConnect', () => {
        it('should emit and complete when socket connects', (done) => {
            let capturedHandler: (() => void) | undefined;

            mockSocket.on.and.callFake((event: string, callback: () => void) => {
                if (event === 'connect') {
                    capturedHandler = callback;
                }
            });

            service.onConnect().subscribe({
                next: () => {
                    expect(true).toBeTrue();
                },
                complete: () => done(),
            });
            if (capturedHandler) {
                capturedHandler();
            } else {
                fail('connect handler not registered');
            }
        });
    });

    describe('isConnected', () => {
        it('should return true if socket is connected', () => {
            mockSocket.connected = true;
            expect(service.isConnected()).toBeTrue();
        });

        it('should return false if socket is not connected', () => {
            mockSocket.connected = false;
            expect(service.isConnected()).toBeFalse();
        });
    });

    describe('send', () => {
        it('should emit event with data using socket.emit', () => {
            const event = 'custom-event';
            const data = { msg: 'hello' };

            service.send(event, data);
            expect(mockSocket.emit).toHaveBeenCalledWith(event, data);
        });

        it('should emit event without data if none is provided', () => {
            const event = 'custom-event';

            service.send(event);
            expect(mockSocket.emit).toHaveBeenCalledWith(event, undefined);
        });
    });
});
