import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:light_client/components/character_form_dialog.dart';
import 'package:light_client/pages/lobby_page.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/qrcode_service.dart';
import 'package:provider/provider.dart';

class JoinGamePage extends StatefulWidget {
  const JoinGamePage({super.key});

  @override
  State<JoinGamePage> createState() => _JoinGamePageState();
}

class _JoinGamePageState extends State<JoinGamePage> {
  final TextEditingController _codeController = TextEditingController();
  final FocusNode _codeFocusNode = FocusNode();
  bool _isJoining = false;
  _JoinMode _joinMode = _JoinMode.code;
  bool _autoJoinHandled = false;

  StreamSubscription<Map<String, dynamic>>? _blockConflictSub;
  List<String> _pendingConflictUsers = [];

  @override
  void initState() {
    super.initState();

    WidgetsBinding.instance.addPostFrameCallback((_) {
      context.read<GameService>().getGames();
      context.read<FriendService>().loadFriends();

      _blockConflictSub = context
          .read<FriendService>()
          .lobbyBlockConflictStream
          .listen((data) {
            final users = data['conflictUsers'];
            if (users is List) {
              _pendingConflictUsers = users.map((e) => e.toString()).toList();
            }
          });
    });
  }

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();

    if (!_autoJoinHandled) {
      final args = ModalRoute.of(context)?.settings.arguments;
      if (args is Map && args.containsKey('autoJoinGameId')) {
        _autoJoinHandled = true;
        final gameId = args['autoJoinGameId'].toString();
        WidgetsBinding.instance.addPostFrameCallback((_) {
          if (mounted) {
            _joinGame(overrideCode: gameId);
          }
        });
      }
    }
  }

  @override
  void dispose() {
    _codeController.dispose();
    _codeFocusNode.dispose();
    _blockConflictSub?.cancel();
    super.dispose();
  }

  Future<void> _joinGame({String? overrideCode}) async {
    final code = overrideCode ?? _codeController.text.trim();
    if (code.length != 4) return;

    setState(() => _isJoining = true);

    final gameService = context.read<GameService>();
    final authService = context.read<AuthService>();

    try {
      await gameService.checkGameId(code, joinerUid: authService.uid);
      if (!mounted) return;

      await _openCharacterForm(gameId: code);
    } catch (e) {
      if (mounted) {
        final err = e.toString();
        if (err.contains('blockConflict:')) {
          final confirmed = await _showBlockConflictDialog(code);
          if (confirmed && mounted) {
            final friendService = context.read<FriendService>();
            try {
              final ackData = await friendService.confirmLobbyBlock(code);
              if (!mounted) return;
              final rawGame = ackData['game'];
              if (rawGame is Map) {
                gameService.applyGameData(Map<String, dynamic>.from(rawGame));
              }
              await _openCharacterForm(gameId: code);
            } catch (e2) {
              if (mounted) {
                _showError(e2.toString());
                _codeController.clear();
              }
            }
          }
        } else {
          _showError(err);
          _codeController.clear();
        }
      }
    } finally {
      if (mounted) setState(() => _isJoining = false);
    }
  }

  Future<void> _openCharacterForm({required String gameId}) async {
    final gameService = context.read<GameService>();
    final selectedAvatars = gameService.activeGame?.selectedAvatars ?? {};
    final unavailable = selectedAvatars.values.toList();

    final result = await showDialog<CharacterData>(
      context: context,
      barrierDismissible: false,
      builder: (_) => CharacterFormDialog(unavailableAvatars: unavailable),
    );

    if (result == null || !mounted) {
      gameService.deselectAvatar(gameId);
      gameService.leavePendingRoom(gameId);
      gameService.clearCurrentGame();
      return;
    }

    await _submitCharacterForm(gameId: gameId, data: result);
  }

  Future<void> _submitCharacterForm({
    required String gameId,
    required CharacterData data,
  }) async {
    final gameService = context.read<GameService>();
    final authService = context.read<AuthService>();

    final playerName = authService.username ?? 'Joueur';

    final attributes = data.attributes.map(
      (key, value) =>
          MapEntry(key, {'value': value['value'], 'dice': value['dice']}),
    );

    try {
      final payload = await gameService.joinGame(
        gameId,
        playerName,
        data.avatar,
        attributes,
      );

      if (!mounted) return;

      final game = payload['game'] as Map?;
      final isStarted = game?['started'] == true;

      if (!mounted) return;

      if (isStarted) {
        Navigator.of(context).pushReplacementNamed('/in-game');
      } else {
        Navigator.of(
          context,
        ).pushReplacement(MaterialPageRoute(builder: (_) => const LobbyPage()));
      }
    } catch (e) {
      if (mounted) _showError(e.toString());
    }
  }

  void _showError(String message) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Erreur', style: TextStyle(color: Colors.red)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('OK', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  Future<bool> _showBlockConflictDialog(String gameId) async {
    final users = _pendingConflictUsers;
    final userList = users.isNotEmpty
        ? users.join(', ')
        : 'un ou plusieurs joueurs';

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: true,
      builder: (context) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text(
          'Conflit de blocage',
          style: TextStyle(color: Color(0xFFE88B00)),
        ),
        content: Text(
          'Vous avez bloqué $userList dans cette salle. '
          'Voulez-vous quand même rejoindre la partie ?',
          style: const TextStyle(color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context, false),
            child: const Text(
              'Annuler',
              style: TextStyle(color: Colors.white54),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            child: const Text(
              'Rejoindre',
              style: TextStyle(color: Color(0xFF26A85A)),
            ),
          ),
        ],
      ),
    );
    _pendingConflictUsers = [];
    return result ?? false;
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF1A1A2E),
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

          Container(color: Colors.black.withValues(alpha: 0.6)),

          SafeArea(
            child: Column(
              children: [
                _buildTopBar(),
                Expanded(
                  child: Padding(
                    padding: const EdgeInsets.symmetric(horizontal: 16),
                    child: Column(
                      children: [
                        Center(
                          child: SizedBox(
                            width: 320,
                            child: _buildJoinByCodePanel(),
                          ),
                        ),
                        Expanded(child: _buildGameList()),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      child: SizedBox(
        height: 48,
        child: Stack(
          alignment: Alignment.center,
          children: [
            Align(
              alignment: Alignment.centerLeft,
              child: TextButton.icon(
                onPressed: () => Navigator.pop(context),
                label: const Text(
                  'Retour',
                  style: TextStyle(color: Colors.white, fontSize: 15),
                ),
                style: TextButton.styleFrom(
                  backgroundColor: const Color(0xFFAE4924),
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 8,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
              ),
            ),
            const Center(
              child: Text(
                "C'est le temps de rejoindre une partie !",
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'TextFont',
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _scanQrCode() async {
    final scannedValue = await Navigator.of(
      context,
    ).push<String>(MaterialPageRoute(builder: (_) => const QrScannerPage()));

    if (!mounted || scannedValue == null) return;

    final code = scannedValue.trim();
    final isValid = RegExp(r'^\d{4}$').hasMatch(code);

    if (!isValid) {
      _showError("Aucune partie n'est associée à ce code QR.");
      return;
    }

    await _joinGame(overrideCode: code);
  }

  Widget _buildJoinByCodePanel() {
    return Container(
      margin: const EdgeInsets.only(top: 8, bottom: 16),
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.55),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white24),
      ),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Rejoindre par code',
            textAlign: TextAlign.center,
            style: TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
              fontFamily: 'TextFont',
            ),
          ),
          const SizedBox(height: 12),
          _buildJoinModeToggle(),
          const SizedBox(height: 16),
          if (_joinMode == _JoinMode.code)
            _buildCodeInput()
          else
            _buildQrSection(),
        ],
      ),
    );
  }

  Widget _buildJoinModeToggle() {
    return Container(
      decoration: BoxDecoration(
        color: Colors.white10,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Row(
        children: [
          _buildModeTab('Code', _JoinMode.code),
          _buildModeTab('Code QR', _JoinMode.qr),
        ],
      ),
    );
  }

  Widget _buildModeTab(String label, _JoinMode mode) {
    final isSelected = _joinMode == mode;
    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _joinMode = mode),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(vertical: 8),
          decoration: BoxDecoration(
            color: isSelected ? const Color(0xFF065c18) : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Text(
            label,
            textAlign: TextAlign.center,
            style: TextStyle(
              color: isSelected ? Colors.white : Colors.white54,
              fontWeight: isSelected ? FontWeight.bold : FontWeight.normal,
              fontSize: 13,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildCodeInput() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        TextField(
          controller: _codeController,
          focusNode: _codeFocusNode,
          maxLength: 4,
          keyboardType: TextInputType.number,
          inputFormatters: [FilteringTextInputFormatter.digitsOnly],
          textAlign: TextAlign.center,
          style: const TextStyle(
            color: Colors.white,
            fontSize: 28,
            letterSpacing: 8,
            fontWeight: FontWeight.bold,
          ),
          decoration: InputDecoration(
            counterText: '',
            hintText: '_ _ _ _',
            hintStyle: TextStyle(
              color: Colors.white38,
              fontSize: 28,
              letterSpacing: 8,
            ),
            filled: true,
            fillColor: Colors.white12,
            border: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: BorderSide.none,
            ),
            focusedBorder: OutlineInputBorder(
              borderRadius: BorderRadius.circular(12),
              borderSide: const BorderSide(color: Color(0xFF065c18), width: 2),
            ),
          ),
          onChanged: (_) => setState(() {}),
        ),
        const SizedBox(height: 14),
        ValueListenableBuilder<TextEditingValue>(
          valueListenable: _codeController,
          builder: (context, value, _) {
            final canJoin = value.text.length == 4 && !_isJoining;
            return ElevatedButton(
              onPressed: canJoin ? () => _joinGame() : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF065c18),
                disabledBackgroundColor: Colors.grey.shade700,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              child: _isJoining
                  ? const SizedBox(
                      height: 20,
                      width: 20,
                      child: CircularProgressIndicator(
                        strokeWidth: 2,
                        color: Colors.white,
                      ),
                    )
                  : const Text(
                      'Rejoindre',
                      style: TextStyle(color: Colors.white, fontSize: 15),
                    ),
            );
          },
        ),
      ],
    );
  }

  Widget _buildQrSection() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.stretch,
      children: [
        const SizedBox(height: 12),
        ElevatedButton.icon(
          onPressed: _scanQrCode,
          icon: const Icon(Icons.qr_code_scanner, color: Colors.white),
          label: const Text(
            'Scanner un code QR',
            style: TextStyle(color: Colors.white, fontSize: 15),
          ),
          style: ElevatedButton.styleFrom(
            backgroundColor: Color(0xFF065c18),
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(10),
            ),
          ),
        ),
        const SizedBox(height: 12),
      ],
    );
  }

  Widget _buildGameList() {
    return Consumer<GameService>(
      builder: (context, gameService, _) {
        return Column(
          children: [
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 8),
              child: const Text(
                'Parties disponibles',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'TextFont',
                ),
              ),
            ),

            Expanded(child: _buildGameCards(gameService)),
          ],
        );
      },
    );
  }

  Widget _buildGameCards(GameService gameService) {
    if (gameService.isLoading) {
      return const Center(
        child: CircularProgressIndicator(color: Color(0xFF065c18)),
      );
    }

    if (gameService.errorMessage != null) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            const Icon(Icons.error_outline, color: Colors.redAccent, size: 40),
            const SizedBox(height: 8),
            Text(
              gameService.errorMessage!,
              style: const TextStyle(color: Colors.white70),
            ),
            const SizedBox(height: 12),
            ElevatedButton(
              onPressed: () => gameService.getGames(),
              child: const Text('Réessayer'),
            ),
          ],
        ),
      );
    }

    if (gameService.games.isEmpty) {
      return const Center(
        child: Text(
          'Aucune partie disponible.',
          style: TextStyle(color: Colors.white54, fontSize: 14),
        ),
      );
    }

    return ListView.builder(
      itemCount: gameService.games.length,
      itemBuilder: (context, index) {
        final game = gameService.games[index];
        final friendUids = context
            .read<FriendService>()
            .friends
            .map((f) => f.uid)
            .toSet();
        final myUid = context.read<AuthService>().uid ?? '';
        final isFriendsBlocked =
            game.friendsOnly &&
            game.creatorUid.isNotEmpty &&
            game.creatorUid != myUid &&
            !friendUids.contains(game.creatorUid);
        return _GameCard(
          game: game,
          onJoin: () => _joinGame(overrideCode: game.gameId),
          isJoining: _isJoining,
          isFriendsBlocked: isFriendsBlocked,
        );
      },
    );
  }
}

