import { provideHttpClient } from '@angular/common/http';
import { enableProdMode } from '@angular/core';
import { bootstrapApplication } from '@angular/platform-browser';
import { provideAnimations } from '@angular/platform-browser/animations';
import { Routes, provideRouter, withComponentInputBinding, withHashLocation } from '@angular/router';
import { CharacterFormComponent } from '@app/components/character-form/character-form.component';
import { EndGameComponent } from '@app/components/end-game/end-game.component';
import { GridCreationComponent } from '@app/components/grid-creation/grid-creation.component';
import { GridEditorComponent } from '@app/components/grid-editor/grid-editor.component';
import { MovementTestComponent } from '@app/components/movement/movement.component';
import { authGuard, publicGuard, unsavedChangesGuard } from '@app/guards/auth.guard';
import { AccountSettingsComponent } from '@app/pages/account-settings/account-settings.component';
import { AdminPageComponent } from '@app/pages/admin-page/admin-page.component';
import { AppComponent } from '@app/pages/app/app.component';
import { AuthPageComponent } from '@app/pages/auth-page/auth-page.component';
import { ChatPopupPageComponent } from '@app/pages/chat-popup/chat-popup-page.component';
import { GamePageComponent } from '@app/pages/game-page/game-page.component';
import { InGameViewComponent } from '@app/pages/in-game-view/in-game-view.component';
import { JoinGamePageComponent } from '@app/pages/join-game-page/join-game-page.component';
import { GameLobbyComponent } from '@app/pages/lobby/lobby.component';
import { MainPageComponent } from '@app/pages/main-page/main-page.component';
import { ShopPageComponent } from '@app/pages/shop-page/shop-page.component';
import { WalletPageComponent } from '@app/pages/wallet-page/wallet-page.component';
import { environment } from './environments/environment';
// Initialize Firebase (imported for side effects)
import './environments/firebase-config';

if (environment.production) {
    enableProdMode();
}

const routes: Routes = [
    { path: '', redirectTo: '/auth', pathMatch: 'full' },
    { path: 'auth', component: AuthPageComponent, canActivate: [publicGuard] },
    { path: 'movement', component: MovementTestComponent, canActivate: [authGuard] },
    { path: 'home', component: MainPageComponent, canActivate: [authGuard] },
    { path: 'game', component: GamePageComponent, canActivate: [authGuard] },
    { path: 'admin', component: AdminPageComponent, canActivate: [authGuard] },
    { path: 'join', component: GameLobbyComponent, canActivate: [authGuard] },
    { path: 'create', component: GridCreationComponent, canActivate: [authGuard] },
    { path: 'edit', component: GridEditorComponent, canActivate: [authGuard] },
    { path: 'waiting-room', component: GameLobbyComponent, canActivate: [authGuard] },
    { path: 'game-session', component: GamePageComponent, canActivate: [authGuard] },
    { path: 'game-session/character-form', component: CharacterFormComponent, canActivate: [authGuard] },
    { path: 'in-game', component: InGameViewComponent, canActivate: [authGuard] },
    { path: 'join-game', component: JoinGamePageComponent, canActivate: [authGuard] },
    { path: 'end-game', component: EndGameComponent, canActivate: [authGuard] },
    { path: 'wallet', component: WalletPageComponent, canActivate: [authGuard] },
    { path: 'shop', component: ShopPageComponent, canActivate: [authGuard] },
    { path: 'account-settings', component: AccountSettingsComponent, canActivate: [authGuard], canDeactivate: [unsavedChangesGuard] },
    { path: 'chat-popup/:gameId', component: ChatPopupPageComponent },
    { path: '**', redirectTo: '/auth' },
];

// Clean up stored language before app startup
// If 'en' is stored, replace it with 'fr' (French default)
const storedLang = localStorage.getItem('selected-language');
if (storedLang === 'en') {
    localStorage.setItem('selected-language', 'fr');
}

bootstrapApplication(AppComponent, {
    providers: [provideHttpClient(), provideRouter(routes, withHashLocation(), withComponentInputBinding()), provideAnimations()],
});
