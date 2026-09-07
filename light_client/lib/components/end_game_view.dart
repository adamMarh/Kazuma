import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:light_client/components/chat_room.dart';
import 'package:light_client/models/challenge_models.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/challenge_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/game_audio_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:provider/provider.dart';

class EndGameView extends StatefulWidget {
  const EndGameView({super.key});

  @override
  State<EndGameView> createState() => _EndGameViewState();
}

class _EndGameViewState extends State<EndGameView> {
  static const _victoryReward = 8;
  static const _consolationReward = 3;
  bool _didPlayVictorySound = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CurrencyService>().refreshWallet();
    });
  }

  static const List<_StatColumn> _columns = [
    _StatColumn('name', 'Noms des joueurs', sortable: false),
    _StatColumn('combats', 'Combats ⚔️'),
    _StatColumn('evasions', 'Évasions 🪄'),
    _StatColumn('victories', 'Victoires 🏆'),
    _StatColumn('defeats', 'Défaites 💀'),
    _StatColumn('hpLost', 'PV perdus ❤️'),
    _StatColumn('damageDone', 'Dégâts infligés 🗡️'),
    _StatColumn('itemsPicked', 'Objets ramassés 🧺'),
    _StatColumn('tilesVisitedPercentage', '% Tuiles visitées 👣'),
  ];

  void _sort(String stat, bool asc) {
    Provider.of<GameService>(context, listen: false).sortPlayerStats(stat, asc);
  }

  void _navBack() {
    final gs = Provider.of<GameService>(context, listen: false);
    final gameId = gs.currentGameId;
    if (gameId != null) {
      gs.quitGame(gameId);
    }
    gs.clearCurrentGame();
    Navigator.of(context).pushNamedAndRemoveUntil('/home', (r) => false);
  }

  @override
  Widget build(BuildContext context) {
    final gs = Provider.of<GameService>(context);
    final currencyService = context.watch<CurrencyService>();
    final challengeService = context.watch<ChallengeService?>();
    final challengeResult = challengeService?.challengeResult;
    final activeChallenge = challengeService?.activeChallenge;
    _maybePlayVictorySound(gs);
    final playerStats = gs.playerStats;
    final globalStats = gs.globalStats;
    final gameId = gs.currentGameId;
    final game = gs.activeGame;
    final mySocketId = gs.myPlayer?.socketId;

    final gameDelta = _computeGameDelta(game, mySocketId);
    final challengeDelta = challengeResult?.completed == true
        ? challengeResult!.reward
        : 0;
    final totalDelta = gameDelta + challengeDelta;
    final gameStatusLabel = game != null && mySocketId != null
        ? (_isMyPlayerWinner(game, mySocketId)
              ? 'Partie gagnée ✅'
              : 'Partie perdue ❌')
        : '—';
    final challengeStatusLabel = challengeResult == null
        ? 'Aucun défi'
        : (challengeResult.completed ? 'Défi réussi ✅' : 'Défi perdu ❌');

    return Scaffold(
      backgroundColor: Colors.black,
      body: Container(
        decoration: const BoxDecoration(
          color: Color.fromRGBO(62, 29, 15, 1),
          image: DecorationImage(
            image: AssetImage('assets/images/background/background-game.gif'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                _buildNavButton('Quitter', _navBack),
                const SizedBox(height: 16),

                Expanded(
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      // LEFT PANEL: Stats Table + Global Stats / Money Summary
                      Expanded(
                        flex: 138,
                        child: Column(
                          children: [
                            Expanded(
                              flex: 2,
                              child: _buildGlassPanel(
                                child: Column(
                                  children: [
                                    const Padding(
                                      padding: EdgeInsets.symmetric(
                                        vertical: 14,
                                      ),
                                      child: Text(
                                        'STATS',
                                        style: TextStyle(
                                          color: Color(0xFFD4AF37),
                                          fontSize: 22,
                                          fontWeight: FontWeight.w800,
                                          letterSpacing: 0.5,
                                        ),
                                      ),
                                    ),
                                    Expanded(
                                      child: _buildStatsTable(playerStats),
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: 14),
                            // Combined Stats Section
                            IntrinsicHeight(
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.stretch,
                                children: [
                                  Expanded(
                                    child: _buildGlassPanel(
                                      child: _buildGlobalStats(globalStats),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: _buildGlassPanel(
                                      child: _buildMoneySummary(
                                        game: game,
                                        challengeResult: challengeResult,
                                        activeChallenge: activeChallenge,
                                        gameStatusLabel: gameStatusLabel,
                                        challengeStatusLabel:
                                            challengeStatusLabel,
                                        gameDelta: gameDelta,
                                        challengeDelta: challengeDelta,
                                        totalDelta: totalDelta,
                                        newBalance:
                                            currencyService.wallet.balance,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 20),

                      // RIGHT PANEL: Chat Room
                      Expanded(
                        flex: 62,
                        child: _buildGlassPanel(
                          child: ChatRoom(gameId: gameId ?? ''),
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlassPanel({required Widget child}) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(0),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          decoration: BoxDecoration(
            color: const Color.fromRGBO(62, 29, 15, 0.65),
            border: Border.all(
              color: const Color.fromRGBO(255, 222, 171, 0.4),
              width: 2,
            ),
            borderRadius: BorderRadius.circular(0),
          ),
          child: child,
        ),
      ),
    );
  }

  Widget _buildNavButton(String label, VoidCallback onPressed) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color.fromRGBO(62, 29, 15, 0.8),
        foregroundColor: const Color(0xFFD4AF37),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
        side: const BorderSide(color: Color(0xFFD4AF37), width: 1),
        elevation: 3,
        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
      ),
      child: Text(label, style: const TextStyle(fontWeight: FontWeight.bold)),
    );
  }

  Widget _buildStatsTable(List<Map<String, dynamic>> playerStats) {
    const double minTableWidth = 920;

    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0),
      child: Scrollbar(
        thumbVisibility: true,
        thickness: 8.0,
        radius: const Radius.circular(8),
        child: SingleChildScrollView(
          scrollDirection: Axis.horizontal,
          child: Padding(
            padding: const EdgeInsets.only(bottom: 12.0),
            child: ConstrainedBox(
              constraints: const BoxConstraints(minWidth: minTableWidth),
              child: SingleChildScrollView(
                child: DataTable(
                  headingRowColor: WidgetStateProperty.all(
                    const Color.fromRGBO(0, 0, 0, 0.4),
                  ),
                  headingRowHeight: 60,
                  dataRowColor: WidgetStateProperty.resolveWith<Color>((
                    states,
                  ) {
                    final index = states.contains(WidgetState.selected)
                        ? 0
                        : -1;
                    // Color rows relative to their index in the current displayed list
                    return index.isEven
                        ? const Color.fromRGBO(0, 0, 0, 0.15)
                        : const Color.fromRGBO(0, 0, 0, 0.3);
                  }),
                  border: TableBorder.all(
                    color: const Color.fromRGBO(212, 175, 55, 0.2),
                    width: 1,
                  ),
                  columnSpacing: 10,
                  horizontalMargin: 8,
                  dataRowMinHeight: 48,
                  dataRowMaxHeight: 48,
                  columns: _columns.map((col) {
                    return DataColumn(
                      label: col.sortable
                          ? Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  col.label,
                                  textAlign: TextAlign.center,
                                  style: const TextStyle(
                                    color: Color(0xFFD4AF37),
                                    fontWeight: FontWeight.bold,
                                    fontSize: 16,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisSize: MainAxisSize.min,
                                  children: [
                                    GestureDetector(
                                      onTap: () => _sort(col.key, false),
                                      child: Image.asset(
                                        'assets/HUD/up-icon.png',
                                        width: 18,
                                        height: 18,
                                        errorBuilder: (_, _, _) => const Icon(
                                          Icons.arrow_upward,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                    const SizedBox(width: 2),
                                    GestureDetector(
                                      onTap: () => _sort(col.key, true),
                                      child: Image.asset(
                                        'assets/HUD/down-icon.png',
                                        width: 18,
                                        height: 18,
                                        errorBuilder: (_, _, _) => const Icon(
                                          Icons.arrow_downward,
                                          size: 14,
                                          color: Colors.white,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            )
                          : Text(
                              col.label,
                              style: const TextStyle(
                                color: Color(0xFFD4AF37),
                                fontWeight: FontWeight.bold,
                                fontSize: 16,
                              ),
                            ),
                    );
                  }).toList(),
                  rows: [
                    ...playerStats.asMap().entries.map((entry) {
                      final idx = entry.key;
                      final stat = entry.value;
                      final hasLeft = stat['hasLeft'] == true;
                      final name = stat['name']?.toString() ?? '-';
                      final displayName = hasLeft ? '$name (abandon)' : name;

                      return DataRow(
                        color: WidgetStateProperty.all(
                          idx.isEven
                              ? const Color.fromRGBO(0, 0, 0, 0.15)
                              : const Color.fromRGBO(0, 0, 0, 0.3),
                        ),
                        cells: [
                          DataCell(
                            Text(
                              displayName,
                              style: TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                                decoration: hasLeft
                                    ? TextDecoration.lineThrough
                                    : null,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['combats'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['evasions'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['victories'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['defeats'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['hpLost'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['damageDone'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['itemsPicked'] ?? 0}',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                          DataCell(
                            Text(
                              '${stat['tilesVisitedPercentage'] ?? 0}%',
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 18,
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ),
                        ],
                      );
                    }),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildGlobalStats(Map<String, dynamic>? stats) {
    return Container(
      padding: const EdgeInsets.all(15),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(
              child: Text(
                'STATISTIQUES GLOBALES',
                style: TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w800,
                  color: Color(0xFFD4AF37),
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(height: 10),
            _globalStatRow(
              'Durée de la partie',
              stats?['formattedDuration']?.toString() ?? '—',
            ),
            _globalStatRow(
              'Nombre de tours totaux',
              '${stats?['totalTurns'] ?? '—'}',
            ),
            _globalStatRow(
              '% Tuiles visitées par au moins un joueur',
              '${stats?['tilesVisitedPercentage'] ?? '—'}%',
            ),
            _globalStatRow(
              '% Portes manipulées',
              '${stats?['doorManipulatedPercentage'] ?? '—'}%',
            ),
            if (stats?['playersWithFlag'] != null)
              _globalStatRow(
                'Nombre de joueurs ayant eu le drapeau',
                '${stats?['playersWithFlag']}',
              ),
          ],
        ),
      ),
    );
  }

  Widget _globalStatRow(String label, String value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 0),
      child: Container(
        constraints: const BoxConstraints(minHeight: 28),
        padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
        decoration: BoxDecoration(
          color: const Color.fromRGBO(0, 0, 0, 0.15),
          border: Border.all(color: const Color.fromRGBO(255, 222, 171, 0.2)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Expanded(
              child: Text(
                label,
                style: const TextStyle(
                  fontSize: 10,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFD4AF37),
                ),
                softWrap: true,
              ),
            ),
            const SizedBox(width: 4),
            Text(
              value,
              style: const TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMoneySummary({
    required Game? game,
    PlayerChallenge? challengeResult,
    PlayerChallenge? activeChallenge,
    required String gameStatusLabel,
    required String challengeStatusLabel,
    required int gameDelta,
    required int challengeDelta,
    required int totalDelta,
    required int newBalance,
  }) {
    final challenge = challengeResult ?? activeChallenge;
    final progress = challengeResult?.progress ?? challenge?.progress;
    final target = challenge?.target;

    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(15),
      child: SingleChildScrollView(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Center(
              child: Text(
                'BILAN MONÉTAIRE',
                style: TextStyle(
                  color: Color(0xFFD4AF37),
                  fontWeight: FontWeight.w800,
                  fontSize: 14,
                  letterSpacing: 0.5,
                ),
              ),
            ),
            const SizedBox(height: 10),
            if (game != null && game.entryFee > 0)
              _moneyRow('Mise d\'entrée', '${game.entryFee} 🪙'),
            if (game != null && game.entryFee > 0)
              _moneyRow('Pot total', '${game.pot} 🪙'),
            _moneyRow(
              'Partie ($gameStatusLabel)',
              _formatSignedCoins(gameDelta),
            ),
            _moneyRow(
              'Défi ($challengeStatusLabel)',
              _formatSignedCoins(challengeDelta),
              valueColor: challengeDelta > 0
                  ? const Color(0xFF90EE90)
                  : Colors.white,
            ),
            const Divider(color: Color(0x66FFFFFF), height: 0),
            _moneyRow(
              'Somme totale',
              _formatSignedCoins(totalDelta),
              valueColor: const Color(0xFFFFE082),
              bold: true,
            ),
            if (challenge != null && progress != null && target != null)
              _moneyRow('Progression défi', '$progress / $target'),
            _moneyRow(
              'Nouveau solde',
              '$newBalance 🪙',
              valueColor: const Color(0xFFFFD700),
            ),
          ],
        ),
      ),
    );
  }

  Widget _moneyRow(
    String label,
    String value, {
    Color valueColor = Colors.white,
    bool bold = false,
  }) {
    return Container(
      constraints: const BoxConstraints(minHeight: 28),
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 4),
      decoration: BoxDecoration(
        color: bold
            ? const Color.fromRGBO(0, 0, 0, 0.2)
            : const Color.fromRGBO(0, 0, 0, 0.15),
        border: Border.all(
          color: bold
              ? const Color.fromRGBO(255, 222, 171, 0.3)
              : const Color.fromRGBO(255, 222, 171, 0.2),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        crossAxisAlignment: CrossAxisAlignment.center,
        children: [
          Expanded(
            child: Text(
              label,
              style: const TextStyle(
                color: Color(0xFFD4AF37),
                fontSize: 10,
                fontWeight: FontWeight.w700,
              ),
              softWrap: true,
            ),
          ),
          const SizedBox(width: 4),
          Text(
            value,
            style: TextStyle(
              color: valueColor,
              fontSize: 11,
              fontWeight: bold ? FontWeight.w800 : FontWeight.w700,
              letterSpacing: 0.3,
            ),
          ),
        ],
      ),
    );
  }

  int _computeGameDelta(Game? game, String? mySocketId) {
    if (game == null || mySocketId == null) return 0;

    final isWinner = _isMyPlayerWinner(game, mySocketId);
    final hasPot = game.pot > 0;

    if (hasPot) {
      if (isWinner) {
        final winners = _countWinners(game);
        return (game.pot / winners).floor() + _victoryReward;
      }
      return (_consolationReward / 2).floor();
    }

    return isWinner ? _victoryReward : _consolationReward;
  }

  int _countWinners(Game game) {
    final activeHumans = game.players.where((p) => !p.isBot && !p.hasLeft);

    if (game.map['gameMode']?.toString() == 'CTF' &&
        (game.winner == 'red' || game.winner == 'blue')) {
      final winnerTeam = game.winner;
      final winningSocketIds = game.teams[winnerTeam]?.toSet() ?? <String>{};
      final winnerCount = activeHumans
          .where((p) => winningSocketIds.contains(p.socketId))
          .length;
      return winnerCount > 0 ? winnerCount : 1;
    }

    final players = activeHumans.toList();
    final battleWinners = players.where((p) => p.battlesWon >= 3).toList();
    if (battleWinners.isNotEmpty) return battleWinners.length;

    final maxBattlesWon = players.isEmpty
        ? 0
        : players.map((p) => p.battlesWon).reduce((a, b) => a > b ? a : b);
    final byBestScore = players.where((p) => p.battlesWon == maxBattlesWon);
    final count = byBestScore.length;
    return count > 0 ? count : 1;
  }

  String _formatSignedCoins(int amount) {
    final sign = amount > 0 ? '+' : '';
    return '$sign$amount 🪙';
  }

  Future<void> _maybePlayVictorySound(GameService gs) async {
    if (_didPlayVictorySound) return;

    final game = gs.activeGame;
    final myPlayer = gs.myPlayer;
    if (game == null || myPlayer == null || !game.ended) return;

    final wallet = context.read<CurrencyService>().wallet;
    final ownsVictorySound = wallet.ownedSounds.contains('snd_win_music');
    if (!ownsVictorySound) return;

    if (!_isMyPlayerWinner(game, myPlayer.socketId)) return;

    _didPlayVictorySound = true;
    try {
      await GameAudioService.playOneShot('sounds/victory.wav', volume: 0.6);
    } catch (_) {}
  }

  bool _isMyPlayerWinner(Game game, String mySocketId) {
    final winner = game.winner.trim();
    if (winner.isEmpty) return false;

    if (game.map['gameMode']?.toString() == 'CTF') {
      if (winner != 'red' && winner != 'blue') return false;
      return game.teams[winner]?.contains(mySocketId) ?? false;
    }

    for (final player in game.players) {
      if (player.socketId == mySocketId) {
        return player.name == winner;
      }
    }
    return false;
  }
}

class _StatColumn {
  final String key;
  final String label;
  final bool sortable;
  const _StatColumn(this.key, this.label, {this.sortable = true});
}
