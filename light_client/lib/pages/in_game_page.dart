import 'dart:async';
import 'dart:math' show min;

import 'package:flutter/material.dart';
import 'package:light_client/components/chat_room.dart';
import 'package:light_client/components/combat_view.dart';
import 'package:light_client/components/end_game_view.dart';
import 'package:light_client/components/map_view.dart';
import 'package:light_client/config/asset_constants.dart';
import 'package:light_client/models/challenge_models.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/challenge_service.dart';
import 'package:light_client/services/combat_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/debug_mode_service.dart';
import 'package:light_client/services/game_audio_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/movement_service.dart';
import 'package:light_client/services/turn_service.dart';
import 'package:provider/provider.dart';

class InGamePage extends StatefulWidget {
  const InGamePage({super.key});

  @override
  State<InGamePage> createState() => _InGamePageState();
}

class _InGamePageState extends State<InGamePage> {
  bool _isAction = false;
  bool _showTurnAnnouncement = false;
  String _turnMessage = '';
  Position? _selectedTile;
  StreamSubscription<String>? _turnAnnouncementSub;
  StreamSubscription<Map<String, dynamic>>? _errorSub;
  StreamSubscription<Map<String, dynamic>>? _combatEndedSub;
  StreamSubscription<Map<String, dynamic>>? _chooseItemSub;
  StreamSubscription<Map<String, dynamic>>? _itemDroppedSub;
  StreamSubscription<Map<String, dynamic>>? _itemEffectAppliedSub;
  StreamSubscription<Map<String, dynamic>>? _itemEffectRemovedSub;

  String _combatResultMessage = '';
  bool _showCombatResult = false;
  bool _combatResultIsWin = false;
  Timer? _combatResultTimer;

  bool _chooseItemVisible = false;
  List<Map<String, String>> _itemsToChoose = [];
  Position? _encounteredItemPosition;

  String _itemEffectMessage = '';
  bool _showItemEffectMessage = false;
  Timer? _itemEffectTimer;

  late final GameService _gameService;
  late final CombatService _combatService;
  late final MovementService _movementService;
  late final TurnService _turnService;
  late final CurrencyService _currencyService;
  late final DebugModeService _debugModeService;

