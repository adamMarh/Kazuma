import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/socket_service.dart';

class LobbyEvents {
  static const String getGames = 'getGames';
  static const String updateGames = 'updateGames';
  static const String checkGameId = 'checkGameId';
  static const String joinRoom = 'joinRoom';
  static const String lockRoom = 'lockRoom';
  static const String unlockRoom = 'unlockRoom';
  static const String roomLocked = 'roomLocked';
  static const String roomUnlocked = 'roomUnlocked';
  static const String startGame = 'startGame';
  static const String gameStarted = 'gameStarted';
  static const String updateLobby = 'updateLobby';
  static const String kickPlayer = 'kickPlayer';
  static const String playerKicked = 'playerKicked';
  static const String cancelLobby = 'cancelLobby';
  static const String playerLeft = 'playerLeft';
  static const String quitGame = 'quitGame';
  static const String addBot = 'addBot';
  static const String activateDropIn = 'activateDropIn';
  static const String deactivateDropIn = 'deactivateDropIn';
  static const String activateFastElimination = 'activateFastElimination';
  static const String deactivateFastElimination = 'deactivateFastElimination';
  static const String selectAvatar = 'selectAvatar';
  static const String deselectAvatar = 'deselectAvatar';
  static const String createRoom = 'createRoom';
  static const String leavePending = 'leavePending';
  static const String error = 'error';
}

class ItemEvents {
  static const String chooseItem = 'chooseItem';
  static const String itemDropped = 'itemDropped';
  static const String itemEffectApplied = 'itemEffectApplied';
  static const String itemEffectRemoved = 'itemEffectRemoved';
}

class GameEvents {
  static const String actionEnded = 'actionEnded';
  static const String playerTurnChanged = 'turnChanged';
  static const String leftClick = 'leftClick';
  static const String rightClick = 'rightClick';
  static const String onError = 'onError';
  static const String debug = 'debug';
  static const String turnCountdown = 'turnCountdown';
  static const String clientTurnResponse = 'allo';
  static const String preTimerStarted = 'preTimerStarted';
  static const String preTimerTick = 'preTimerTick';
  static const String preTimerEnded = 'preTimerEnded';
  static const String turnTimerStarted = 'turnTimerStarted';
  static const String turnTimerTick = 'turnTimerTick';
  static const String skipTurn = 'skipTurn';
  static const String chooseItem = 'chooseItem';
  static const String itemChosen = 'itemChosen';
  static const String mapUpdated = 'mapUpdated';
  static const String log = 'log';
  static const String gameStarted = 'gameStarted';
}

class GameModel {
  final String gameId;
  final int playerCount;
  final String mapSize;
  final String mapName;
  final int entryFee;
  final bool isLocked;
  final bool dropInActive;
  final bool fastEliminationActive;
  final bool started;
  final bool ended;
  final int maxPlayers;

  final bool friendsOnly;
  final String creatorUid;

  GameModel({
    required this.gameId,
    required this.playerCount,
    required this.mapSize,
    required this.mapName,
    required this.entryFee,
    required this.isLocked,
    required this.dropInActive,
    required this.fastEliminationActive,
    required this.started,
    required this.ended,
    required this.maxPlayers,
    this.friendsOnly = false,
    this.creatorUid = '',
  });

  factory GameModel.fromMap(Map<dynamic, dynamic> map) {
    final players = map['players'];
    final playerCount = players is List ? players.length : 0;
    final mapData = map['map'];
    final mapSize = mapData is Map ? (mapData['size']?.toString() ?? '?') : '?';
    final mapName = mapData is Map ? (mapData['name']?.toString() ?? '') : '';

    return GameModel(
      gameId: map['gameId']?.toString() ?? '',
      playerCount: playerCount,
      mapSize: mapSize,
      mapName: mapName,
      entryFee: int.tryParse(map['entryFee']?.toString() ?? '') ?? 0,
      isLocked: map['isLocked'] == true,
      dropInActive: map['dropInActive'] == true,
      fastEliminationActive: map['fastEliminationActive'] == true,
      started: map['started'] == true,
      ended: map['ended'] == true,
      maxPlayers: int.tryParse(map['maxPlayers']?.toString() ?? '') ?? 0,
      friendsOnly: map['friendsOnly'] == true,
      creatorUid: map['creatorUid']?.toString() ?? '',
    );
  }
}

