import 'package:flutter/material.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/socket_service.dart';

class MovementEvents {
  static const String getMovements = 'getPossibleMovements';
  static const String getPath = 'shortestPath';
  static const String playerMoved = 'onPlayerMoved';
  static const String startTimer = 'startTimer';
  static const String turnChanged = 'turnChanged';
  static const String info = 'getInfo';
  static const String doorOpen = 'doorOpen';
}

class MovementService extends ChangeNotifier {
  final SocketService _socketService;
  final GameService _gameService;

  List<Position> _possibleMovements = [];
  List<Position> _shortestPath = [];

  List<Position> get possibleMovements => List.unmodifiable(_possibleMovements);
  List<Position> get shortestPath => List.unmodifiable(_shortestPath);

  MovementService({
    required SocketService socketService,
    required GameService gameService,
  }) : _socketService = socketService,
       _gameService = gameService {
    _registerListeners();
    _gameService.gameClearedStream.listen((_) => _clearState());
  }

  void _registerListeners() {
    _socketService.on(MovementEvents.playerMoved, (_) {
      notifyListeners();
    });

    _socketService.on(GameEvents.actionEnded, (data) {
      if (data is Map) {
        final rawPath = data['path'];
        final actionPlayer = data['player'];
        final playerId = (actionPlayer is Map)
            ? actionPlayer['socketId']?.toString() ?? ''
            : '';

        List<Position>? pathPositions;
        if (rawPath is List && rawPath.isNotEmpty) {
          pathPositions = rawPath
              .whereType<Map>()
              .map((m) => Position.fromMap(Map<String, dynamic>.from(m)))
              .toList();
        }

        if (pathPositions != null &&
            pathPositions.isNotEmpty &&
            playerId.isNotEmpty) {
          _animatePlayerMovement(playerId, pathPositions);
        } else {
          final rawPlayers = data['players'];
          if (rawPlayers is List) {
            _rebuildPlayersFromList(rawPlayers);
          }
        }

        if (actionPlayer is Map && _gameService.myPlayer != null) {
          final actionSocketId = actionPlayer['socketId']?.toString() ?? '';
          if (actionSocketId == _gameService.myPlayer!.socketId) {
            fetchPossibleMovements();
          }
        }
      }
      notifyListeners();
    });
  }

  void fetchPossibleMovements() {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emitWithAck(
      MovementEvents.getMovements,
      {'gameId': gameId},
      ack: (data) {
        if (data is List) {
          _possibleMovements = data
              .whereType<Map>()
              .map((m) => Position.fromMap(Map<String, dynamic>.from(m)))
              .toList();
        } else {
          _possibleMovements = [];
        }
        notifyListeners();
      },
    );
  }

  void fetchShortestPath(Position targetPos) {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    final isValid = _possibleMovements.any(
      (pos) => pos.x == targetPos.x && pos.y == targetPos.y,
    );
    if (!isValid) {
      _shortestPath = [];
      notifyListeners();
      return;
    }
    _socketService.emitWithAck(
      MovementEvents.getPath,
      {'targetPos': targetPos.toMap(), 'gameId': gameId},
      ack: (data) {
        if (data is List) {
          _shortestPath = data
              .whereType<Map>()
              .map((m) => Position.fromMap(Map<String, dynamic>.from(m)))
              .toList();
        } else {
          _shortestPath = [];
        }
        notifyListeners();
      },
    );
  }

  void clearShortestPath() {
    if (_shortestPath.isNotEmpty) {
      _shortestPath = [];
      notifyListeners();
    }
  }

  /// Clears both [possibleMovements] and [shortestPath].
  /// Called by [TurnService] at the start of a pre-timer phase.
  void clearMovements() {
    _possibleMovements = [];
    _shortestPath = [];
    notifyListeners();
  }

  void sendAction(Position targetPos, bool isAction) {
    final gameId = _gameService.currentGameId;
    if (gameId == null) return;
    _socketService.emit(GameEvents.leftClick, {
      'targetPos': targetPos.toMap(),
      'isAction': isAction,
      'gameId': gameId,
    });
  }

  void _animatePlayerMovement(String playerId, List<Position> path) {
    final game = _gameService.activeGame;
    if (game == null || path.isEmpty) return;

    const durationPerStep = Duration(milliseconds: 150);
    int currentStep = 0;

    void animateStep() {
      final currentGame = _gameService.activeGame;
      if (currentGame == null) return;

      if (currentStep >= path.length) {
        final idx = currentGame.players.indexWhere(
          (p) => p.socketId == playerId,
        );
        if (idx != -1) {
          currentGame.players[idx].position = path.last;
          _gameService.notifyChanged();
        }
        return;
      }

      final idx = currentGame.players.indexWhere((p) => p.socketId == playerId);
      if (idx != -1) {
        currentGame.players[idx].position = path[currentStep];
        _gameService.notifyChanged();
      }

      currentStep++;
      if (currentStep < path.length) {
        Future.delayed(durationPerStep, animateStep);
      }
    }

    animateStep();
  }

  void _rebuildPlayersFromList(List<dynamic> rawPlayers) {
    final g = _gameService.activeGame;
    if (g == null) return;
    final newPlayers = rawPlayers
        .whereType<Map>()
        .map((m) => Player.fromMap(Map<String, dynamic>.from(m)))
        .toList();
    _gameService.setActiveGame(
      Game(
        gameId: g.gameId,
        players: newPlayers,
        map: g.map,
        isLocked: g.isLocked,
        dropInActive: g.dropInActive,
        fastEliminationActive: g.fastEliminationActive,
        started: g.started,
        ended: g.ended,
        maxPlayers: g.maxPlayers,
        playerTurns: g.playerTurns,
        inactivePlayers: g.inactivePlayers,
        eliminatedPlayers: g.eliminatedPlayers,
        currentPlayerIndex: g.currentPlayerIndex,
        startingPoints: g.startingPoints,
        selectedAvatars: g.selectedAvatars,
        isInDebugMode: g.isInDebugMode,
        startTime: g.startTime,
        endTime: g.endTime,
        teams: g.teams,
        winner: g.winner,
        doorsManipulated: g.doorsManipulated,
      ),
    );
  }

  void _clearState() {
    _possibleMovements = [];
    _shortestPath = [];
    notifyListeners();
  }

  @override
  void dispose() {
    _socketService.off(MovementEvents.playerMoved);
    _socketService.off(GameEvents.actionEnded);
    super.dispose();
  }
}
