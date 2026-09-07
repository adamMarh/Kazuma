import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/movement_service.dart';
import 'package:light_client/services/socket_service.dart';

class TurnService extends ChangeNotifier {
  final SocketService _socketService;
  final GameService _gameService;
  final MovementService _movementService;

  int _turnTimer = 30;
  int _preTimer = 0;
  bool _isPreTimer = false;

  String? _pendingFirstTurnPlayerId;
  bool _gameStartTurnAcknowledged = false;

  int get turnTimer => _turnTimer;
  int get preTimer => _preTimer;
  bool get isPreTimer => _isPreTimer;

  final _turnAnnouncementCtrl = StreamController<String>.broadcast();
  Stream<String> get turnAnnouncementStream => _turnAnnouncementCtrl.stream;

  TurnService({
    required SocketService socketService,
    required GameService gameService,
    required MovementService movementService,
  }) : _socketService = socketService,
       _gameService = gameService,
       _movementService = movementService {
    _registerListeners();
    _gameService.gameClearedStream.listen((_) => _clearState());
    _gameService.activeGameUpdatedStream.listen((_) => _onActiveGameUpdated());
    // Process any game state that was set before this service was created.
    // The activeGameUpdatedStream event from _applyLobbyUpdate fires before
    // this lazy-instantiated service exists, so the initial broadcast is lost.
    _onActiveGameUpdated();
  }

  void _registerListeners() {
    _socketService.on(GameEvents.playerTurnChanged, (data) {
      if (data == null) return;
      final String currentPlayerId = data.toString();

      if (_gameService.activeGame == null) {
        _pendingFirstTurnPlayerId = currentPlayerId;
        notifyListeners();
        return;
      }

      _processTurnChanged(currentPlayerId);
      notifyListeners();
    });

    _socketService.on(GameEvents.preTimerStarted, (_) {
      _isPreTimer = true;
      _preTimer = 3;
      _movementService.clearMovements();
      _generateTurnAnnouncement();
      notifyListeners();
    });

    _socketService.on(GameEvents.preTimerTick, (data) {
      if (data is Map && data['secondsRemaining'] != null) {
        _preTimer = int.tryParse(data['secondsRemaining'].toString()) ?? 0;
      } else if (data is int) {
        _preTimer = data;
      }
      if (_preTimer <= 0) {
        _isPreTimer = false;
      }
      notifyListeners();
    });

    _socketService.on(GameEvents.preTimerEnded, (_) {
      _isPreTimer = false;
      notifyListeners();
    });

    _socketService.on(GameEvents.turnTimerTick, (data) {
      if (data is Map && data['secondsRemaining'] != null) {
        _turnTimer =
            int.tryParse(data['secondsRemaining'].toString()) ?? _turnTimer;
      } else if (data is int) {
        _turnTimer = data;
      } else {
        final parsed = int.tryParse(data?.toString() ?? '');
        if (parsed != null) _turnTimer = parsed;
      }
      notifyListeners();
    });

    _socketService.on(GameEvents.turnTimerStarted, (data) {
      _isPreTimer = false;
      if (data is Map && data['secondsRemaining'] != null) {
        _turnTimer = int.tryParse(data['secondsRemaining'].toString()) ?? 30;
      } else {
        _turnTimer = 30;
      }
      notifyListeners();
    });
  }

  void _onActiveGameUpdated() {
    if (_pendingFirstTurnPlayerId != null) {
      final pendingId = _pendingFirstTurnPlayerId!;
      _pendingFirstTurnPlayerId = null;
      _processTurnChanged(pendingId);
    }

    if (!_gameStartTurnAcknowledged) {
      final game = _gameService.activeGame;
      final myPlayer = _gameService.myPlayer;
      if (game != null && game.started && !game.ended && myPlayer != null) {
        final firstTurnPlayer = game.players.cast<Player?>().firstWhere(
          (p) => p != null && p.isMyTurn && !p.hasLeft,
          orElse: () => null,
        );
        if (firstTurnPlayer != null &&
            firstTurnPlayer.socketId == myPlayer.socketId) {
          _gameStartTurnAcknowledged = true;
          _processTurnChanged(firstTurnPlayer.socketId);
        }
      }
    }
  }

  void _processTurnChanged(String currentPlayerId) {
    final game = _gameService.activeGame;
    if (game == null) return;

    for (var i = 0; i < game.players.length; i++) {
      game.players[i].isMyTurn = game.players[i].socketId == currentPlayerId;
    }

    _gameStartTurnAcknowledged = true;
    _gameService.notifyChanged();

    _generateTurnAnnouncement();

    final myPlayer = _gameService.myPlayer;
    if (myPlayer != null && currentPlayerId == myPlayer.socketId) {
      _changeTurn();
      _movementService.fetchPossibleMovements();
    }
  }

  void _changeTurn() {
    final gameId = _gameService.currentGameId;
    if (gameId != null) {
      _socketService.emit(GameEvents.clientTurnResponse, {'gameId': gameId});
    }
  }

  void _generateTurnAnnouncement() {
    final game = _gameService.activeGame;
    if (game == null) return;
    final currentPlayer = game.players.cast<Player?>().firstWhere(
      (p) => p != null && p.isMyTurn && !p.hasLeft,
      orElse: () => null,
    );
    if (currentPlayer == null) return;
    final myPlayer = _gameService.myPlayer;
    final isMe =
        myPlayer != null && currentPlayer.socketId == myPlayer.socketId;
    final message = isMe
        ? "C'est votre tour !"
        : "C'est le tour de ${currentPlayer.name}";
    _turnAnnouncementCtrl.add(message);
  }

  void passTurn() {
    final gameId = _gameService.currentGameId;
    if (gameId != null) {
      _movementService.clearMovements();
      _socketService.emit(GameEvents.skipTurn, {'gameId': gameId});
    }
  }

  void _clearState() {
    _turnTimer = 30;
    _preTimer = 0;
    _isPreTimer = false;
    _pendingFirstTurnPlayerId = null;
    _gameStartTurnAcknowledged = false;
    notifyListeners();
  }

  @override
  void dispose() {
    for (final event in [
      GameEvents.playerTurnChanged,
      GameEvents.preTimerStarted,
      GameEvents.preTimerTick,
      GameEvents.preTimerEnded,
      GameEvents.turnTimerTick,
      GameEvents.turnTimerStarted,
    ]) {
      _socketService.off(event);
    }
    _turnAnnouncementCtrl.close();
    super.dispose();
  }
}
