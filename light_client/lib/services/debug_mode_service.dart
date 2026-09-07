import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/socket_service.dart';
import 'package:sensors_plus/sensors_plus.dart';

class DebugModeService extends ChangeNotifier {
  final SocketService _socketService;
  final GameService _gameService;

  StreamSubscription<AccelerometerEvent>? _accelSubscription;

  String? debugMessage;

  final List<DateTime> _shakeTimestamps = [];

  static const int _requiredShakes = 3;
  static const Duration _shakeWindow = Duration(milliseconds: 1800);
  static const double _shakeThreshold = 2.5;

  DateTime? _lastShakeEvent;
  static const Duration _shakeCooldown = Duration(milliseconds: 400);

  Timer? _messageDismissTimer;

  DebugModeService({
    required SocketService socketService,
    required GameService gameService,
  }) : _socketService = socketService,
       _gameService = gameService {
    _registerListeners();
    _gameService.gameClearedStream.listen((_) => _clearState());
  }

  bool get isDebugMode => _gameService.activeGame?.isInDebugMode ?? false;

  void _registerListeners() {
    _socketService.on(GameEvents.debug, (data) {
      if (data is Map) {
        final msg = data['message']?.toString();
        if (msg != null) {
          debugMessage = msg;
          notifyListeners();

          _messageDismissTimer?.cancel();
          if (!isDebugMode) {
            _messageDismissTimer = Timer(const Duration(seconds: 3), () {
              debugMessage = null;
              notifyListeners();
            });
          }
        }
      }
    });
  }

  void startShakeDetection(BuildContext context) {
    if (!context.mounted) return;
    stopShakeDetection();
    final orientation = MediaQuery.of(context).orientation;
    _accelSubscription = accelerometerEventStream().listen((event) {
      _handleAccelerometerEvent(event, orientation);
    });
  }

  void stopShakeDetection() {
    _accelSubscription?.cancel();
    _accelSubscription = null;
    _shakeTimestamps.clear();
  }

  void _handleAccelerometerEvent(
    AccelerometerEvent event,
    Orientation orientation,
  ) {
    if (_gameService.myPlayer?.isAdmin != true) return;
    if (_gameService.currentGameId == null) return;

    final now = DateTime.now();
    if (_lastShakeEvent != null &&
        now.difference(_lastShakeEvent!) < _shakeCooldown) {
      return;
    }

    final double magnitude =
        sqrt(event.x * event.x + event.y * event.y + event.z * event.z) - 9.81;
    if (magnitude.abs() <= _shakeThreshold) return;

    final double absX = event.x.abs();
    final double absY = event.y.abs();
    final double absZ = event.z.abs();

    final double horizontalAxis = (orientation == Orientation.portrait)
        ? absX
        : absY;
    final double verticalAxis = (orientation == Orientation.portrait)
        ? absY
        : absX;

    if (horizontalAxis <= verticalAxis || horizontalAxis <= absZ) return;

    _lastShakeEvent = now;

    _shakeTimestamps.removeWhere((ts) => now.difference(ts) > _shakeWindow);
    _shakeTimestamps.add(now);

    if (_shakeTimestamps.length >= _requiredShakes) {
      _shakeTimestamps.clear();
      _toggleDebug();
    }
  }

  void _toggleDebug() {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emit(GameEvents.debug, {'gameId': gameId});
  }

  void teleportToTile(Position targetPos) {
    final game = _gameService.activeGame;
    if (game == null || !game.isInDebugMode) return;

    final gameId = _gameService.currentGameId;
    if (gameId == null) return;

    final myPlayer = game.players.cast<Player?>().firstWhere(
      (p) => p != null && p.socketId == _gameService.myPlayer?.socketId,
      orElse: () => null,
    );
    if (myPlayer == null || !myPlayer.isMyTurn) return;

    _socketService.emit(GameEvents.rightClick, {
      'position': targetPos.toMap(),
      'gameId': gameId,
      'myPlayer': {
        'socketId': myPlayer.socketId,
        'name': myPlayer.name,
        'avatar': myPlayer.avatar,
        'speed': myPlayer.speed,
        'defense': myPlayer.defense,
        'attack': myPlayer.attack,
        'healthpoints': myPlayer.healthpoints,
        'position': myPlayer.position.toMap(),
        'startPosition': myPlayer.startPosition?.toMap(),
        'fleeAttempts': myPlayer.fleeAttempts,
        'battlesWon': myPlayer.battlesWon,
        'inventory': myPlayer.inventory,
        'isInventoryFull': myPlayer.isInventoryFull,
        'isAdmin': myPlayer.isAdmin,
        'hasLeft': myPlayer.hasLeft,
        'dice': myPlayer.dice,
        'isMyTurn': myPlayer.isMyTurn,
        'movementPoints': myPlayer.movementPoints,
        'actionPoints': myPlayer.actionPoints,
        'isBot': myPlayer.isBot,
        'isAgressive': myPlayer.isAgressive,
        'isFlagHolder': myPlayer.isFlagHolder,
      },
    });
  }

  void _clearState() {
    debugMessage = null;
    _shakeTimestamps.clear();
    _messageDismissTimer?.cancel();
    notifyListeners();
  }

  @override
  void dispose() {
    stopShakeDetection();
    _messageDismissTimer?.cancel();
    _socketService.off(GameEvents.debug);
    super.dispose();
  }
}
