import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/socket_service.dart';

class CombatEvents {
  static const String initCombat = 'initCombat';
  static const String combatStarted = 'combatStarted';
  static const String playersInCombat = 'playersInCombat';
  static const String attack = 'attack';
  static const String combatStateUpdate = 'playerAttacked';
  static const String attemptFlee = 'attemptFlee';
  static const String endCombat = 'endCombat';
  static const String combatEnded = 'combatEnded';
  static const String attackOpponent = 'attackOpponent';
  static const String opponentAttacked = 'opponentAttacked';
  static const String turnChanged = 'combatTurnChanged';
  static const String error = 'error';
  static const String startTimer = 'startTimer';
  static const String resetTimer = 'pauseTimer';
  static const String timerState = 'timerValue';
  static const String navigation = 'navigation';
}

class CombatService extends ChangeNotifier {
  final SocketService _socketService;
  final GameService _gameService;

  CombatState? _combatState;
  bool _inCombat = false;
  int _combatTimer = 5;
  bool _combatTimerRunning = false;
  Timer? _combatCountdownTimer;
  String? _combatTimerTargetId;
  final Map<String, int> _defaultHp = {};

  CombatState? get combatState => _combatState;
  bool get inCombat => _inCombat;
  int get combatTimer => _combatTimer;
  bool get combatTimerRunning => _combatTimerRunning;
  Map<String, int> get defaultHp => Map.unmodifiable(_defaultHp);

  final _combatEndedCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _itemEffectCtrl = StreamController<Map<String, dynamic>>.broadcast();

  Stream<Map<String, dynamic>> get combatEndedStream => _combatEndedCtrl.stream;
  Stream<Map<String, dynamic>> get itemEffectStream => _itemEffectCtrl.stream;

  CombatService({
    required SocketService socketService,
    required GameService gameService,
  }) : _socketService = socketService,
       _gameService = gameService {
    _registerListeners();
    _gameService.gameClearedStream.listen((_) => _clearState());
  }

  void _registerListeners() {
    _socketService.on(CombatEvents.combatStarted, (data) {
      if (data is Map) {
        final raw = Map<String, dynamic>.from(data);
        final csRaw = raw['combatState'] ?? raw;
        _combatState = CombatState.fromMap(Map<String, dynamic>.from(csRaw));

        final activeGame = _gameService.activeGame;
        if (activeGame != null) {
          for (final p in activeGame.players) {
            _defaultHp[p.socketId] = p.healthpoints;
          }
        }

        final myId = _gameService.myPlayer?.socketId;
        final isParticipant =
            _combatState!.attacker?.socketId == myId ||
            _combatState!.target?.socketId == myId;

        // A player is an eliminated spectator if fast elimination is active and
        // they appear in eliminatedPlayers OR have isEliminated set on their Player
        // object in the active players list (double-guard against stale state).
        final isEliminatedSpectator =
            activeGame != null &&
            activeGame.fastEliminationActive &&
            (activeGame.eliminatedPlayers.any((p) => p.socketId == myId) ||
                activeGame.players.any(
                  (p) => p.socketId == myId && p.isEliminated,
                ));

        if (isParticipant || isEliminatedSpectator) {
          _inCombat = true;

          final game = _gameService.activeGame;
          if (game != null && !game.ended && isParticipant) {
            startCombatTimer();
          }
        }
        notifyListeners();
      }
    });

    _socketService.on(CombatEvents.combatStateUpdate, (data) {
      if (data is Map) {
        final raw = Map<String, dynamic>.from(data);
        final csRaw = raw['combatState'] ?? raw;
        _combatState = CombatState.fromMap(Map<String, dynamic>.from(csRaw));
        notifyListeners();
      }
    });

    _socketService.on(CombatEvents.turnChanged, (_) {
      _stopCombatCountdown();

      final game = _gameService.activeGame;
      if (game != null && !game.ended) {
        startCombatTimer();
      }
    });

    _socketService.on(CombatEvents.timerState, (data) {
      if (data is Map) {
        final delay = int.tryParse(data['delay']?.toString() ?? '') ?? 5;
        final started = data['timerStarted'] == true;
        final targetPlayer = data['targetPlayer'];
        if (targetPlayer is Map) {
          _combatTimerTargetId = targetPlayer['socketId']?.toString();
        }
        if (started) {
          _startCombatCountdown(delay);
        }
      }
    });

    _socketService.on(CombatEvents.combatEnded, (data) {
      _stopCombatCountdown();
      _inCombat = false;

      Map<String, dynamic> payload = {};
      if (data is Map) {
        payload = Map<String, dynamic>.from(data);
      }
      _combatEndedCtrl.add(payload);
      _combatState = null;
      _defaultHp.clear();

      if (payload['gameEnded'] == true) {
        _gameService.triggerEndGame();
      }
      notifyListeners();
    });

    _socketService.on('itemEffectApplied', (data) {
      if (data is Map) {
        _itemEffectCtrl.add(Map<String, dynamic>.from(data));
      }
    });
  }

  void attackOpponent(String targetSocketId) {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emit(CombatEvents.attackOpponent, {
      'gameId': gameId,
      'targetPlayer': targetSocketId,
    });
  }

  void attemptFlee() {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emit(CombatEvents.attemptFlee, {'gameId': gameId});
  }

  void startCombatTimer() {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emit(CombatEvents.startTimer, {'gameId': gameId});
  }

  void _startCombatCountdown(int delay) {
    _stopCombatCountdown();
    _combatTimer = delay;
    _combatTimerRunning = true;
    notifyListeners();

    _combatCountdownTimer = Timer.periodic(const Duration(seconds: 1), (_) {
      _combatTimer--;
      if (_combatTimer <= 0) {
        _stopCombatCountdown();

        final myId = _gameService.myPlayer?.socketId;
        final activeGame = _gameService.activeGame;
        final isEliminated =
            activeGame != null &&
            activeGame.eliminatedPlayers.any((p) => p.socketId == myId);

        if (_combatTimerTargetId != null &&
            _combatState != null &&
            !isEliminated) {
          attackOpponent(_combatTimerTargetId!);
        }
      }
      notifyListeners();
    });
  }

  void _stopCombatCountdown() {
    _combatCountdownTimer?.cancel();
    _combatCountdownTimer = null;
    _combatTimerRunning = false;
  }

  void _clearState() {
    _combatState = null;
    _inCombat = false;
    _defaultHp.clear();
    _stopCombatCountdown();
    notifyListeners();
  }

  @override
  void dispose() {
    for (final event in [
      CombatEvents.combatStarted,
      CombatEvents.combatStateUpdate,
      CombatEvents.combatEnded,
      CombatEvents.turnChanged,
      CombatEvents.timerState,
      'itemEffectApplied',
    ]) {
      _socketService.off(event);
    }
    _stopCombatCountdown();
    _combatEndedCtrl.close();
    _itemEffectCtrl.close();
    super.dispose();
  }
}