class PlayerModel {
  final String name;
  final String avatar;
  final String socketId;
  final bool isAdmin;
  final bool isBot;

  PlayerModel({
    required this.name,
    required this.avatar,
    required this.socketId,
    required this.isAdmin,
    required this.isBot,
  });

  factory PlayerModel.fromMap(Map<dynamic, dynamic> map) {
    return PlayerModel(
      name: map['name']?.toString() ?? '',
      avatar: map['avatar']?.toString() ?? '1',
      socketId: map['socketId']?.toString() ?? '',
      isAdmin: map['isAdmin'] == true,
      isBot: map['isBot'] == true,
    );
  }
}

class GameService extends ChangeNotifier {
  final SocketService _socketService;

  // ── Game list state ──────────────────────────────────────────────────────
  List<GameModel> _games = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<GameModel> get games => List.unmodifiable(_games);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  // ── Lobby / active game state ────────────────────────────────────────────
  Map<String, dynamic>? _currentGameRaw;
  GameModel? _currentGame;
  List<PlayerModel> _lobbyPlayers = [];
  PlayerModel? _myPlayer;
  bool _isLobbyLocked = false;
  bool _isDropInActive = false;
  String? _currentGameId;

  Map<String, dynamic>? get currentGameRaw => _currentGameRaw;
  GameModel? get currentGame => _currentGame;
  List<PlayerModel> get lobbyPlayers => List.unmodifiable(_lobbyPlayers);
  PlayerModel? get myPlayer => _myPlayer;
  bool get isLobbyLocked => _isLobbyLocked;
  bool get isDropInActive => _isDropInActive;
  String? get currentGameId => _currentGameId;

  // ── Active game (shared with sub-services) ───────────────────────────────
  Game? _activeGame;
  Game? get activeGame => _activeGame;

  // ── End-game stats ───────────────────────────────────────────────────────
  bool _loadStats = false;
  List<Map<String, dynamic>> _playerStats = [];
  Map<String, dynamic>? _globalStats;

  bool get loadStats => _loadStats;
  List<Map<String, dynamic>> get playerStats => List.unmodifiable(_playerStats);
  Map<String, dynamic>? get globalStats => _globalStats;

  // ── Streams ──────────────────────────────────────────────────────────────
  final _gameStartedCtrl = StreamController<void>.broadcast();
  final _playerKickedCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _lobbyCanceledCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _playerLeftCtrl = StreamController<void>.broadcast();
  final _errorCtrl = StreamController<Map<String, dynamic>>.broadcast();
  final _gameEndedCtrl = StreamController<void>.broadcast();

  /// Fired by [clearCurrentGame] so sub-services can reset their own state.
  final _gameClearedCtrl = StreamController<void>.broadcast();

  /// Fired each time [_applyLobbyUpdate] completes so [TurnService] can run
  /// its first-turn acknowledgement logic.
  final _activeGameUpdatedCtrl = StreamController<void>.broadcast();

  final _chooseItemCtrl = StreamController<Map<String, dynamic>>.broadcast();

  final _itemDroppedCtrl = StreamController<Map<String, dynamic>>.broadcast();

  final _itemEffectRemovedCtrl =
      StreamController<Map<String, dynamic>>.broadcast();

  final _itemEffectAppliedCtrl =
      StreamController<Map<String, dynamic>>.broadcast();

