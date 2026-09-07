/* eslint-disable @typescript-eslint/no-magic-numbers */
export const MOCK_TIMER_STARTED = {
    timerStarted: true,
    timerPaused: false,
    delay: 10,
    targetPlayer: 'player123',
};

export const MOCK_TIMER_PAUSED = {
    timerStarted: false,
    timerPaused: true,
    delay: 0,
    targetPlayer: 'player123',
};

export const TEST_PLAYER_ID = '1234';
export const TIMER_DELAY = 10;
export const CORRECT_TIME = 30;
export const TIMER_PAUSED_DELAY = 0;
export const COMBAT_END_TIMEOUT = 3000;
