int _parseInt(dynamic v) =>
    v is int ? v : int.tryParse(v?.toString() ?? '') ?? 0;

Map<String, int> _parseIntMap(dynamic raw, Map<String, int> fallback) {
  if (raw is! Map) return fallback;
  return raw.map((k, v) => MapEntry(k.toString(), _parseInt(v)));
}

class Position {
  final int x;
  final int y;

  Position({required this.x, required this.y});

  factory Position.fromMap(Map<String, dynamic> map) {
    return Position(x: _parseInt(map['x']), y: _parseInt(map['y']));
  }

  Map<String, dynamic> toMap() => {'x': x, 'y': y};

  @override
  bool operator ==(Object other) =>
      identical(this, other) ||
      other is Position &&
          runtimeType == other.runtimeType &&
          x == other.x &&
          y == other.y;

  @override
  int get hashCode => x.hashCode ^ y.hashCode;
}

class Player {
  final String socketId;
  final String name;
  final String avatar;
  final int speed;
  final int defense;
  final int attack;
  int healthpoints;
  Position position;
  final Position? startPosition;
  final int fleeAttempts;
  final int battlesWon;
  final List<String> inventory;
  final bool isInventoryFull;
  final bool isAdmin;
  final bool hasLeft;
  final bool isEliminated;
  final Map<String, int> dice;
  bool isMyTurn;
  final int movementPoints;
  final int actionPoints;
  final bool isBot;
  final bool isAgressive;
  final bool isFlagHolder;
  final bool hasFlagMusicOption;

  final int successfulFleeAttempts;
  final List<Position> visitedTiles;
  final int totalDamageDone;
  final int totalDamageTaken;
  final int turnsPlayed;
  final int combatsParticipated;
  final List<String> collectedUniqueItems;
  final int battlesLost;

  Player({
    required this.socketId,
    required this.name,
    required this.avatar,
    required this.speed,
    required this.defense,
    required this.attack,
    required this.healthpoints,
    required this.position,
    this.startPosition,
    required this.fleeAttempts,
    required this.battlesWon,
    required this.inventory,
    required this.isInventoryFull,
    this.isAdmin = false,
    this.hasLeft = false,
    this.isEliminated = false,
    required this.dice,
    required this.isMyTurn,
    required this.movementPoints,
    required this.actionPoints,
    this.isBot = false,
    this.isAgressive = false,
    this.isFlagHolder = false,
    this.hasFlagMusicOption = false,
    this.successfulFleeAttempts = 0,
    this.visitedTiles = const [],
    this.totalDamageDone = 0,
    this.totalDamageTaken = 0,
    this.turnsPlayed = 0,
    this.combatsParticipated = 0,
    this.collectedUniqueItems = const [],
    this.battlesLost = 0,
  });