  Stream<void> get gameStartedStream => _gameStartedCtrl.stream;
  Stream<Map<String, dynamic>> get playerKickedStream =>
      _playerKickedCtrl.stream;
  Stream<Map<String, dynamic>> get lobbyCanceledStream =>
      _lobbyCanceledCtrl.stream;
  Stream<void> get playerLeftStream => _playerLeftCtrl.stream;
  Stream<Map<String, dynamic>> get errorStream => _errorCtrl.stream;
  Stream<void> get gameEndedStream => _gameEndedCtrl.stream;
  Stream<void> get gameClearedStream => _gameClearedCtrl.stream;
  Stream<void> get activeGameUpdatedStream => _activeGameUpdatedCtrl.stream;
  Stream<Map<String, dynamic>> get chooseItemStream => _chooseItemCtrl.stream;
  Stream<Map<String, dynamic>> get itemDroppedStream => _itemDroppedCtrl.stream;
  Stream<Map<String, dynamic>> get itemEffectRemovedStream =>
      _itemEffectRemovedCtrl.stream;
  Stream<Map<String, dynamic>> get itemEffectAppliedStream =>
      _itemEffectAppliedCtrl.stream;

  GameService({required SocketService socketService})
    : _socketService = socketService {
    _registerSocketListeners();
    _registerGameListeners();
  }

  // ── Helpers exposed for sub-services ────────────────────────────────────

  /// Allows sub-services to trigger a [GameService] UI rebuild after mutating
  /// shared mutable state (e.g. player positions inside [activeGame]).
  void notifyChanged() => notifyListeners();

  /// Replaces [activeGame] and notifies listeners. Used by [MovementService]
  /// when it rebuilds the players list from a server payload.
  void setActiveGame(Game? game) {
    _activeGame = game;
    notifyListeners();
  }

  /// Triggers an end-game flow. Called by [CombatService] when a combat
  /// payload includes `gameEnded == true`, and internally when the lobby
  /// update reports the game as ended.
  void triggerEndGame() {
    if (_loadStats) return;
    _loadStats = true;
    notifyListeners();
    _gameEndedCtrl.add(null);

    if (_currentGameId != null) {
      fetchEndGameStats(_currentGameId!);
      fetchEndGameGlobalStats(_currentGameId!);
    }
  }

  // ── Socket listeners ─────────────────────────────────────────────────────

