import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting, HttpTestingController } from '@angular/common/http/testing';
import { Router } from '@angular/router';
import { AuthService } from './auth.service';
import { environment } from '@environments/environment';

describe('AuthService', () => {
    let service: AuthService;
    let routerSpy: jasmine.SpyObj<Router>;
    let httpMock: HttpTestingController;

    beforeEach(() => {
        localStorage.clear();
        routerSpy = jasmine.createSpyObj('Router', ['navigate']);

        TestBed.configureTestingModule({
            providers: [provideHttpClient(), provideHttpClientTesting(), { provide: Router, useValue: routerSpy }],
        });
        service = TestBed.inject(AuthService);
        httpMock = TestBed.inject(HttpTestingController);
    });

    afterEach(() => {
        httpMock.verify();
        localStorage.clear();
    });

    it('should be created', () => {
        expect(service).toBeTruthy();
    });

    it('should return false for isLoggedIn when no user is logged in', () => {
        expect(service.isLoggedIn).toBeFalse();
    });

    it('should return null for currentUser when no user is logged in', () => {
        expect(service.currentUser).toBeNull();
    });

    it('should return null for currentUsername when no user is logged in', () => {
        expect(service.currentUsername).toBeNull();
    });

    describe('signUp', () => {
        it('should throw for empty username', async () => {
            await expectAsync(service.signUp('test@test.com', 'password', '')).toBeRejectedWithError();
        });

        it('should throw for short username', async () => {
            await expectAsync(service.signUp('test@test.com', 'password', 'ab')).toBeRejectedWithError();
        });

        it('should call server and set session on success', async () => {
            const signUpPromise = service.signUp('test@test.com', 'password', 'testuser');

            const req = httpMock.expectOne(`${environment.serverUrl}/auth/signup`);
            expect(req.request.method).toBe('POST');
            expect(req.request.body).toEqual({ email: 'test@test.com', password: 'password', username: 'testuser' });
            req.flush({ uid: '123', email: 'test@test.com', username: 'testuser', idToken: 'token123' });

            await signUpPromise;
            expect(service.isLoggedIn).toBeTrue();
            expect(service.currentUser?.uid).toBe('123');
            expect(service.currentUsername).toBe('testuser');
        });
    });

    describe('signIn', () => {
        it('should throw for empty identifier', async () => {
            await expectAsync(service.signIn('', 'password')).toBeRejectedWithError();
        });

        it('should call server and set session on success', async () => {
            const signInPromise = service.signIn('test@test.com', 'password');

            const req = httpMock.expectOne(`${environment.serverUrl}/auth/signin`);
            expect(req.request.method).toBe('POST');
            req.flush({ uid: '123', email: 'test@test.com', username: 'testuser', idToken: 'token123' });

            await signInPromise;
            expect(service.isLoggedIn).toBeTrue();
            expect(service.currentUser?.email).toBe('test@test.com');
        });

        it('should throw with error code on server error', async () => {
            const signInPromise = service.signIn('test@test.com', 'wrongpassword');

            const req = httpMock.expectOne(`${environment.serverUrl}/auth/signin`);
            req.flush({ code: 'auth/invalid-credential', message: 'Invalid credentials' }, { status: 401, statusText: 'Unauthorized' });

            await expectAsync(signInPromise).toBeRejected();
        });
    });

    describe('signOutUser', () => {
        it('should clear session and navigate to auth', async () => {
            localStorage.setItem('auth_token', 'token123');
            localStorage.setItem('auth_user', JSON.stringify({ uid: '123', email: 'test@test.com', displayName: 'testuser' }));

            const signOutPromise = service.signOutUser();

            const req = httpMock.expectOne(`${environment.serverUrl}/auth/signout`);
            expect(req.request.headers.get('Authorization')).toBe('Bearer token123');
            req.flush({ message: 'OK' });

            await signOutPromise;
            expect(service.isLoggedIn).toBeFalse();
            expect(routerSpy.navigate).toHaveBeenCalledWith(['/auth']);
        });
    });

    describe('getFirebaseErrorMessage', () => {
        it('should return correct message for email-already-in-use', () => {
            expect(service.getFirebaseErrorMessage('auth/email-already-in-use')).toBe('Cette adresse email est déjà utilisée.');
        });

        it('should return correct message for invalid-email', () => {
            expect(service.getFirebaseErrorMessage('auth/invalid-email')).toBe('Adresse email invalide.');
        });

        it('should return correct message for weak-password', () => {
            expect(service.getFirebaseErrorMessage('auth/weak-password')).toBe('Le mot de passe est trop faible (minimum 6 caractères).');
        });

        it('should return correct message for user-not-found', () => {
            expect(service.getFirebaseErrorMessage('auth/user-not-found')).toBe('Aucun compte trouvé avec cette adresse email.');
        });

        it('should return correct message for wrong-password', () => {
            expect(service.getFirebaseErrorMessage('auth/wrong-password')).toBe('Mot de passe incorrect.');
        });

        it('should return correct message for invalid-credential', () => {
            expect(service.getFirebaseErrorMessage('auth/invalid-credential')).toBe('Identifiants invalides. Vérifiez votre email et mot de passe.');
        });

        it('should return default message for unknown error', () => {
            expect(service.getFirebaseErrorMessage('unknown-error')).toBe('Une erreur est survenue. Veuillez réessayer.');
        });
    });
});