  factory Player.fromMap(Map<String, dynamic> map) {
    return Player(
      socketId: map['socketId']?.toString() ?? '',
      name: map['name']?.toString() ?? '',
      avatar: map['avatar']?.toString() ?? '',
      speed: _parseInt(map['speed']),
      defense: _parseInt(map['defense']),
      attack: _parseInt(map['attack']),
      healthpoints: _parseInt(map['healthpoints']),
      position: Position.fromMap(
        Map<String, dynamic>.from(map['position'] ?? {'x': 0, 'y': 0}),
      ),
      startPosition: map['startPosition'] != null
          ? Position.fromMap(Map<String, dynamic>.from(map['startPosition']))
          : null,
      fleeAttempts: _parseInt(map['fleeAttempts']),
      battlesWon: _parseInt(map['battlesWon']),
      inventory:
          (map['inventory'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      isInventoryFull: map['isInventoryFull'] == true,
      isAdmin: map['isAdmin'] == true,
      hasLeft: map['hasLeft'] == true,
      isEliminated: map['isEliminated'] == true,
      dice: _parseIntMap(map['dice'], {'atk': 0, 'def': 0}),
      isMyTurn: map['isMyTurn'] == true,
      movementPoints: _parseInt(map['movementPoints']),
      actionPoints: _parseInt(map['actionPoints']),
      isBot: map['isBot'] == true,
      isAgressive: map['isAgressive'] == true,
      isFlagHolder: map['isFlagHolder'] == true,
      hasFlagMusicOption: map['hasFlagMusicOption'] == true,
      successfulFleeAttempts: _parseInt(map['successfulFleeAttempts']),
      visitedTiles:
          (map['visitedTiles'] as List<dynamic>?)
              ?.map((e) => Position.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          [],
      totalDamageDone: _parseInt(map['totalDamageDone']),
      totalDamageTaken: _parseInt(map['totalDamageTaken']),
      turnsPlayed: _parseInt(map['turnsPlayed']),
      combatsParticipated: _parseInt(map['combatsParticipated']),
      collectedUniqueItems:
          (map['collectedUniqueItems'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      battlesLost: _parseInt(map['battlesLost']),
    );
  }
}

class GameMap {
  final String? id;
  final String name;
  final String size;
  final String gameMode;
  final String description;
  final String? lastSave;
  final String imageUrl;
  final bool hidden;
  final List<List<String>> tiles;
  final List<List<String>> items;
  final String nbCheckpoints;
  final String nbRandomItems;
  final String owner;
  final String visibility;

  GameMap({
    this.id,
    required this.name,
    required this.size,
    required this.gameMode,
    required this.description,
    this.lastSave,
    required this.imageUrl,
    required this.hidden,
    required this.tiles,
    required this.items,
    required this.nbCheckpoints,
    required this.nbRandomItems,
    this.owner = '',
    this.visibility = 'public',
  });

  int get sizeAsInt => int.tryParse(size) ?? 10;

  factory GameMap.fromMap(Map<String, dynamic> map) {
    List<List<String>> parseTileGrid(dynamic raw) {
      if (raw == null || raw is! List) return [];
      return raw.map<List<String>>((row) {
        if (row is List) {
          return row.map<String>((t) => t?.toString() ?? 'empty').toList();
        }
        return <String>[];
      }).toList();
    }

    return GameMap(
      id: map['_id']?.toString(),
      name: map['name']?.toString() ?? '',
      size: map['size']?.toString() ?? '10',
      gameMode: map['gameMode']?.toString() ?? '',
      description: map['description']?.toString() ?? '',
      lastSave: map['lastSave']?.toString(),
      imageUrl: map['imageUrl']?.toString() ?? '',
      hidden: map['hidden'] == true,
      tiles: parseTileGrid(map['tiles']),
      items: parseTileGrid(map['items']),
      nbCheckpoints: map['nbCheckpoints']?.toString() ?? '0',
      nbRandomItems: map['nbRandomItems']?.toString() ?? '0',
      owner: map['owner']?.toString() ?? '',
      visibility: map['visibility']?.toString() ?? 'public',
    );
  }
}

class CombatState {
  final dynamic currentTurn;
  final Player? attacker;
  final Player? target;
  final bool inCombat;
  final Map<String, int> attackResult;
  final Player? combatInitiator;
  final bool hourglassConsumed;
  final bool potionConsumed;
  final List<Player>? players;
  final bool combatAlreadyCounted;

  CombatState({
    this.currentTurn,
    this.attacker,
    this.target,
    required this.inCombat,
    required this.attackResult,
    this.combatInitiator,
    this.hourglassConsumed = false,
    this.potionConsumed = false,
    this.players,
    this.combatAlreadyCounted = false,
  });

  factory CombatState.fromMap(Map<String, dynamic> map) {
    return CombatState(
      currentTurn: map['currentTurn'],
      attacker: map['attacker'] != null
          ? Player.fromMap(Map<String, dynamic>.from(map['attacker']))
          : null,
      target: map['target'] != null
          ? Player.fromMap(Map<String, dynamic>.from(map['target']))
          : null,
      inCombat: map['inCombat'] == true,
      attackResult: _parseIntMap(map['attackResult'], {
        'damage': 0,
        'attackDiceRoll': 0,
        'defenseDiceRoll': 0,
      }),
      combatInitiator: map['combatInitiator'] != null
          ? Player.fromMap(Map<String, dynamic>.from(map['combatInitiator']))
          : null,
      hourglassConsumed: map['hourglassConsumed'] == true,
      potionConsumed: map['potionConsumed'] == true,
      players: (map['players'] as List<dynamic>?)
          ?.map((x) => Player.fromMap(Map<String, dynamic>.from(x)))
          .toList(),
      combatAlreadyCounted: map['combatAlreadyCounted'] == true,
    );
  }
}

class Game {
  final String gameId;
  final List<Player> players;
  final Map<String, dynamic> map;
  final bool isLocked;
  final bool dropInActive;
  final bool fastEliminationActive;
  final bool started;
  final bool ended;
  final int maxPlayers;
  final List<String> playerTurns;
  final List<Player> inactivePlayers;
  final List<Player> eliminatedPlayers;
  final int currentPlayerIndex;
  final List<Position> startingPoints;
  final Map<String, int> selectedAvatars;
  final bool isInDebugMode;
  final String? startTime;
  final String? endTime;
  final Map<String, List<String>> teams;
  final String winner;
  final List<String>? doorsManipulated;
  final int entryFee;
  final int pot;

  Game({
    required this.gameId,
    required this.players,
    required this.map,
    required this.isLocked,
    this.dropInActive = false,
    this.fastEliminationActive = false,
    required this.started,
    required this.ended,
    required this.maxPlayers,
    required this.playerTurns,
    required this.inactivePlayers,
    required this.eliminatedPlayers,
    required this.currentPlayerIndex,
    this.startingPoints = const [],
    this.selectedAvatars = const {},
    this.isInDebugMode = false,
    this.startTime,
    this.endTime,
    this.teams = const {'red': [], 'blue': []},
    this.winner = '',
    this.doorsManipulated,
    this.entryFee = 0,
    this.pot = 0,
  });

  factory Game.fromMap(Map<String, dynamic> map) {
    Map<String, List<String>> parseTeams(dynamic raw) {
      if (raw is! Map) return {'red': <String>[], 'blue': <String>[]};
      final m = Map<String, dynamic>.from(raw);
      return {
        'red':
            (m['red'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
            [],
        'blue':
            (m['blue'] as List<dynamic>?)?.map((e) => e.toString()).toList() ??
            [],
      };
    }

    Map<String, int> parseSelectedAvatars(dynamic raw) {
      if (raw is! Map) return {};
      return raw.map((k, v) => MapEntry(k.toString(), _parseInt(v)));
    }

    return Game(
      gameId: map['gameId']?.toString() ?? '',
      players:
          (map['players'] as List<dynamic>?)
              ?.map((e) => Player.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          [],
      map: Map<String, dynamic>.from(map['map'] ?? {}),
      isLocked: map['isLocked'] == true,
      dropInActive: map['dropInActive'] == true,
      fastEliminationActive: map['fastEliminationActive'] == true,
      started: map['started'] == true,
      ended: map['ended'] == true,
      maxPlayers: _parseInt(map['maxPlayers']),
      playerTurns:
          (map['playerTurns'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .toList() ??
          [],
      inactivePlayers:
          (map['inactivePlayers'] as List<dynamic>?)
              ?.map((e) => Player.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          [],
      eliminatedPlayers:
          (map['eliminatedPlayers'] as List<dynamic>?)
              ?.map((e) => Player.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          [],
      currentPlayerIndex: _parseInt(map['currentPlayerIndex']),
      startingPoints:
          (map['startingPoints'] as List<dynamic>?)
              ?.map((e) => Position.fromMap(Map<String, dynamic>.from(e)))
              .toList() ??
          [],
      selectedAvatars: parseSelectedAvatars(map['selectedAvatars']),
      isInDebugMode: map['isInDebugMode'] == true,
      startTime: map['startTime']?.toString(),
      endTime: map['endTime']?.toString(),
      teams: parseTeams(map['teams']),
      winner: map['winner']?.toString() ?? '',
      doorsManipulated: (map['doorsManipulated'] as List<dynamic>?)
          ?.map((e) => e.toString())
          .toList(),
      entryFee: _parseInt(map['entryFee']),
      pot: _parseInt(map['pot']),
    );
  }
}