  void _registerGameListeners() {
    _socketService.on(GameEvents.mapUpdated, (data) {
      if (data is Map && _activeGame != null) {
        final updatedMap = Map<String, dynamic>.from(data);
        _activeGame = Game(
          gameId: _activeGame!.gameId,
          players: _activeGame!.players,
          map: updatedMap,
          isLocked: _activeGame!.isLocked,
          dropInActive: _activeGame!.dropInActive,
          fastEliminationActive: _activeGame!.fastEliminationActive,
          started: _activeGame!.started,
          ended: _activeGame!.ended,
          maxPlayers: _activeGame!.maxPlayers,
          playerTurns: _activeGame!.playerTurns,
          inactivePlayers: _activeGame!.inactivePlayers,
          eliminatedPlayers: _activeGame!.eliminatedPlayers,
          currentPlayerIndex: _activeGame!.currentPlayerIndex,
          startingPoints: _activeGame!.startingPoints,
          selectedAvatars: _activeGame!.selectedAvatars,
          isInDebugMode: _activeGame!.isInDebugMode,
          startTime: _activeGame!.startTime,
          endTime: _activeGame!.endTime,
          teams: _activeGame!.teams,
          winner: _activeGame!.winner,
          doorsManipulated: _activeGame!.doorsManipulated,
        );
        notifyListeners();
      }
    });

    _socketService.on(GameEvents.onError, (data) {
      if (data is Map) {
        _errorCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on(ItemEvents.chooseItem, (data) {
      if (data is Map) {
        _chooseItemCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on(ItemEvents.itemDropped, (data) {
      if (data is Map) {
        _itemDroppedCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on(ItemEvents.itemEffectRemoved, (data) {
      if (data is Map) {
        _itemEffectRemovedCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on(ItemEvents.itemEffectApplied, (data) {
      if (data is Map) {
        _itemEffectAppliedCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on('end-game-stats', (data) {
      if (data is List) {
        _playerStats = data
            .whereType<Map>()
            .map((e) => Map<String, dynamic>.from(e))
            .toList();
        notifyListeners();
      }
    });

    _socketService.on('end-game-global-stats', (data) {
      if (data is Map) {
        _globalStats = Map<String, dynamic>.from(data);
        notifyListeners();
      }
    });

    _socketService.on('gameOverStats', (data) {
      if (data is Map) {
        final snapshot = Map<String, dynamic>.from(data);
        if (snapshot['playerStats'] is List) {
          _playerStats = (snapshot['playerStats'] as List)
              .whereType<Map>()
              .map((e) => Map<String, dynamic>.from(e))
              .toList();
        }
        if (snapshot['globalStats'] is Map) {
          _globalStats = Map<String, dynamic>.from(snapshot['globalStats']);
        }
        notifyListeners();
      }
    });
  }

  void _registerSocketListeners() {
    _socketService.on(LobbyEvents.updateGames, (data) {
      if (data is List) {
        _games = data
            .whereType<Map>()
            .map((g) => GameModel.fromMap(g))
            .toList();
        notifyListeners();
      }
    });

    _socketService.on(LobbyEvents.updateLobby, (data) {
      if (data is Map) {
        _applyLobbyUpdate(data);
      }
    });

    _socketService.on(LobbyEvents.gameStarted, (_) {
      _gameStartedCtrl.add(null);
    });

    _socketService.on(LobbyEvents.playerKicked, (data) {
      final msg = data is Map
          ? Map<String, dynamic>.from(data)
          : <String, dynamic>{'message': 'Vous avez été expulsé.'};
      _playerKickedCtrl.add(msg);
    });

    _socketService.on(LobbyEvents.cancelLobby, (data) {
      final msg = data is Map
          ? Map<String, dynamic>.from(data)
          : <String, dynamic>{'message': 'La partie a été annulée.'};
      _lobbyCanceledCtrl.add(msg);
    });

    _socketService.on(LobbyEvents.playerLeft, (_) {
      _playerLeftCtrl.add(null);
    });

    _socketService.on(LobbyEvents.roomLocked, (_) {
      _isLobbyLocked = true;
      if (_currentGameRaw != null) {
        _currentGameRaw!['isLocked'] = true;
        _currentGame = GameModel.fromMap(_currentGameRaw!);
      }
      notifyListeners();
    });

    _socketService.on(LobbyEvents.roomUnlocked, (_) {
      _isLobbyLocked = false;
      if (_currentGameRaw != null) {
        _currentGameRaw!['isLocked'] = false;
        _currentGame = GameModel.fromMap(_currentGameRaw!);
      }
      notifyListeners();
    });

    _socketService.on(LobbyEvents.error, (data) {
      final msg = data is Map
          ? Map<String, dynamic>.from(data)
          : <String, dynamic>{'message': data?.toString() ?? 'Erreur serveur.'};
      _errorCtrl.add(msg);
    });
  }

  void _applyLobbyUpdate(Map<dynamic, dynamic> data) {
    try {
      _currentGameRaw = Map<String, dynamic>.from(data);
      _currentGame = GameModel.fromMap(data);
      _activeGame = Game.fromMap(Map<String, dynamic>.from(data));
      _isLobbyLocked = data['isLocked'] == true;
      _isDropInActive = data['dropInActive'] == true;
      _currentGameId = _currentGame!.gameId;

      final rawPlayers = data['players'];
      if (rawPlayers is List) {
        _lobbyPlayers = rawPlayers
            .whereType<Map>()
            .map((p) => PlayerModel.fromMap(p))
            .toList();

        if (_myPlayer != null) {
          final updated = _lobbyPlayers.where(
            (p) => p.socketId == _myPlayer!.socketId,
          );
          if (updated.isNotEmpty) _myPlayer = updated.first;
        }
      }

      if (_activeGame != null && _activeGame!.ended && !_loadStats) {
        triggerEndGame();
      }

      notifyListeners();

      // Notify TurnService so it can handle first-turn acknowledgement.
      _activeGameUpdatedCtrl.add(null);
    } catch (e) {
      debugPrint('Error updating game state: $e');
    }
  }

  // ── Connection helper ────────────────────────────────────────────────────

  Future<void> _ensureConnected() async {
    if (!_socketService.isConnected) {
      await _socketService.connect();
    }
  }

  // ── Public API ───────────────────────────────────────────────────────────

  Future<void> getGames() async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      await _ensureConnected();
      final completer = Completer<List<GameModel>>();

      _socketService.emitWithAck(
        LobbyEvents.getGames,
        {},
        ack: (data) {
          if (data is List) {
            completer.complete(
              data.whereType<Map>().map((g) => GameModel.fromMap(g)).toList(),
            );
          } else if (data is Map && data['error'] != null) {
            completer.completeError(data['error'].toString());
          } else {
            completer.complete([]);
          }
        },
      );

      _games = await completer.future.timeout(const Duration(seconds: 10));
    } catch (e) {
      _errorMessage = 'Erreur lors de la récupération des parties.';
      debugPrint('getGames error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  void applyGameData(Map<String, dynamic> gameData) {
    _currentGameRaw = Map<String, dynamic>.from(gameData);
    _currentGame = GameModel.fromMap(gameData);
    _activeGame = Game.fromMap(_currentGameRaw!);
    _currentGameId = _currentGame!.gameId;
    notifyListeners();
  }

  Future<Map<String, dynamic>> checkGameId(
    String gameId, {
    String? joinerUid,
  }) async {
    await _ensureConnected();
    final completer = Completer<Map<String, dynamic>>();

    _socketService.emitWithAck(
      LobbyEvents.checkGameId,
      {'gameId': gameId, 'joinerUid': joinerUid},
      ack: (data) {
        if (data == null) {
          completer.completeError('Partie introuvable.');
          return;
        }
        if (data is Map) {
          if (data.containsKey('error')) {
            completer.completeError(data['error'].toString());
          } else if (data['blockConflict'] == true) {
            completer.completeError(
              'blockConflict:$gameId:${data['conflictUsers'] ?? []}',
            );
          } else {
            _currentGameRaw = Map<String, dynamic>.from(data);
            _currentGame = GameModel.fromMap(data);
            _activeGame = Game.fromMap(_currentGameRaw!);
            _currentGameId = _currentGame!.gameId;
            notifyListeners();
            completer.complete(_currentGameRaw!);
          }
        } else if (data is String) {
          completer.completeError(data);
        } else {
          completer.completeError('Réponse invalide du serveur.');
        }
      },
    );

    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => throw TimeoutException('Délai de connexion dépassé.'),
    );
  }

  Future<Map<String, dynamic>> createGame(
    String name,
    int avatar,
    Map<String, dynamic> mapData,
    Map<String, dynamic> attributes, {
    int entryFee = 0,
    bool friendsOnly = false,
    String creatorUid = '',
  }) async {
    await _ensureConnected();
    final completer = Completer<Map<String, dynamic>>();

    _socketService.emitWithAck(
      LobbyEvents.createRoom,
      {
        'name': name,
        'avatar': avatar,
        'map': mapData,
        'attributes': attributes,
        'entryFee': entryFee,
        'friendsOnly': friendsOnly,
        'creatorUid': creatorUid,
      },
      ack: (data) {
        if (data == null) {
          completer.completeError('Impossible de créer la partie.');
          return;
        }
        if (data is Map) {
          if (data.containsKey('error')) {
            completer.completeError(data['error'].toString());
          } else {
            final payload = Map<String, dynamic>.from(data);

            if (payload['game'] is Map) {
              _currentGameRaw = Map<String, dynamic>.from(
                payload['game'] as Map,
              );
              _currentGame = GameModel.fromMap(_currentGameRaw!);
              _activeGame = Game.fromMap(_currentGameRaw!);
              _currentGameId = _currentGame!.gameId;
              _isLobbyLocked = _currentGame!.isLocked;
              _isDropInActive = _currentGame!.dropInActive;

              final rawPlayers = _currentGameRaw!['players'];
              if (rawPlayers is List) {
                _lobbyPlayers = rawPlayers
                    .whereType<Map>()
                    .map((p) => PlayerModel.fromMap(p))
                    .toList();
              }
            }

            if (payload['myPlayer'] is Map) {
              _myPlayer = PlayerModel.fromMap(payload['myPlayer'] as Map);
            }

            notifyListeners();
            completer.complete(payload);
          }
        } else {
          completer.completeError('Réponse invalide du serveur.');
        }
      },
    );

    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => throw TimeoutException('Délai de connexion dépassé.'),
    );
  }

  Future<Map<String, dynamic>> joinGame(
    String gameId,
    String name,
    int avatar,
    Map<String, dynamic> attributes,
  ) async {
    await _ensureConnected();
    final completer = Completer<Map<String, dynamic>>();

    _socketService.emitWithAck(
      LobbyEvents.joinRoom,
      {
        'gameId': gameId,
        'name': name,
        'avatar': avatar,
        'attributes': attributes,
      },
      ack: (data) {
        if (data == null) {
          completer.completeError('Impossible de rejoindre la partie.');
          return;
        }
        if (data is Map) {
          if (data.containsKey('error')) {
            completer.completeError(data['error'].toString());
          } else {
            final payload = Map<String, dynamic>.from(data);

            if (payload['game'] is Map) {
              _currentGameRaw = Map<String, dynamic>.from(
                payload['game'] as Map,
              );
              _currentGame = GameModel.fromMap(_currentGameRaw!);
              _activeGame = Game.fromMap(_currentGameRaw!);
              _currentGameId = _currentGame!.gameId;
              _isLobbyLocked = _currentGame!.isLocked;
              _isDropInActive = _currentGame!.dropInActive;

              final rawPlayers = _currentGameRaw!['players'];
              if (rawPlayers is List) {
                _lobbyPlayers = rawPlayers
                    .whereType<Map>()
                    .map((p) => PlayerModel.fromMap(p))
                    .toList();
              }
            }

            if (payload['myPlayer'] is Map) {
              _myPlayer = PlayerModel.fromMap(payload['myPlayer'] as Map);
            }

            notifyListeners();
            completer.complete(payload);
          }
        } else {
          completer.completeError('Réponse invalide du serveur.');
        }
      },
    );

    return completer.future.timeout(
      const Duration(seconds: 10),
      onTimeout: () => throw TimeoutException('Délai de connexion dépassé.'),
    );
  }

  void lockRoom(String gameId) =>
      _socketService.emit(LobbyEvents.lockRoom, {'gameId': gameId});

  void unlockRoom(String gameId) =>
      _socketService.emit(LobbyEvents.unlockRoom, {'gameId': gameId});

  void activateDropIn(String gameId) =>
      _socketService.emit(LobbyEvents.activateDropIn, {'gameId': gameId});

  void deactivateDropIn(String gameId) =>
      _socketService.emit(LobbyEvents.deactivateDropIn, {'gameId': gameId});

  void activateFastElimination(String gameId) => _socketService.emit(
    LobbyEvents.activateFastElimination,
    {'gameId': gameId},
  );

  void deactivateFastElimination(String gameId) => _socketService.emit(
    LobbyEvents.deactivateFastElimination,
    {'gameId': gameId},
  );

  Future<void> kickPlayer(String targetSocketId, String gameId) async {
    await _ensureConnected();
    final c = Completer<void>();
    _socketService.emitWithAck(LobbyEvents.kickPlayer, {
      'targetSocketId': targetSocketId,
      'gameId': gameId,
    }, ack: (_) => c.complete());
    return c.future.timeout(const Duration(seconds: 5), onTimeout: () {});
  }

  Future<void> addBot({
    required bool isAgressive,
    required String gameId,
  }) async {
    await _ensureConnected();
    final c = Completer<void>();
    _socketService.emitWithAck(LobbyEvents.addBot, {
      'isAgressive': isAgressive,
      'gameId': gameId,
    }, ack: (_) => c.complete());
    return c.future.timeout(const Duration(seconds: 5), onTimeout: () {});
  }

  Future<bool> selectAvatar(String gameId, int avatar) async {
    await _ensureConnected();
    final c = Completer<bool>();
    _socketService.emitWithAck(
      LobbyEvents.selectAvatar,
      {'gameId': gameId, 'avatar': avatar},
      ack: (data) {
        if (data is Map && data['success'] == true) {
          c.complete(true);
        } else {
          c.complete(false);
        }
      },
    );
    return c.future.timeout(const Duration(seconds: 5), onTimeout: () => false);
  }

  Future<void> deselectAvatar(String gameId) async {
    await _ensureConnected();
    _socketService.emitWithAck(LobbyEvents.deselectAvatar, {
      'gameId': gameId,
    }, ack: (_) {});
  }

  void leavePendingRoom(String gameId) =>
      _socketService.emit(LobbyEvents.leavePending, gameId);

  Future<void> startGame(String gameId) async {
    await _ensureConnected();
    final c = Completer<void>();
    _socketService.emitWithAck(LobbyEvents.startGame, {
      'gameId': gameId,
    }, ack: (_) => c.complete());
    return c.future.timeout(const Duration(seconds: 10), onTimeout: () {});
  }

  Future<void> quitGame(String gameId) async {
    await _ensureConnected();
    final c = Completer<void>();
    _socketService.emitWithAck(LobbyEvents.quitGame, {
      'gameId': gameId,
    }, ack: (_) => c.complete());
    clearCurrentGame();
    return c.future.timeout(const Duration(seconds: 5), onTimeout: () {});
  }

  void fetchEndGameStats(String gameId) =>
      _socketService.emit('get-end-game-stats', {'gameId': gameId});

  void fetchEndGameGlobalStats(String gameId) =>
      _socketService.emit('get-end-game-global-stats', {'gameId': gameId});

  void dropItem({required Position position, required String itemType}) {
    final gameId = _currentGameId;
    if (gameId == null) return;
    _socketService.emit(ItemEvents.itemDropped, {
      'position': position.toMap(),
      'itemType': itemType,
      'gameId': gameId,
    });
  }

  void sortPlayerStats(String stat, bool ascending) {
    _playerStats.sort((a, b) {
      final va = a[stat];
      final vb = b[stat];
      if (va is num && vb is num) {
        return ascending ? va.compareTo(vb) : vb.compareTo(va);
      }
      return ascending
          ? va.toString().compareTo(vb.toString())
          : vb.toString().compareTo(va.toString());
    });
    notifyListeners();
  }

  void clearCurrentGame() {
    _currentGame = null;
    _currentGameRaw = null;
    _myPlayer = null;
    _lobbyPlayers = [];
    _currentGameId = null;
    _activeGame = null;
    _loadStats = false;
    _playerStats = [];
    _globalStats = null;
    notifyListeners();

    // Signal sub-services (CombatService, MovementService, TurnService) to
    // clear their own state.
    _gameClearedCtrl.add(null);
  }

  @override
  void dispose() {
    for (final event in [
      LobbyEvents.updateGames,
      LobbyEvents.updateLobby,
      LobbyEvents.gameStarted,
      LobbyEvents.playerKicked,
      LobbyEvents.cancelLobby,
      LobbyEvents.playerLeft,
      LobbyEvents.roomLocked,
      LobbyEvents.roomUnlocked,
      LobbyEvents.error,
      GameEvents.onError,
      GameEvents.mapUpdated,
      ItemEvents.chooseItem,
      ItemEvents.itemDropped,
      ItemEvents.itemEffectRemoved,
      ItemEvents.itemEffectApplied,
      'end-game-stats',
      'end-game-global-stats',
      'gameOverStats',
    ]) {
      _socketService.off(event);
    }
    _gameStartedCtrl.close();
    _playerKickedCtrl.close();
    _lobbyCanceledCtrl.close();
    _playerLeftCtrl.close();
    _errorCtrl.close();
    _gameEndedCtrl.close();
    _gameClearedCtrl.close();
    _activeGameUpdatedCtrl.close();
    _chooseItemCtrl.close();
    _itemDroppedCtrl.close();
    _itemEffectRemovedCtrl.close();
    _itemEffectAppliedCtrl.close();
    super.dispose();
  }
}
