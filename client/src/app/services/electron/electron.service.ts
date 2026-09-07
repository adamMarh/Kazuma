import { Injectable } from '@angular/core';

interface IpcRenderer {
    send(channel: string, ...args: unknown[]): void;
    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void;
    removeAllListeners(channel: string): void;
}

interface ElectronWindow extends Window {
    require: (module: string) => { ipcRenderer: IpcRenderer };
}

@Injectable({ providedIn: 'root' })
export class ElectronService {
    private ipcRenderer: IpcRenderer | null = null;

    constructor() {
        if (this.isElectron) {
            this.ipcRenderer = (window as ElectronWindow).require('electron').ipcRenderer;
        }
    }

    get isElectron(): boolean {
        return typeof window !== 'undefined' && typeof (window as ElectronWindow).require === 'function';
    }

    send(channel: string, ...args: unknown[]): void {
        this.ipcRenderer?.send(channel, ...args);
    }

    on(channel: string, listener: (event: unknown, ...args: unknown[]) => void): void {
        this.ipcRenderer?.on(channel, listener);
    }

    removeAllListeners(channel: string): void {
        this.ipcRenderer?.removeAllListeners(channel);
    }
}
