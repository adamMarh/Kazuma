import { inject } from '@angular/core';
import { CanActivateFn, CanDeactivateFn, Router } from '@angular/router';
import { AccountSettingsComponent } from '@app/pages/account-settings/account-settings.component';
import { AuthService } from '@app/services/auth/auth.service';
import { map, take } from 'rxjs';

export const authGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
        take(1),
        map((user) => {
            if (user) return true;
            return router.createUrlTree(['/auth']);
        }),
    );
};

export const publicGuard: CanActivateFn = () => {
    const authService = inject(AuthService);
    const router = inject(Router);

    return authService.currentUser$.pipe(
        take(1),
        map((user) => {
            if (!user) return true;
            return router.createUrlTree(['/home']);
        }),
    );
};

export const unsavedChangesGuard: CanDeactivateFn<AccountSettingsComponent> = (component) => {
    if (component.leavingConfirmed) {
        return true;
    }
    if (component.hasUnsavedChanges()) {
        component.showUnsavedDialog = true;
        return false;
    }
    return true;
};