class _GameCard extends StatelessWidget {
  final GameModel game;
  final VoidCallback onJoin;
  final bool isJoining;
  final bool isFriendsBlocked;

  const _GameCard({
    required this.game,
    required this.onJoin,
    required this.isJoining,
    this.isFriendsBlocked = false,
  });

  bool get _canJoin =>
      !isFriendsBlocked &&
      ((!game.started && !game.isLocked) ||
          (game.started && game.dropInActive));

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
      decoration: BoxDecoration(
        color: const Color(0x1AFFFFFF),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: _canJoin
              ? Color(0xFF065c18).withValues(alpha: 0.5)
              : Colors.white12,
        ),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    const SizedBox(width: 6),
                    Text(
                      'Code d\'accès : ${game.gameId}',
                      style: const TextStyle(
                        color: Color(0xFF199433),
                        fontWeight: FontWeight.bold,
                        fontSize: 15,
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 6),

                _InfoRow(
                  icon: Icons.map_outlined,
                  label:
                      'Taille de la carte : ${game.mapSize} × ${game.mapSize}',
                ),

                _InfoRow(
                  icon: Icons.people_outline,
                  label: 'Nombre de joueurs en cours : ${game.playerCount}',
                ),

                _InfoRow(
                  icon: Icons.monetization_on_outlined,
                  label: game.entryFee > 0
                      ? 'Prix d\'entrée : ${game.entryFee} 🪙'
                      : 'Prix d\'entrée : Gratuit',
                  color: game.entryFee > 0
                      ? const Color(0xFFFFD700)
                      : Colors.greenAccent,
                ),

                _InfoRow(
                  icon: game.started
                      ? Icons.play_circle_outline
                      : Icons.hourglass_empty,
                  label: game.started ? 'En cours' : 'En attente',
                  color: game.started
                      ? Colors.orangeAccent
                      : Colors.greenAccent,
                ),

                _InfoRow(
                  icon: game.started
                      ? (game.dropInActive ? Icons.lock_open : Icons.lock)
                      : (game.isLocked ? Icons.lock : Icons.lock_open),
                  label: game.started
                      ? (game.dropInActive
                            ? 'Partie joignable'
                            : 'Partie injoignable')
                      : (game.isLocked
                            ? 'Partie verrouillée'
                            : 'Partie ouverte'),
                  color: _canJoin ? Colors.greenAccent : Colors.redAccent,
                ),

                if (game.friendsOnly)
                  _InfoRow(
                    icon: Icons.people,
                    label: isFriendsBlocked
                        ? 'Réservé aux amis du créateur'
                        : 'Amis seulement',
                    color: isFriendsBlocked
                        ? Colors.redAccent
                        : Colors.blueAccent,
                  ),
              ],
            ),
          ),
          const SizedBox(width: 12),

          SizedBox(
            width: 100,
            child: ElevatedButton(
              onPressed: (_canJoin && !isJoining) ? onJoin : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: Color(0xFF065c18),
                disabledBackgroundColor: Colors.grey.shade800,
                padding: const EdgeInsets.symmetric(vertical: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(8),
                ),
              ),
              child: const Text(
                'Rejoindre',
                style: TextStyle(color: Colors.white, fontSize: 13),
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _InfoRow extends StatelessWidget {
  final IconData icon;
  final String label;
  final Color color;

  const _InfoRow({
    required this.icon,
    required this.label,
    this.color = Colors.white70,
  });

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 2),
      child: Row(
        children: [
          Icon(icon, color: color, size: 14),
          const SizedBox(width: 6),
          Text(label, style: TextStyle(color: color, fontSize: 13)),
        ],
      ),
    );
  }
}

enum _JoinMode { code, qr }