  @override
  void initState() {
    super.initState();
    _gameService = Provider.of<GameService>(context, listen: false);
    _combatService = Provider.of<CombatService>(context, listen: false);
    _movementService = Provider.of<MovementService>(context, listen: false);
    _turnService = Provider.of<TurnService>(context, listen: false);
    _currencyService = Provider.of<CurrencyService>(context, listen: false);
    _debugModeService = Provider.of<DebugModeService>(context, listen: false);

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      _currencyService.refreshWallet();
      _debugModeService.startShakeDetection(context);
    });

    _turnAnnouncementSub = _turnService.turnAnnouncementStream.listen((msg) {
      if (!mounted) return;
      setState(() {
        _turnMessage = msg;
        _showTurnAnnouncement = true;
      });
    });

    _combatEndedSub = _combatService.combatEndedStream.listen((data) {
      if (!mounted) return;
      final reason = data['reason']?.toString() ?? '';
      final actionPlayer = data['actionPlayer'];
      final myId = _gameService.myPlayer?.socketId;

      String actionName = '';
      bool isMe = false;
      if (actionPlayer is Map) {
        actionName = actionPlayer['name']?.toString() ?? '';
        isMe = actionPlayer['socketId']?.toString() == myId;
      }

      String msg = '';
      bool win = false;
      if (reason == 'death') {
        msg = isMe
            ? 'Vous avez gagné le combat !'
            : '$actionName a gagné le combat !';
        win = isMe;
      } else if (reason == 'fled') {
        msg = isMe ? 'Vous avez fui avec succès !' : '$actionName a fui !';
        win = false;
      }

      if (msg.isNotEmpty) {
        _combatResultTimer?.cancel();
        setState(() {
          _combatResultMessage = msg;
          _showCombatResult = true;
          _combatResultIsWin = win;
          _isAction = false;
        });
        _combatResultTimer = Timer(const Duration(seconds: 3), () {
          if (mounted) setState(() => _showCombatResult = false);
        });
      }
    });

    _errorSub = _gameService.errorStream.listen((data) {
      if (!mounted) return;
      final errorMessage =
          data['errorMessage']?.toString() ?? 'Erreur inconnue';
      final shouldRedirect = data['shouldRedirect'] == true;

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(errorMessage),
          duration: const Duration(seconds: 3),
        ),
      );

      if (shouldRedirect) {
        final gameId = _gameService.currentGameId;
        Timer(const Duration(seconds: 3), () {
          if (!mounted) return;
          if (gameId != null) {
            _gameService.quitGame(gameId).then((_) {
              if (mounted) Navigator.of(context).pushReplacementNamed('/home');
            });
          } else {
            Navigator.of(context).pushReplacementNamed('/home');
          }
        });
      }
    });

    _gameService.addListener(_onGameServiceChanged);
    _turnService.addListener(_onGameServiceChanged);
    _updateFlagMusicState(_gameService);

    _chooseItemSub = _gameService.chooseItemStream.listen((data) {
      if (!mounted) return;
      final itemData = data['item'];
      if (itemData is! Map) return;
      final posRaw = itemData['position'];
      final itemType = itemData['type']?.toString() ?? '';
      if (posRaw is! Map || itemType.isEmpty) return;

      final position = Position(
        x: int.tryParse(posRaw['x']?.toString() ?? '') ?? 0,
        y: int.tryParse(posRaw['y']?.toString() ?? '') ?? 0,
      );

      final player = _gameService.activeGame?.players
          .cast<Player?>()
          .firstWhere(
            (p) => p != null && p.socketId == _gameService.myPlayer?.socketId,
            orElse: () => null,
          );
      if (player == null) return;

      final inventoryItems = player.inventory
          .map((type) => {'type': type, 'description': _itemDescription(type)})
          .toList();
      final newItem = {
        'type': itemType,
        'description': _itemDescription(itemType),
      };

      setState(() {
        _itemsToChoose = [...inventoryItems, newItem];
        _encounteredItemPosition = position;
        _chooseItemVisible = true;
      });
    });

    _itemEffectAppliedSub = _gameService.itemEffectAppliedStream.listen((data) {
      if (!mounted) return;
      final playerId = data['playerId']?.toString() ?? '';
      final itemType = data['itemType']?.toString() ?? '';
      if (playerId != _gameService.myPlayer?.socketId) return;

      String msg = '';
      if (itemType == 'hourglass') {
        msg = 'Vous avez obtenu le Sablier: -2 PV tant que vous le possédez!';
      } else if ([
        'shield',
        'lance',
        'crystal',
        'compas',
        'potion',
      ].contains(itemType)) {
        msg = 'Vous avez obtenu: $itemType. ${_itemDescription(itemType)}';
      }
      if (msg.isNotEmpty) {
        _showItemEffect(msg);
      }
    });

    _itemEffectRemovedSub = _gameService.itemEffectRemovedStream.listen((data) {
      if (!mounted) return;
      final playerId = data['playerId']?.toString() ?? '';
      final itemType = data['itemType']?.toString() ?? '';
      if (playerId != _gameService.myPlayer?.socketId) return;

      if (itemType == 'hourglass') {
        _showItemEffect(
          'Vous avez perdu le Sablier: vos PV reviennent à la normale',
        );
      }
    });

    _itemDroppedSub = _gameService.itemDroppedStream.listen((data) {
      if (!mounted) return;
      _showItemEffect('Vous êtes mort! Vous avez perdu tous vos items.');
    });
  }

  bool _wasPreTimer = false;
  bool _wasFlagMusicConditionActive = false;

  void _onGameServiceChanged() {
    if (!mounted) return;

    if (_wasPreTimer && !_turnService.isPreTimer && _showTurnAnnouncement) {
      setState(() {
        _showTurnAnnouncement = false;
      });
    }
    _wasPreTimer = _turnService.isPreTimer;

    if (_selectedTile != null) {
      final game = _gameService.activeGame;
      final myPlayer = game?.players.cast<Player?>().firstWhere(
        (p) => p != null && p.socketId == _gameService.myPlayer?.socketId,
        orElse: () => null,
      );
      if (myPlayer == null || !myPlayer.isMyTurn || _combatService.inCombat) {
        _clearSelectedTile(_movementService);
      }
    }

    _updateFlagMusicState(_gameService);
  }

  void _updateFlagMusicState(GameService gameService) {
    final shouldPlay = _shouldPlayFlagMusic(gameService);

    if (shouldPlay && !_wasFlagMusicConditionActive) {
      try {
        GameAudioService.playOneShot('sounds/flag.wav', volume: 0.35);
      } catch (_) {}
    }

    _wasFlagMusicConditionActive = shouldPlay;
  }

  bool _shouldPlayFlagMusic(GameService gameService) {
    if (!mounted) return false;
    final game = gameService.activeGame;
    final myPlayer = gameService.myPlayer;
    if (game == null || myPlayer == null) return false;
    if (game.ended || game.map['gameMode']?.toString() != 'CTF') return false;

    Player? flagHolder;
    for (final player in game.players) {
      if (player.inventory.contains('flag')) {
        flagHolder = player;
        break;
      }
    }
    if (flagHolder == null) return false;

    final myTeam = _getTeamBySocketId(myPlayer.socketId, game);
    final holderTeam = _getTeamBySocketId(flagHolder.socketId, game);
    if (myTeam == null || holderTeam == null || myTeam != holderTeam) {
      return false;
    }

    final teamPlayers = game.players.where(
      (player) =>
          _getTeamBySocketId(player.socketId, game) == myTeam &&
          !player.hasLeft,
    );
    final teamHasFlagSoundOption = teamPlayers.any(_hasFlagMusicOptionSafe);
    if (teamHasFlagSoundOption) return true;

    final myWallet = _currencyService.wallet;
    return myWallet.ownedSounds.contains('snd_flag_music');
  }

  String? _getTeamBySocketId(String socketId, Game game) {
    if (game.teams['red']?.contains(socketId) ?? false) return 'red';
    if (game.teams['blue']?.contains(socketId) ?? false) return 'blue';
    return null;
  }

  bool _hasFlagMusicOptionSafe(Player player) {
    try {
      final dynamic raw = player;
      final value = raw.hasFlagMusicOption;
      return value == true;
    } catch (_) {
      return false;
    }
  }

  @override
  void dispose() {
    _turnAnnouncementSub?.cancel();
    _errorSub?.cancel();
    _combatEndedSub?.cancel();
    _chooseItemSub?.cancel();
    _itemDroppedSub?.cancel();
    _itemEffectAppliedSub?.cancel();
    _itemEffectRemovedSub?.cancel();
    _combatResultTimer?.cancel();
    _itemEffectTimer?.cancel();
    _gameService.removeListener(_onGameServiceChanged);
    _turnService.removeListener(_onGameServiceChanged);
    _debugModeService.stopShakeDetection();
    super.dispose();
  }

  static const Map<String, String> _itemDescriptions = {
    'shield': 'Tu possède +2 def, mais -1 atk',
    'lance': 'Tu possède +1 atk et +1 def',
    'potion': 'Soigne 3 PV uniquement quand tu es gravement blessé (PV ≤ 3)',
    'crystal':
        'Tes ennemis ne peuvent plus fuir contre toi, si tu as gagné au moins 1 combat',
    'compas': 'Tu passe les portes fermées',
    'hourglass':
        'Si tu perds un combat, il est relancé une seule fois, mais tu as -2 pv',
    'flag': 'Capture ce drapeau pour gagner',
  };

  String _itemDescription(String type) => _itemDescriptions[type] ?? '';

  void _showItemEffect(String message) {
    _itemEffectTimer?.cancel();
    setState(() {
      _itemEffectMessage = message;
      _showItemEffectMessage = true;
    });
    _itemEffectTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _showItemEffectMessage = false);
    });
  }

  void _onDropItem(String itemType) {
    if (_encounteredItemPosition == null) return;
    _gameService.dropItem(
      position: _encounteredItemPosition!,
      itemType: itemType,
    );
    setState(() {
      _itemsToChoose = [];
      _encounteredItemPosition = null;
      _chooseItemVisible = false;
    });
  }

  void _passTurn() {
    Provider.of<TurnService>(context, listen: false).passTurn();
  }

  Widget _buildChooseItemOverlay() {
    return Positioned.fill(
      child: Container(
        color: Colors.black.withValues(alpha: 0.5),
        child: Center(
          child: Container(
            width: 360,
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              image: const DecorationImage(
                image: AssetImage('assets/images/cards/big-card.png'),
                fit: BoxFit.fill,
              ),
              borderRadius: BorderRadius.circular(20),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Text(
                  'Choisissez un item à remplacer',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.bold,
                    color: Color(0xFFFFDEAB),
                    shadows: [
                      Shadow(color: Colors.black, offset: Offset(1, 1)),
                    ],
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 16),
                Wrap(
                  spacing: 12,
                  runSpacing: 12,
                  alignment: WrapAlignment.center,
                  children: _itemsToChoose.map((item) {
                    final type = item['type'] ?? '';
                    final desc = item['description'] ?? '';
                    final asset = itemAssets[type];
                    return GestureDetector(
                      onTap: () => _onDropItem(type),
                      child: Container(
                        width: 90,
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: const Color(0xFF3E1D0F).withValues(alpha: 0.8),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(
                            color: const Color(0xFFFFDEAB),
                            width: 2,
                          ),
                        ),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            if (asset != null)
                              Image.asset(
                                asset,
                                width: 40,
                                height: 40,
                                filterQuality: FilterQuality.none,
                              )
                            else
                              Container(
                                width: 40,
                                height: 40,
                                color: Colors.grey,
                                child: Center(
                                  child: Text(
                                    type.isNotEmpty ? type[0] : '?',
                                    style: const TextStyle(color: Colors.white),
                                  ),
                                ),
                              ),
                            const SizedBox(height: 4),
                            Text(
                              type,
                              style: const TextStyle(
                                color: Color(0xFFFFDEAB),
                                fontSize: 11,
                                fontWeight: FontWeight.bold,
                              ),
                              textAlign: TextAlign.center,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              desc,
                              style: const TextStyle(
                                color: Colors.white70,
                                fontSize: 9,
                              ),
                              textAlign: TextAlign.center,
                              maxLines: 3,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ],
                        ),
                      ),
                    );
                  }).toList(),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _toggleAction() {
    setState(() {
      _isAction = !_isAction;
    });
  }

  void _onTileClick(int x, int y) {
    final game = _gameService.activeGame;
    if (game == null) return;

    final realMyPlayer = game.players.cast<Player?>().firstWhere(
      (p) => p != null && p.socketId == _gameService.myPlayer?.socketId,
      orElse: () => null,
    );

    if (realMyPlayer == null || !realMyPlayer.isMyTurn) return;

    final targetPos = Position(x: x, y: y);

    if (_isAction) {
      _movementService.sendAction(targetPos, true);
      _clearSelectedTile(_movementService);
      return;
    }

    final isValid = _movementService.possibleMovements.any(
      (pos) => pos.x == x && pos.y == y,
    );

    if (!isValid) {
      _clearSelectedTile(_movementService);
      return;
    }

    if (_selectedTile != null &&
        _selectedTile!.x == x &&
        _selectedTile!.y == y) {
      _movementService.sendAction(targetPos, false);
      _clearSelectedTile(_movementService);
    } else {
      setState(() {
        _selectedTile = targetPos;
      });
      _movementService.fetchShortestPath(targetPos);
    }
  }

  void _clearSelectedTile(MovementService movementService) {
    setState(() {
      _selectedTile = null;
    });
    movementService.clearShortestPath();
  }

  void _onTileHover(int x, int y) {
    _movementService.fetchShortestPath(Position(x: x, y: y));
  }

  void _onTileLongPress(int x, int y) {
    if (!_debugModeService.isDebugMode) return;
    _debugModeService.teleportToTile(Position(x: x, y: y));
  }

  void _quitGame() {
    showDialog(
      context: context,
      builder: (dialogContext) => _buildStyledPopup(
        title: 'Abandonner la partie',
        message:
            'Êtes-vous sûr de vouloir abandonner la partie ? Cette action est irréversible.',
        actions: [
          _popupButton('Non', () => Navigator.pop(dialogContext)),
          _popupButton('Oui', () async {
            final gameService = Provider.of<GameService>(
              context,
              listen: false,
            );
            final gameId = gameService.currentGameId;
            Navigator.pop(dialogContext);
            if (gameId != null) {
              await gameService.quitGame(gameId);
            }

            gameService.clearCurrentGame();
            if (mounted) {
              Navigator.of(
                context,
              ).pushNamedAndRemoveUntil('/home', (r) => false);
            }
          }, isDestructive: true),
        ],
      ),
    );
  }

  Widget _buildStyledPopup({
    required String title,
    required String message,
    required List<Widget> actions,
    bool isNotification = false,
  }) {
    return Dialog(
      backgroundColor: Colors.transparent,
      child: Container(
        padding: const EdgeInsets.all(30),
        decoration: BoxDecoration(
          image: const DecorationImage(
            image: AssetImage('assets/images/cards/big-card.png'),
            fit: BoxFit.fill,
          ),
          borderRadius: BorderRadius.circular(20),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Text(
              isNotification ? 'Notification !' : title,
              style: TextStyle(
                fontSize: 20,
                fontWeight: FontWeight.bold,
                color: isNotification ? Colors.white : const Color(0xFF960A0A),
              ),
            ),
            const SizedBox(height: 16),
            Text(
              message,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 14, color: Colors.white),
            ),
            const SizedBox(height: 20),
            Row(mainAxisAlignment: MainAxisAlignment.center, children: actions),
          ],
        ),
      ),
    );
  }

  Widget _popupButton(
    String label,
    VoidCallback onPressed, {
    bool isDestructive = false,
  }) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 8),
      child: ElevatedButton(
        onPressed: onPressed,
        style: ElevatedButton.styleFrom(
          backgroundColor: isDestructive
              ? const Color(0xFF960A0A)
              : const Color(0xFF4b6043),
          foregroundColor: const Color(0xFFFDF7E3),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
          ),
          side: const BorderSide(color: Color(0xFF3C291F), width: 2),
          elevation: 3,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
        ),
        child: Text(label),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final gameService = Provider.of<GameService>(context);
    final combatService = Provider.of<CombatService>(context);
    final movementService = Provider.of<MovementService>(context);
    final turnService = Provider.of<TurnService>(context);
    final debugModeService = Provider.of<DebugModeService>(context);
    final activeChallenge = context.watch<ChallengeService?>()?.activeChallenge;
    final Game? game = gameService.activeGame;

    if (game == null) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    if (gameService.loadStats) {
      return const Scaffold(body: EndGameView());
    }

    final Player? realMyPlayer = game.players.cast<Player?>().firstWhere(
      (p) => p != null && p.socketId == gameService.myPlayer?.socketId,
      orElse: () => null,
    );

    if (combatService.inCombat && combatService.combatState != null) {
      return Scaffold(
        body: CombatView(combatState: combatService.combatState!),
      );
    }

    return Scaffold(
      resizeToAvoidBottomInset: false,
      body: Stack(
        children: [
          Positioned.fill(
            child: Image.asset(
              'assets/images/background/background-game.gif',
              fit: BoxFit.cover,
              gaplessPlayback: true,
            ),
          ),
          Positioned.fill(
            child: LayoutBuilder(
              builder: (context, outerConstraints) {
                return Padding(
                  padding: const EdgeInsets.all(10),
                  child: Stack(
                    children: [
                      Column(
                        children: [
                          Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              _buildNavButton('Abandonner', _quitGame),
                              const Spacer(),
                              _buildGameInfoPanel(game, activeChallenge),
                              const Spacer(),
                              _buildWalletPanel(),
                              const SizedBox(width: 8),
                              if (!_showTurnAnnouncement)
                                _buildTimerPanel(turnService),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Expanded(
                            child: Row(
                              crossAxisAlignment: CrossAxisAlignment.stretch,
                              children: [
                                Expanded(
                                  child: Column(
                                    children: [
                                      Expanded(
                                        child: Row(
                                          children: [
                                            SizedBox(
                                              width:
                                                  outerConstraints.maxWidth *
                                                  0.22,
                                              child: _buildPlayerListPanel(
                                                game,
                                              ),
                                            ),
                                            Expanded(
                                              child: LayoutBuilder(
                                                builder: (context, mapConstraints) {
                                                  final int gridSize =
                                                      int.tryParse(
                                                        game.map['size']
                                                                ?.toString() ??
                                                            '',
                                                      ) ??
                                                      10;

                                                  final double cellSize =
                                                      mapConstraints.maxHeight /
                                                      gridSize;

                                                  final double mapDim = min(
                                                    cellSize * gridSize,
                                                    mapConstraints.maxWidth,
                                                  );

                                                  return Center(
                                                    child: SizedBox.square(
                                                      dimension: mapDim,
                                                      child: MapView(
                                                        mapData: game.map,
                                                        players: game.players,
                                                        possibleMovements:
                                                            movementService
                                                                .possibleMovements,
                                                        shortestPath:
                                                            movementService
                                                                .shortestPath,
                                                        onTileClick:
                                                            _onTileClick,
                                                        onTileHover:
                                                            _onTileHover,
                                                        onTileLongPress:
                                                            game.isInDebugMode
                                                            ? _onTileLongPress
                                                            : null,
                                                      ),
                                                    ),
                                                  );
                                                },
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      const SizedBox(height: 8),
                                      Row(
                                        crossAxisAlignment:
                                            CrossAxisAlignment.end,
                                        children: [
                                          if (realMyPlayer != null)
                                            Flexible(
                                              child: _buildPlayerInfoPanel(
                                                realMyPlayer,
                                              ),
                                            ),
                                          const Spacer(),
                                          if (realMyPlayer != null)
                                            Flexible(
                                              child: _buildInventoryPanel(
                                                realMyPlayer,
                                              ),
                                            ),
                                          const Spacer(),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                SizedBox(
                                  width: outerConstraints.maxWidth * 0.28,
                                  child: Column(
                                    children: [
                                      Expanded(child: _buildChatPanel()),
                                      if (realMyPlayer?.isMyTurn ?? false)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                            top: 8,
                                            bottom: 8,
                                          ),
                                          child: _buildActionButtons(),
                                        ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),

                      if (_showTurnAnnouncement)
                        Positioned(
                          top: 70,
                          left: outerConstraints.maxWidth * 0.28,
                          right: outerConstraints.maxWidth * 0.28,
                          child: IgnorePointer(
                            ignoring: false,
                            child: Center(child: _buildTurnAnnouncementCard()),
                          ),
                        ),
                    ],
                  ),
                );
              },
            ),
          ),
          if (_showCombatResult)
            Positioned(
              bottom: 40,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: _combatResultIsWin
                        ? const Color(0xFF2E7D32)
                        : const Color(0xFFC62828),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: const [
                      BoxShadow(color: Colors.black54, blurRadius: 8),
                    ],
                  ),
                  child: Text(
                    _combatResultMessage,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 16,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
          if (_showItemEffectMessage)
            Positioned(
              bottom: 80,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 24,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFF1565C0),
                    borderRadius: BorderRadius.circular(12),
                    boxShadow: const [
                      BoxShadow(color: Colors.black54, blurRadius: 8),
                    ],
                  ),
                  child: Text(
                    _itemEffectMessage,
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 14,
                      fontWeight: FontWeight.bold,
                    ),
                    textAlign: TextAlign.center,
                  ),
                ),
              ),
            ),
          if (_chooseItemVisible && _encounteredItemPosition != null)
            _buildChooseItemOverlay(),
          if (debugModeService.debugMessage != null || game.isInDebugMode)
            Positioned(
              top: 0,
              left: 0,
              right: 0,
              child: Center(
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: game.isInDebugMode
                        ? const Color(0xFFE65100)
                        : const Color(0xFF424242),
                    borderRadius: const BorderRadius.vertical(
                      bottom: Radius.circular(8),
                    ),
                    boxShadow: const [
                      BoxShadow(color: Colors.black54, blurRadius: 6),
                    ],
                  ),
                  child: Text(
                    debugModeService.debugMessage ??
                        (game.isInDebugMode ? 'Mode Débug activé' : ''),
                    style: const TextStyle(
                      color: Colors.white,
                      fontSize: 13,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildNavButton(String label, VoidCallback onPressed) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF4b6043),
        foregroundColor: const Color(0xFFFDF7E3),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        side: const BorderSide(color: Color(0xFF3C291F), width: 2),
        elevation: 3,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildGameInfoPanel(Game game, PlayerChallenge? activeChallenge) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0xFF3E1D0F),
        border: Border.all(color: const Color(0xFF1E1007), width: 4),
        boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(4, 4))],
      ),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          const Text(
            'Informations de la partie',
            style: TextStyle(
              fontSize: 16,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFDEAB),
              shadows: [Shadow(color: Colors.black, offset: Offset(1, 1))],
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Taille de la carte : ${game.map['size']}x${game.map['size']}',
            style: const TextStyle(fontSize: 12, color: Color(0xFFFFF4D0)),
          ),
          Text(
            'Joueurs actifs : ${game.players.where((p) => !p.hasLeft).length}',
            style: const TextStyle(fontSize: 12, color: Color(0xFFFFF4D0)),
          ),
          if (activeChallenge != null) ...[
            const SizedBox(height: 6),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: const Color(0xFF1E3A8A),
                borderRadius: BorderRadius.circular(6),
                border: Border.all(color: const Color(0xFF93C5FD), width: 1),
              ),
              child: Text(
                '🎯 Défi: ${activeChallenge.description} (+${activeChallenge.reward} 🪙)',
                style: const TextStyle(fontSize: 11, color: Colors.white),
                textAlign: TextAlign.center,
              ),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTimerPanel(TurnService turnService) {
    return Container(
      width: 180,
      height: 70,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/HUD/timer.png'),
          fit: BoxFit.contain,
        ),
      ),
      alignment: Alignment.center,
      child: Text(
        turnService.isPreTimer
            ? '${turnService.preTimer}'
            : 'Temps restant: ${turnService.turnTimer}',
        style: const TextStyle(
          fontSize: 14,
          fontWeight: FontWeight.bold,
          color: Colors.black,
        ),
      ),
    );
  }

  Widget _buildWalletPanel() {
    return Consumer<CurrencyService>(
      builder: (context, currencyService, _) {
        return Container(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.7),
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: const Color(0xFFFFD700).withValues(alpha: 0.6),
            ),
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.monetization_on,
                color: Color(0xFFFFD700),
                size: 18,
              ),
              const SizedBox(width: 6),
              Text(
                '${currencyService.balance} 🪙',
                style: const TextStyle(
                  color: Color(0xFFFFF4D0),
                  fontWeight: FontWeight.bold,
                  fontSize: 14,
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  String? _getPlayerTeam(Player p, Game game) {
    final mode = game.map['gameMode']?.toString();
    if (mode != 'CTF') return null;
    final teams = game.teams;
    if (teams['red']?.contains(p.socketId) ?? false) return 'red';
    if (teams['blue']?.contains(p.socketId) ?? false) return 'blue';
    return null;
  }

  bool _isPlayerInactive(Player player, Game game) {
    return game.inactivePlayers.any((p) => p.socketId == player.socketId) ||
        player.hasLeft;
  }

  Widget _buildPlayerListPanel(Game game) {
    final activePlayers = game.players
        .where((p) => !p.hasLeft && !p.isEliminated)
        .toList();
    final eliminatedPlayers = game.eliminatedPlayers;
    final inactivePlayers = game.players.where((p) => p.hasLeft).toList();
    final allInactive = [...inactivePlayers, ...game.inactivePlayers];

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF3E1D0F),
        border: Border.all(color: const Color(0xFF3E1D0F), width: 4),
        boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(4, 4))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Center(
            child: Text(
              'Liste des joueurs',
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.bold,
                color: Color(0xFFFFF8DC),
                shadows: [Shadow(color: Colors.black, offset: Offset(1, 1))],
              ),
            ),
          ),
          const SizedBox(height: 6),
          Expanded(
            child: ListView(
              children: [
                ...activePlayers.map(
                  (p) => _buildPlayerRow(
                    p,
                    game,
                    isInactive: false,
                    isEliminated: false,
                  ),
                ),
                ...eliminatedPlayers
                    .where((p) => !_isPlayerInactive(p, game))
                    .map(
                      (p) => _buildPlayerRow(
                        p,
                        game,
                        isInactive: false,
                        isEliminated: true,
                      ),
                    ),
                ...allInactive.map(
                  (p) => _buildPlayerRow(
                    p,
                    game,
                    isInactive: true,
                    isEliminated: false,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerRow(
    Player p,
    Game game, {
    required bool isInactive,
    required bool isEliminated,
  }) {
    final team = _getPlayerTeam(p, game);
    final myId = Provider.of<GameService>(
      context,
      listen: false,
    ).myPlayer?.socketId;
    final isCurrentPlayer = p.socketId == myId;

    Color? bgColor;
    Border? teamBorder;
    if (team == 'red') {
      bgColor = const Color(0xFFFFC8C8).withValues(alpha: 0.7);
      teamBorder = const Border(
        left: BorderSide(color: Color(0xFFF44336), width: 4),
      );
    } else if (team == 'blue') {
      bgColor = const Color(0xFFC8C8FF).withValues(alpha: 0.7);
      teamBorder = const Border(
        left: BorderSide(color: Color(0xFF2196F3), width: 4),
      );
    }

    Color nameColor;
    TextDecoration? nameDecoration;
    if (isEliminated) {
      nameColor = const Color(0xFF666666);
      nameDecoration = TextDecoration.lineThrough;
    } else if (isInactive) {
      nameColor = const Color(0xFF732020);
      nameDecoration = TextDecoration.lineThrough;
    } else if (isCurrentPlayer) {
      nameColor = const Color(0xFF378139);
      nameDecoration = null;
    } else {
      nameColor = const Color(0xFFFFF8DC);
      nameDecoration = null;
    }

    return Container(
      padding: const EdgeInsets.symmetric(vertical: 3, horizontal: 4),
      margin: const EdgeInsets.only(bottom: 2),
      decoration: BoxDecoration(
        color: bgColor,
        border: teamBorder,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Row(
        children: [
          Image.asset(
            avatarAsset(p.avatar),
            width: 20,
            height: 20,
            errorBuilder: (_, _, _) =>
                const Icon(Icons.person, size: 20, color: Colors.white),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: Text.rich(
              TextSpan(
                children: [
                  TextSpan(
                    text: p.name,
                    style: TextStyle(
                      color: nameColor,
                      fontWeight: isCurrentPlayer
                          ? FontWeight.bold
                          : FontWeight.w500,
                      fontSize: 12,
                      decoration: nameDecoration,
                      decorationColor: Colors.black,
                    ),
                  ),
                  if (isEliminated)
                    const TextSpan(text: ' 💀', style: TextStyle(fontSize: 12)),
                  if (p.isAdmin)
                    const TextSpan(text: ' 👑', style: TextStyle(fontSize: 12)),
                  if (p.isFlagHolder)
                    const TextSpan(text: ' 🚩', style: TextStyle(fontSize: 12)),
                  if (p.isBot)
                    const TextSpan(text: ' 🤖', style: TextStyle(fontSize: 12)),
                ],
              ),
            ),
          ),
          Text(
            'Combats gagnés: ${p.battlesWon}',
            style: const TextStyle(color: Color(0xFFFFF8DC), fontSize: 10),
          ),
        ],
      ),
    );
  }

  Widget _buildPlayerInfoPanel(Player player) {
    return Container(
      width: 260,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFF3E1D0F),
        border: Border.all(color: const Color(0xFF1E1007), width: 3),
        borderRadius: BorderRadius.circular(4),
        boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(3, 3))],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          const Text(
            'Informations du joueur',
            style: TextStyle(
              fontSize: 12,
              fontWeight: FontWeight.bold,
              color: Color(0xFFFFDEAB),
            ),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              Image.asset(
                avatarAsset(player.avatar),
                width: 30,
                height: 30,
                errorBuilder: (_, _, _) =>
                    const Icon(Icons.person, size: 30, color: Colors.white),
              ),
              const SizedBox(width: 8),
              Expanded(
                child: Text(
                  player.name,
                  style: const TextStyle(
                    color: Colors.white,
                    fontWeight: FontWeight.bold,
                    fontSize: 13,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: player.healthpoints / 6.0,
              minHeight: 10,
              backgroundColor: Colors.grey.shade800,
              valueColor: const AlwaysStoppedAnimation<Color>(Colors.green),
            ),
          ),
          const SizedBox(height: 2),
          Text(
            '${player.healthpoints} / 6',
            style: const TextStyle(color: Colors.white70, fontSize: 10),
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _statLabel('Rapidité', player.speed),
              _statLabel('Attaque', player.attack),
            ],
          ),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              _statLabel('Défense', player.defense),
              _statLabel('Mouvements', player.movementPoints),
            ],
          ),
          _statLabel('Actions', player.actionPoints),
        ],
      ),
    );
  }

  Widget _statLabel(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Text(
        '$label : $value',
        style: const TextStyle(color: Color(0xFFFFF4D0), fontSize: 10),
      ),
    );
  }

  Widget _buildInventoryPanel(Player player) {
    return Container(
      height: 70,
      width: 260,
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/HUD/bigInventory.png'),
          fit: BoxFit.contain,
        ),
      ),
      child: Center(
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: player.inventory.isEmpty
              ? [
                  const Text(
                    'Inventaire vide',
                    style: TextStyle(color: Colors.white54, fontSize: 11),
                  ),
                ]
              : player.inventory.map((item) {
                  final itemPath = itemAssets[item];
                  return Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 6),
                    child: itemPath != null
                        ? Image.asset(
                            itemPath,
                            width: 32,
                            height: 32,
                            filterQuality: FilterQuality.none,
                          )
                        : Container(
                            width: 32,
                            height: 32,
                            color: Colors.grey,
                            child: Center(
                              child: Text(
                                item[0],
                                style: const TextStyle(color: Colors.white),
                              ),
                            ),
                          ),
                  );
                }).toList(),
        ),
      ),
    );
  }

  Widget _buildActionButtons() {
    return Column(
      mainAxisSize: MainAxisSize.min,
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        _buildNavButton(
          _isAction ? 'Désactiver Action' : 'Activer Action',
          _toggleAction,
        ),
        const SizedBox(height: 8),
        _buildNavButton('Passer son tour', _passTurn),
      ],
    );
  }

  Widget _buildChatPanel() {
    final gameService = Provider.of<GameService>(context, listen: false);
    final gameId = gameService.currentGameId;

    return Container(
      padding: const EdgeInsets.all(8),
      child: DefaultTabController(
        length: 2,
        child: Column(
          children: [
            Container(
              decoration: BoxDecoration(
                color: const Color(0xFF3E1D0F),
                borderRadius: const BorderRadius.vertical(
                  top: Radius.circular(8),
                ),
                border: Border.all(color: const Color(0xFF1E1007), width: 2),
              ),
              child: const TabBar(
                labelColor: Color(0xFFFFDEAB),
                unselectedLabelColor: Colors.white54,
                indicatorColor: Color(0xFFFFDEAB),
                tabs: [
                  Tab(text: 'Clavardage'),
                  Tab(text: 'Journal de jeu'),
                ],
              ),
            ),
            Expanded(
              child: Container(
                decoration: BoxDecoration(
                  color: const Color(0xFF3E1D0F),
                  borderRadius: const BorderRadius.vertical(
                    bottom: Radius.circular(8),
                  ),
                  border: Border.all(color: const Color(0xFF1E1007), width: 2),
                ),
                child: TabBarView(
                  children: [
                    ChatRoom(gameId: gameId ?? ''),
                    const Center(
                      child: Text(
                        'Journal Component',
                        style: TextStyle(color: Color(0xFFFEFAE0)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildTurnAnnouncementCard() {
    return Material(
      color: Colors.transparent,
      child: Container(
        constraints: const BoxConstraints(
          maxWidth: 350, // smaller width instead of fixed 400
        ),
        padding: const EdgeInsets.symmetric(
          horizontal: 30,
          vertical: 20,
        ), // MUCH tighter
        decoration: BoxDecoration(
          image: const DecorationImage(
            image: AssetImage('assets/images/cards/big-card.png'),
            fit: BoxFit.fill,
          ),
          borderRadius: BorderRadius.circular(16),
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Text(
              'Notification !',
              style: TextStyle(
                fontSize: 16, // smaller
                fontWeight: FontWeight.bold,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6), // reduced spacing
            Text(
              _turnMessage,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontSize: 14, // smaller
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 10), // reduced spacing
            ElevatedButton(
              onPressed: () => setState(() => _showTurnAnnouncement = false),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4b6043),
                foregroundColor: const Color(0xFFFDF7E3),
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 6,
                ), // tighter button
                minimumSize: Size.zero,
                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
                side: const BorderSide(color: Color(0xFF3C291F), width: 2),
              ),
              child: const Text('Fermer', style: TextStyle(fontSize: 12)),
            ),
          ],
        ),
      ),
    );
  }
}
