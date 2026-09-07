import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/components/chat_room.dart';
import 'package:light_client/config/asset_constants.dart';
import 'package:light_client/components/friend_panel.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:provider/provider.dart';
import 'package:qr_flutter/qr_flutter.dart';

const _kPanelColor = Color(0xFF3B2010);
const _kOrange = Color(0xFFE88B00);
const _kBlue = Color(0xFF1A6496);

class LobbyPage extends StatefulWidget {
  const LobbyPage({super.key});

  @override
  State<LobbyPage> createState() => _LobbyPageState();
}

class _LobbyPageState extends State<LobbyPage> {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();

  StreamSubscription<void>? _gameStartedSub;
  StreamSubscription<Map<String, dynamic>>? _kickedSub;
  StreamSubscription<Map<String, dynamic>>? _canceledSub;
  StreamSubscription<void>? _playerLeftSub;
  StreamSubscription<Map<String, dynamic>>? _errorSub;
  StreamSubscription<Map<String, dynamic>>? _blockStayOrLeaveSub;

  String _errorMessage = '';
  bool _errorVisible = false;
  bool _errorShouldRedirect = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) => _subscribeToEvents());
  }

  void _subscribeToEvents() {
    final gameService = context.read<GameService>();

    _gameStartedSub = gameService.gameStartedStream.listen((_) {
      if (!mounted) return;
      Navigator.of(context).pushReplacementNamed('/in-game');
    });

    _kickedSub = gameService.playerKickedStream.listen((data) {
      if (!mounted) return;
      setState(() {
        _errorMessage = data['message']?.toString() ?? 'Vous avez été expulsé.';
        _errorVisible = true;
        _errorShouldRedirect = true;
      });
    });

    _canceledSub = gameService.lobbyCanceledStream.listen((data) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            data['message']?.toString() ?? 'La partie a été annulée.';
        _errorMessage =
            data['message']?.toString() ?? 'La partie a été annulée.';
        _errorVisible = true;
        _errorShouldRedirect = true;
      });
    });

    _playerLeftSub = gameService.playerLeftStream.listen((_) {
      if (!mounted) return;
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (r) => false);
    });

    _errorSub = gameService.errorStream.listen((data) {
      if (!mounted) return;
      setState(() {
        _errorMessage =
            data['message']?.toString() ?? 'Une erreur est survenue.';

        _errorVisible = true;
        _errorShouldRedirect = data['shouldRedirect'] == true;
      });
    });

    _blockStayOrLeaveSub = context
        .read<FriendService>()
        .lobbyBlockStayOrLeaveStream
        .listen((data) {
      if (!mounted) return;
      final blockedUsername =
          data['blockedUsername']?.toString() ?? 'un joueur';
      final gameId = data['gameId']?.toString() ?? '';
      _showBlockStayOrLeaveDialog(blockedUsername, gameId);
    });
  }

  @override
  void dispose() {
    _gameStartedSub?.cancel();
    _kickedSub?.cancel();
    _canceledSub?.cancel();
    _playerLeftSub?.cancel();
    _errorSub?.cancel();
    _blockStayOrLeaveSub?.cancel();
    super.dispose();
  }

  void _closeError() {
    setState(() => _errorVisible = false);
    if (_errorShouldRedirect) {
      context.read<GameService>().clearCurrentGame();
      Navigator.of(context).pushNamedAndRemoveUntil('/home', (r) => false);
    }
  }

  Future<void> _showBlockStayOrLeaveDialog(
    String blockedUsername,
    String gameId,
  ) async {
    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text(
          'Conflit de blocage',
          style: TextStyle(color: Color(0xFFE88B00)),
        ),
        content: Text(
          'Vous venez de bloquer $blockedUsername, '
          'qui est dans la même salle d\'attente. '
          'Voulez-vous rester ou quitter la salle ?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              'Quitter',
              style: TextStyle(color: Color(0xFFE74C3C)),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Rester',
              style: TextStyle(color: Color(0xFF26A85A)),
            ),
          ),
        ],
      ),
    );

    if (!mounted) return;
    if (result == false) {
      await _quitGame(gameId);
    }
  }

  Future<void> _quitGame(String gameId) async {
    try {
      await context.read<GameService>().quitGame(gameId);
    } catch (_) {
    } finally {
      if (mounted) {
        context.read<GameService>().clearCurrentGame();
        Navigator.of(context).pushNamedAndRemoveUntil('/home', (r) => false);
      }
    }
  }

  Future<void> _addBot({required bool isAgressive}) async {
    final gameId = context.read<GameService>().currentGameId;
    if (gameId == null) return;
    await context.read<GameService>().addBot(
      isAgressive: isAgressive,
      gameId: gameId,
    );
  }

  Future<void> _startGame(String gameId) async {
    await context.read<GameService>().startGame(gameId);
  }

  Future<void> _kickPlayer(String targetSocketId, String gameId) async {
    await context.read<GameService>().kickPlayer(targetSocketId, gameId);
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      body: Stack(
        children: [
          Container(
            decoration: const BoxDecoration(
              image: DecorationImage(
                image: AssetImage(
                  'assets/images/background/home_background.jpg',
                ),
                fit: BoxFit.cover,
              ),
            ),
          ),

          SafeArea(child: _buildContent()),

          const FriendPanel(),

          if (_errorVisible) _buildErrorOverlay(),
        ],
      ),
    );
  }

  Widget _buildContent() {
    return Consumer<GameService>(
      builder: (context, gameService, _) {
        final game = gameService.currentGame;
        final players = gameService.lobbyPlayers;
        final myPlayer = gameService.myPlayer;

        if (game == null) {
          return const Center(
            child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
          );
        }

        final isAdmin = myPlayer?.isAdmin ?? false;
        final gameId = game.gameId;

        return Column(
          children: [
            _buildTitle(gameId),

            if (isAdmin)
              _buildAdminActionBar(game: game, gameService: gameService),

            Expanded(
              child: Padding(
                padding: const EdgeInsets.fromLTRB(10, 6, 10, 10),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(
                      flex: 55,
                      child: _buildLeftPanel(
                        game: game,
                        players: players,
                        myPlayer: myPlayer,
                        isAdmin: isAdmin,
                        gameService: gameService,
                      ),
                    ),
                    const SizedBox(width: 10),

                    Expanded(
                      flex: 45,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          Expanded(child: ChatRoom(gameId: gameId)),
                          if (MediaQuery.of(context).viewInsets.bottom ==
                              0) ...[
                            const SizedBox(height: 8),
                            _QrCodePanel(gameId: gameId),
                          ],
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        );
      },
    );
  }

  Widget _buildTitle(String gameId) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(vertical: 10),
      color: Colors.black.withValues(alpha: 0.55),
      child: Text(
        'Salle d\'attente - Partie: $gameId',
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 18,
          fontWeight: FontWeight.bold,
          fontFamily: 'TextFont',
        ),
      ),
    );
  }

  Widget _buildAdminActionBar({
    required GameModel game,
    required GameService gameService,
  }) {
    return Container(
      color: Colors.black.withValues(alpha: 0.45),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: _OrangeButton(
              label: 'Démarrer la partie',
              color: _kBlue,
              onPressed: game.isLocked ? () => _startGame(game.gameId) : null,
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _OrangeButton(
              label: game.isLocked ? 'Déverrouiller' : 'Verrouiller',
              onPressed: game.isLocked
                  ? () => gameService.unlockRoom(game.gameId)
                  : () => gameService.lockRoom(game.gameId),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _OrangeButton(
              label: game.dropInActive
                  ? 'Désactiver le drop-in'
                  : 'Activer le drop-in',
              onPressed: game.dropInActive
                  ? () => gameService.deactivateDropIn(game.gameId)
                  : () => gameService.activateDropIn(game.gameId),
            ),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: _OrangeButton(
              label: game.fastEliminationActive
                  ? 'Désactiver Élim. Rapide'
                  : 'Activer Élim. Rapide',
              onPressed: game.fastEliminationActive
                  ? () => gameService.deactivateFastElimination(game.gameId)
                  : () => gameService.activateFastElimination(game.gameId),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLeftPanel({
    required GameModel game,
    required List<PlayerModel> players,
    required PlayerModel? myPlayer,
    required bool isAdmin,
    required GameService gameService,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: _kPanelColor,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(12, 10, 12, 10),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      fontSize: 13,
                      fontFamily: 'TextFont',
                      color: Colors.white,
                    ),
                    children: [
                      const TextSpan(
                        text: 'Carte: ',
                        style: TextStyle(fontWeight: FontWeight.bold),
                      ),
                      TextSpan(
                        text: game.mapName.isNotEmpty
                            ? game.mapName
                            : 'Inconnue',
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 4),
                RichText(
                  text: TextSpan(
                    style: const TextStyle(
                      fontSize: 13,
                      fontFamily: 'TextFont',
                    ),
                    children: [
                      const TextSpan(
                        text: 'Statut: ',
                        style: TextStyle(
                          fontWeight: FontWeight.bold,
                          color: Colors.white,
                        ),
                      ),
                      TextSpan(
                        text: game.isLocked ? 'Verrouillée' : 'Déverrouillée',
                        style: TextStyle(
                          color: game.isLocked
                              ? Colors.redAccent
                              : Colors.greenAccent,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),

          Container(height: 1, color: Colors.white24),

          const Padding(
            padding: EdgeInsets.fromLTRB(12, 10, 12, 6),
            child: Text(
              'Joueur',
              style: TextStyle(
                color: Colors.white,
                fontSize: 16,
                fontWeight: FontWeight.bold,
                fontFamily: 'TextFont',
              ),
            ),
          ),

          if (isAdmin)
            Padding(
              padding: const EdgeInsets.fromLTRB(10, 0, 10, 8),
              child: Row(
                children: [
                  Expanded(
                    child: _FilledButton(
                      label: 'Ajouter Un JV\nAggressif',
                      color: _kOrange,
                      onPressed: () => _addBot(isAgressive: true),
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: _FilledButton(
                      label: 'Ajouter Un JV Passif',
                      color: _kBlue,
                      onPressed: () => _addBot(isAgressive: false),
                    ),
                  ),
                ],
              ),
            ),

          Expanded(
            child: ListView.separated(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              itemCount: players.length,
              separatorBuilder: (context, index) =>
                  Container(height: 1, color: Colors.white24),
              itemBuilder: (context, index) {
                final player = players[index];
                final isMe = player.socketId == myPlayer?.socketId;
                return _PlayerTile(
                  player: player,
                  isMe: isMe,
                  isAdmin: isAdmin,
                  mySocketId: myPlayer?.socketId ?? '',
                  onKick: () => _kickPlayer(player.socketId, game.gameId),
                );
              },
            ),
          ),

          Padding(
            padding: const EdgeInsets.all(10),
            child: SizedBox(
              width: 200,
              child: ElevatedButton(
                onPressed: () => _quitGame(game.gameId),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFE23F25),
                  padding: const EdgeInsets.symmetric(vertical: 10),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(4),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Quitter la partie',
                  style: TextStyle(
                    color: Colors.white,
                    fontFamily: 'TextFont',
                    fontSize: 12,
                  ),
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildErrorOverlay() {
    return Container(
      color: Colors.black54,
      child: Center(
        child: Container(
          margin: const EdgeInsets.symmetric(horizontal: 40),
          padding: const EdgeInsets.all(24),
          decoration: BoxDecoration(
            color: const Color(0xFF1A1A2E),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.redAccent.withValues(alpha: 0.6)),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              const Icon(
                Icons.error_outline,
                color: Colors.redAccent,
                size: 40,
              ),
              const SizedBox(height: 12),
              Text(
                _errorMessage,
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white70, fontSize: 15),
              ),
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: _closeError,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.deepPurpleAccent,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text('OK', style: TextStyle(color: Colors.white)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrangeButton extends StatelessWidget {
  final String label;
  final VoidCallback? onPressed;
  final Color? color;

  const _OrangeButton({
    required this.label,
    required this.onPressed,
    this.color,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color ?? _kOrange,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
        elevation: 0,
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontFamily: 'TextFont',
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _FilledButton extends StatelessWidget {
  final String label;
  final Color color;
  final VoidCallback onPressed;

  const _FilledButton({
    required this.label,
    required this.color,
    required this.onPressed,
  });

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: color,
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 10),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(2)),
        elevation: 0,
      ),
      child: Text(
        label,
        textAlign: TextAlign.center,
        style: const TextStyle(
          color: Colors.white,
          fontFamily: 'TextFont',
          fontSize: 10,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _PlayerTile extends StatelessWidget {
  final PlayerModel player;
  final bool isMe;
  final bool isAdmin;
  final String mySocketId;
  final VoidCallback onKick;

  const _PlayerTile({
    required this.player,
    required this.isMe,
    required this.isAdmin,
    required this.mySocketId,
    required this.onKick,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Row(
              children: [
                Text(
                  player.name,
                  style: TextStyle(
                    color: player.isAdmin ? Colors.amberAccent : Colors.white,
                    fontFamily: 'TextFont',
                    fontSize: 13,
                    fontWeight: player.isAdmin
                        ? FontWeight.bold
                        : FontWeight.normal,
                  ),
                  overflow: TextOverflow.ellipsis,
                ),
                if (player.isAdmin) ...[
                  const SizedBox(width: 4),
                  const Text('👑', style: TextStyle(fontSize: 14)),
                ],
                if (player.isBot) ...[
                  const SizedBox(width: 4),
                  const Text('🤖', style: TextStyle(fontSize: 14)),
                ],
              ],
            ),
          ),

          if (isAdmin && player.socketId != mySocketId)
            Padding(
              padding: const EdgeInsets.only(right: 6),
              child: ElevatedButton(
                onPressed: onKick,
                style: ElevatedButton.styleFrom(
                  backgroundColor: Colors.red,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 4,
                  ),
                  minimumSize: Size.zero,
                  tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(2),
                  ),
                  elevation: 0,
                ),
                child: const Text(
                  'Exclure',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontFamily: 'TextFont',
                  ),
                ),
              ),
            ),

          Container(
            width: 32,
            height: 40,
            clipBehavior: Clip.antiAlias,
            decoration: const BoxDecoration(),
            child: Image.asset(
              avatarAsset(player.avatar),
              fit: BoxFit.cover,
              errorBuilder: (ctx, err, stack) =>
                  const Icon(Icons.person, color: Colors.white54, size: 28),
            ),
          ),
        ],
      ),
    );
  }
}

class _QrCodePanel extends StatelessWidget {
  final String gameId;

  const _QrCodePanel({required this.gameId});

  static final _validGameId = RegExp(r'^\d{4}$');

  @override
  Widget build(BuildContext context) {
    final isValid = _validGameId.hasMatch(gameId);

    return Container(
      decoration: BoxDecoration(
        color: _kPanelColor,
        borderRadius: BorderRadius.circular(4),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Code QR de la partie',
                  style: TextStyle(
                    color: Color(0xFFFFDEAB),
                    fontFamily: 'TextFont',
                    fontSize: 13,
                    fontWeight: FontWeight.bold,
                  ),
                ),
                const SizedBox(height: 4),
                Text(
                  isValid
                      ? 'Scannez ce code pour rejoindre la partie.'
                      : 'Code de partie invalide.',
                  style: TextStyle(
                    color: isValid ? Colors.white60 : Colors.redAccent,
                    fontSize: 11,
                  ),
                ),
              ],
            ),
          ),
          const SizedBox(width: 12),
          if (isValid)
            QrImageView(
              data: gameId,
              size: 100,
              backgroundColor: const Color(0xFFFFDEAB),
              eyeStyle: const QrEyeStyle(
                eyeShape: QrEyeShape.square,
                color: Color(0xFF1A0F08),
              ),
              dataModuleStyle: const QrDataModuleStyle(
                dataModuleShape: QrDataModuleShape.square,
                color: Color(0xFF1A0F08),
              ),
            )
          else
            const Icon(Icons.qr_code, color: Colors.white24, size: 60),
        ],
      ),
    );
  }
}
