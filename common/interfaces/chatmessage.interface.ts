export interface ChatMessage {
    author: string;
    uid?: string;
    content: string;
    timestamp: string;
    gameId: string;
    fromLobby?: boolean;
}
