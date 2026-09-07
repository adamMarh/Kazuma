import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/config/asset_constants.dart';
import 'package:light_client/models/game_models.dart';
import 'package:light_client/services/combat_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/game_audio_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:provider/provider.dart';

class CombatView extends StatefulWidget {
  final CombatState combatState;

  const CombatView({super.key, required this.combatState});

  @override
  State<CombatView> createState() => _CombatViewState();
}

class _CombatViewState extends State<CombatView> {
  String _itemMessage = '';
  bool _showItemMessage = false;
  Timer? _itemMessageTimer;
  StreamSubscription<Map<String, dynamic>>? _itemEffectSub;
  StreamSubscription<Map<String, dynamic>>? _combatEndedSub;

  @override
  void initState() {
    super.initState();
    final combatService = context.read<CombatService>();
    final gameService = context.read<GameService>();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      context.read<CurrencyService>().refreshWallet();
    });

    _itemEffectSub = combatService.itemEffectStream.listen((data) {
      final myId = gameService.myPlayer?.socketId;
      if (data['playerId'] == myId) {
        final itemType = data['itemType']?.toString() ?? '';
        if (itemType == 'potion' && data['activated'] == true) {
          _showItem('Votre potion a été activée! +3 PV');
        } else if (itemType == 'hourglass' && data['activated'] == true) {
          _showItem('Le sablier a été activé! Le combat recommence!');
        } else if (itemType == 'crystal' && data['activated'] == true) {
          _showItem('Tu ne peux pas fuir! Ton adversaire possède un cristal!');
        }
      }
    });
  }

  void _showItem(String msg) {
    _itemMessageTimer?.cancel();
    setState(() {
      _itemMessage = msg;
      _showItemMessage = true;
    });
    _itemMessageTimer = Timer(const Duration(seconds: 3), () {
      if (mounted) setState(() => _showItemMessage = false);
    });
  }

  @override
  void dispose() {
    _itemEffectSub?.cancel();
    _combatEndedSub?.cancel();
    _itemMessageTimer?.cancel();
    super.dispose();
  }

  Player? _me(CombatState cs, String? myId) {
    if (cs.attacker?.socketId == myId) return cs.attacker;
    if (cs.target?.socketId == myId) return cs.target;
    return null;
  }

  Player? _opponent(CombatState cs, String? myId) {
    if (cs.attacker?.socketId == myId) return cs.target;
    if (cs.target?.socketId == myId) return cs.attacker;
    return null;
  }

  bool _isSpectator(CombatState cs, String? myId) =>
      cs.attacker?.socketId != myId && cs.target?.socketId != myId;

  bool _isMyAttackTurn(CombatState cs, String? myId) {
    return cs.attacker?.socketId == myId;
  }

  Widget _buildHealthBar(Player? player, Map<String, int> defaultHp) {
    if (player == null) return const SizedBox();
    final maxHP = defaultHp[player.socketId] ?? player.healthpoints;
    final curHP = player.healthpoints.clamp(0, maxHP);

    return Row(
      children: List.generate(maxHP, (i) {
        final filled = i < curHP;
        Color color;
        if (!filled) {
          color = Colors.grey.shade800;
        } else if (curHP <= maxHP * 0.3) {
          color = Colors.red;
        } else if (curHP <= maxHP * 0.5) {
          color = Colors.amber;
        } else {
          color = Colors.green;
        }
        return Expanded(
          child: Container(
            height: 14,
            margin: const EdgeInsets.symmetric(horizontal: 1),
            decoration: BoxDecoration(
              color: color,
              borderRadius: BorderRadius.circular(2),
            ),
          ),
        );
      }),
    );
  }

  Widget _buildStatsColumn(Player? player) {
    if (player == null) return const SizedBox();
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _stat('ATQ', player.attack),
        _stat('DEF', player.defense),
        _stat('VIT', player.speed),
        _stat('Dé ATQ', player.dice['atk'] ?? 0),
        _stat('Dé DEF', player.dice['def'] ?? 0),
      ],
    );
  }

  Widget _stat(String label, int value) {
    return Padding(
      padding: const EdgeInsets.symmetric(vertical: 1),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Text(
            label,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 11,
              fontWeight: FontWeight.w600,
            ),
          ),
          const SizedBox(width: 8),
          Text(
            '$value',
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
        ],
      ),
    );
  }

  Widget _buildFighterPanel(Player? player, {required bool alignLeft}) {
    if (player == null) return const SizedBox();
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Text(
          player.name,
          style: const TextStyle(
            fontSize: 16,
            fontWeight: FontWeight.bold,
            color: Colors.white,
            shadows: [Shadow(color: Colors.black, offset: Offset(1, 1))],
          ),
        ),
        const SizedBox(height: 4),
        Image.asset(
          avatarAsset(player.avatar),
          width: 90,
          height: 90,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => CircleAvatar(
            radius: 40,
            backgroundColor: Colors.white,
            child: Text(
              player.name[0],
              style: const TextStyle(fontSize: 28, fontWeight: FontWeight.bold),
            ),
          ),
        ),
      ],
    );
  }

  @override
  Widget build(BuildContext context) {
    final combatService = Provider.of<CombatService>(context);
    final gameService = Provider.of<GameService>(context);
    final cs = combatService.combatState ?? widget.combatState;
    final myId = gameService.myPlayer?.socketId;
    final isSpectator = _isSpectator(cs, myId);

    // For spectators: show attacker on the left and target on the right.
    // For participants: show self on the left and opponent on the right.
    final leftPlayer = isSpectator ? cs.attacker : _me(cs, myId);
    final rightPlayer = isSpectator ? cs.target : _opponent(cs, myId);
    final isMyTurn = _isMyAttackTurn(cs, myId);
    final defaultHp = combatService.defaultHp;
    final maxFlee = 2;

    return Stack(
      fit: StackFit.expand,
      children: [
        Positioned.fill(
          child: Image.asset(
            'assets/images/background/background-fight.gif',
            fit: BoxFit.cover,

            errorBuilder: (_, _, _) => Image.asset(
              'assets/images/background/background-fighting.jpg',
              fit: BoxFit.cover,
              errorBuilder: (_, _, _) =>
                  Container(color: const Color(0xFF1A0F0A)),
            ),
          ),
        ),

        Positioned.fill(
          child: Container(color: Colors.black.withValues(alpha: 0.15)),
        ),

        SafeArea(
          child: LayoutBuilder(
            builder: (context, constraints) {
              return Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  children: [
                    _buildCombatTimer(combatService),
                    const SizedBox(height: 8),

                    Expanded(
                      child: Row(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Expanded(
                            child: Column(
                              children: [
                                if (isSpectator)
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 4),
                                    child: Text(
                                      'Attaquant',
                                      style: TextStyle(
                                        color: Colors.orangeAccent,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF333333),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: _buildHealthBar(leftPlayer, defaultHp),
                                ),
                                const SizedBox(height: 6),

                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.5),
                                    borderRadius: BorderRadius.circular(5),
                                  ),
                                  child: _buildStatsColumn(leftPlayer),
                                ),
                                const Spacer(),

                                _buildFighterPanel(leftPlayer, alignLeft: true),
                              ],
                            ),
                          ),

                          SizedBox(
                            width: constraints.maxWidth * 0.30,
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                const Text(
                                  'VS',
                                  style: TextStyle(
                                    color: Colors.white,
                                    fontSize: 28,
                                    fontWeight: FontWeight.bold,
                                    shadows: [
                                      Shadow(
                                        color: Colors.black,
                                        offset: Offset(2, 2),
                                      ),
                                    ],
                                  ),
                                ),
                                const SizedBox(height: 16),
                                _buildDiceResults(cs),
                              ],
                            ),
                          ),

                          Expanded(
                            child: Column(
                              children: [
                                if (isSpectator)
                                  const Padding(
                                    padding: EdgeInsets.only(bottom: 4),
                                    child: Text(
                                      'Défenseur',
                                      style: TextStyle(
                                        color: Colors.lightBlueAccent,
                                        fontSize: 11,
                                        fontWeight: FontWeight.bold,
                                      ),
                                    ),
                                  ),
                                Container(
                                  padding: const EdgeInsets.all(4),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFF333333),
                                    borderRadius: BorderRadius.circular(4),
                                  ),
                                  child: _buildHealthBar(
                                    rightPlayer,
                                    defaultHp,
                                  ),
                                ),
                                const SizedBox(height: 6),
                                Container(
                                  width: double.infinity,
                                  padding: const EdgeInsets.symmetric(
                                    horizontal: 12,
                                    vertical: 8,
                                  ),
                                  decoration: BoxDecoration(
                                    color: Colors.black.withValues(alpha: 0.5),
                                    borderRadius: BorderRadius.circular(5),
                                  ),
                                  child: _buildStatsColumn(rightPlayer),
                                ),
                                const Spacer(),
                                _buildFighterPanel(
                                  rightPlayer,
                                  alignLeft: false,
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 8),

                    if (isSpectator)
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          '👁 Mode Spectateur — Vous observez le combat',
                          style: TextStyle(
                            color: Colors.white70,
                            fontSize: 13,
                            fontStyle: FontStyle.italic,
                          ),
                        ),
                      )
                    else if (isMyTurn)
                      _buildActionPanel(
                        combatService,
                        rightPlayer,
                        leftPlayer,
                        maxFlee,
                      )
                    else
                      const Padding(
                        padding: EdgeInsets.symmetric(vertical: 8),
                        child: Text(
                          "C'est le tour de l'adversaire…",
                          style: TextStyle(color: Colors.white70, fontSize: 14),
                        ),
                      ),
                    if (_showItemMessage) _buildItemMessage(),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildCombatTimer(CombatService cs) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(20),
        boxShadow: const [BoxShadow(color: Colors.black45, blurRadius: 8)],
      ),
      child: Text(
        cs.combatTimerRunning ? '${cs.combatTimer}' : '…',
        style: TextStyle(
          fontSize: 20,
          fontWeight: FontWeight.bold,
          color: cs.combatTimer <= 2 ? Colors.red : Colors.white,
        ),
      ),
    );
  }

  Widget _buildDiceResults(CombatState cs) {
    final atkRoll = cs.attackResult['attackDiceRoll'] ?? 0;
    final defRoll = cs.attackResult['defenseDiceRoll'] ?? 0;
    final dmg = cs.attackResult['damage'] ?? 0;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 25, vertical: 15),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.8),
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.casino, color: Colors.orange, size: 16),
              const SizedBox(width: 4),
              Text(
                'Attaque: ${atkRoll > 0 ? atkRoll : '?'}',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              const Icon(Icons.shield, color: Colors.blue, size: 16),
              const SizedBox(width: 4),
              Text(
                'Défense: ${defRoll > 0 ? defRoll : '?'}',
                style: const TextStyle(color: Colors.white, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Text(
            'Dégâts: $dmg',
            style: TextStyle(
              color: dmg > 0 ? Colors.red.shade300 : Colors.white70,
              fontSize: 14,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionPanel(
    CombatService combatService,
    Player? opponent,
    Player? me,
    int maxFlee,
  ) {
    final fleeAttempts = me?.fleeAttempts ?? 0;
    final canFlee = fleeAttempts < maxFlee;

    return Row(
      mainAxisAlignment: MainAxisAlignment.center,
      children: [
        ElevatedButton(
          onPressed: () async {
            if (opponent == null) return;

            final wallet = context.read<CurrencyService>().wallet;
            final ownsAttackSound = wallet.ownedSounds.contains('snd_attack');
            if (ownsAttackSound) {
              try {
                await GameAudioService.playOneShot(
                  'sounds/attack.wav',
                  volume: 0.75,
                );
              } catch (_) {}
            }

            combatService.attackOpponent(opponent.socketId);
          },
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFFE74C3C),
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            elevation: 4,
          ),
          child: const Text(
            'ATTAQUER',
            style: TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(width: 16),

        ElevatedButton(
          onPressed: canFlee ? () => combatService.attemptFlee() : null,
          style: ElevatedButton.styleFrom(
            backgroundColor: canFlee
                ? const Color(0xFF3498DB)
                : Colors.grey.shade700,
            foregroundColor: Colors.white,
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(8),
            ),
            elevation: 4,
          ),
          child: Text(
            'FUIR (${maxFlee - fleeAttempts} restantes)',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
        ),
      ],
    );
  }

  Widget _buildItemMessage() {
    return Container(
      margin: const EdgeInsets.only(top: 8),
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.black87,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.amber, width: 1),
      ),
      child: Text(
        _itemMessage,
        style: const TextStyle(color: Colors.amber, fontSize: 13),
        textAlign: TextAlign.center,
      ),
    );
  }
}
