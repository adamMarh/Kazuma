import 'dart:async';
import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:light_client/main.dart';
import 'package:light_client/pages/join_game_page.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/friend/friend_models.dart';
import 'package:light_client/services/game_service.dart';

import 'package:light_client/pages/lobby_page.dart';
import 'package:light_client/components/character_form_dialog.dart';
import 'package:light_client/services/auth/auth_service.dart';

/// Mixin to add game invitation listening to any StatefulWidget.
/// Add this to pages where invitations should be shown (e.g., HomePage).
mixin GameInvitationMixin<T extends StatefulWidget> on State<T> {
  StreamSubscription<GameInvitation>? _invitationSubscription;
  StreamSubscription<Map<String, dynamic>>? _blockConflictSub;
  List<String> _pendingConflictUsers = [];

  void initInvitationListener() {
    final friendService = Provider.of<FriendService>(context, listen: false);

    _invitationSubscription = friendService.invitationStream.listen((
      invitation,
    ) {
      if (!mounted) return;

      // Don't show if busy
      if (friendService.isBusy) return;

      _showInvitationDialog(invitation);
    });

    _blockConflictSub = friendService.lobbyBlockConflictStream.listen((data) {
      final users = data['conflictUsers'];
      if (users is List) {
        _pendingConflictUsers = users.map((e) => e.toString()).toList();
      }
    });
  }

  void disposeInvitationListener() {
    _invitationSubscription?.cancel();
    _blockConflictSub?.cancel();
  }

  Future<void> _showInvitationDialog(GameInvitation invitation) async {
    final accepted = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => _InvitationDialog(invitation: invitation),
    );

    if (accepted == true) {
      if (mounted) {
        _handleAcceptInvitation(invitation.gameId);
      }
    }
  }

  Future<void> _handleAcceptInvitation(String roomId) async {
    final gameService = Provider.of<GameService>(context, listen: false);
    final authService = Provider.of<AuthService>(context, listen: false);
    final friendService = Provider.of<FriendService>(context, listen: false);

    try {
      await gameService.checkGameId(roomId, joinerUid: authService.uid);
      if (!mounted) return;

      await _proceedAfterCheck(roomId, gameService, authService);
    } catch (e) {
      if (!mounted) return;
      final err = e.toString();
      if (err.contains('blockConflict:')) {
        final confirmed = await _showBlockConflictDialog(roomId);
        if (confirmed && mounted) {
          try {
            final ackData = await friendService.confirmLobbyBlock(roomId);
            if (!mounted) return;
            final rawGame = ackData['game'];
            if (rawGame is Map) {
              gameService.applyGameData(Map<String, dynamic>.from(rawGame));
            }
            await _proceedAfterCheck(roomId, gameService, authService);
          } catch (e2) {
            if (mounted) _showErrorDialog(e2.toString());
          }
        }
      } else {
        _showErrorDialog(err);
      }
    }
  }

  Future<void> _proceedAfterCheck(
    String roomId,
    GameService gameService,
    AuthService authService,
  ) async {
    final selectedAvatars = gameService.activeGame?.selectedAvatars ?? {};
    final unavailable = selectedAvatars.values.toList();

    final result = await showDialog<CharacterData>(
      context: context,
      barrierDismissible: false,
      builder: (_) => CharacterFormDialog(unavailableAvatars: unavailable),
    );

    if (result == null || !mounted) {
      gameService.deselectAvatar(roomId);
      gameService.leavePendingRoom(roomId);
      gameService.clearCurrentGame();
      return;
    }

    final playerName = authService.username ?? 'Joueur';
    final attributes = result.attributes.map(
      (key, value) =>
          MapEntry(key, {'value': value['value'], 'dice': value['dice']}),
    );

    final payload = await gameService.joinGame(
      roomId,
      playerName,
      result.avatar,
      attributes,
    );

    if (!mounted) return;

    final game = payload['game'] as Map?;
    final isStarted = game?['started'] == true;

    // Ensure we push completely over assuming we might be in home/elsewhere
    if (isStarted) {
      Navigator.of(context).pushReplacementNamed('/in-game');
    } else {
      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LobbyPage()));
    }
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

  void _showErrorDialog(String message) {
    if (!mounted) return;
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: const Text('Erreur', style: TextStyle(color: Colors.red)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('OK', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }
}

class _InvitationDialog extends StatefulWidget {
  final GameInvitation invitation;

  const _InvitationDialog({required this.invitation});

  @override
  State<_InvitationDialog> createState() => _InvitationDialogState();
}

class _InvitationDialogState extends State<_InvitationDialog> {
  @override
  Widget build(BuildContext context) {
    return AlertDialog(
      backgroundColor: const Color(0xFF1A1A2E),
      title: const Text('Invitation', style: TextStyle(color: Color(0xFF26A85A))),
      content: Text(
        '${widget.invitation.fromUsername} vous invite à jouer !',
        style: const TextStyle(color: Colors.white70),
      ),
      actions: [
        TextButton(
          onPressed: () => Navigator.pop(context, false),
          child: const Text('Refuser', style: TextStyle(color: Colors.red)),
        ),
        TextButton(
          onPressed: () => Navigator.pop(context, true),
          child: const Text('Accepter', style: TextStyle(color: Color(0xFF26A85A))),
        ),
      ],
    );
  }
}

class GameInvitationOverlay extends StatefulWidget {
  final Widget child;

  const GameInvitationOverlay({super.key, required this.child});

  @override
  State<GameInvitationOverlay> createState() => _GameInvitationOverlayState();
}

class _GameInvitationOverlayState extends State<GameInvitationOverlay> {
  GameInvitation? _currentInvitation;
  StreamSubscription? _sub;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      final fs = context.read<FriendService>();
      _sub = fs.invitationStream.listen((invitation) {
        if (!mounted) return;
        final gs = context.read<GameService>();
        if (gs.currentGameId != null) return; // In game, ignore
        setState(() {
          _currentInvitation = invitation;
        });
      });
    });
  }

  @override
  void dispose() {
    _sub?.cancel();
    super.dispose();
  }

  void _onAccept() async {
    final inv = _currentInvitation;
    setState(() => _currentInvitation = null);
    if (inv != null) {
      if (mounted) {
        // Auto-join flow -> sends to JoinGamePage with auto join game Id
        Navigator.of(globalNavigatorKey.currentContext ?? context, rootNavigator: true).push(
          MaterialPageRoute(
            builder: (context) => const JoinGamePage(),
            settings: RouteSettings(
              arguments: {'autoJoinGameId': inv.gameId},
            ),
          ),
        );
      }
    }
  }

  void _onDecline() {
    setState(() => _currentInvitation = null);
  }

  @override
  Widget build(BuildContext context) {
    return Directionality(
      textDirection: TextDirection.ltr,
      child: Stack(
      children: [
        widget.child,
        if (_currentInvitation != null)
          Positioned(
            left: 20,
            bottom: 20,
            child: Material(
              color: Colors.transparent,
              child: _buildNotificationPopup(),
            ),
          ),
      ],
    ));
  }

  Widget _buildNotificationPopup() {
    return Container(
      width: 320,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E1E1E),
        borderRadius: BorderRadius.circular(12),
        boxShadow: const [
          BoxShadow(
            color: Colors.black54,
            blurRadius: 10,
            offset: Offset(0, 4),
          ),
        ],
        border: Border.all(color: const Color(0xFF00FF00), width: 1),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisSize: MainAxisSize.min,
        children: [
          Row(
            children: [
              const Icon(Icons.videogame_asset, color: Color(0xFF00FF00)),
              const SizedBox(width: 8),
              const Text(
                'Invitation',
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 16,
                  fontWeight: FontWeight.bold,
                ),
              ),
              const Spacer(),
              GestureDetector(
                onTap: _onDecline,
                child: const Icon(Icons.close, color: Colors.grey, size: 20),
              )
            ],
          ),
          const SizedBox(height: 12),
          Text(
            '${_currentInvitation!.fromUsername} vous a invité à rejoindre une partie !',
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
          const SizedBox(height: 16),
          Row(
            mainAxisAlignment: MainAxisAlignment.end,
            children: [
              TextButton(
                onPressed: _onDecline,
                child: const Text('Refuser', style: TextStyle(color: Colors.redAccent)),
              ),
              const SizedBox(width: 8),
              ElevatedButton(
                style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF26A85A)),
                onPressed: _onAccept,
                child: const Text('Rejoindre', style: TextStyle(color: Colors.white)),
              ),
            ],
          )
        ],
      ),
    );
  }
}
