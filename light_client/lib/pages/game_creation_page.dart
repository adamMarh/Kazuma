import 'dart:async';
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:light_client/components/character_form_dialog.dart';
import 'package:light_client/pages/lobby_page.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/maps_service.dart';
import 'package:light_client/models/game_models.dart';
import 'package:provider/provider.dart';

class GameCreationPage extends StatefulWidget {
  const GameCreationPage({super.key});

  @override
  State<GameCreationPage> createState() => _GameCreationPageState();
}

class _GameCreationPageState extends State<GameCreationPage> {
  GameMap? _selectedMap;
  int _entryFee = 0;
  bool _friendsOnly = false;
  bool _isCreating = false;
  String? _inlineError;
  Timer? _errorTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      final username = context.read<AuthService>().username ?? '';
      context.read<MapsService>().fetchMapsForGameCreation(username);
    });
  }

  @override
  void dispose() {
    _errorTimer?.cancel();
    super.dispose();
  }

  Future<void> _onNext() async {
    if (_selectedMap == null) return;

    final authService = context.read<AuthService>();
    final mapsService = context.read<MapsService>();
    final username = authService.username ?? '';

    bool isAvailable;
    try {
      isAvailable = await mapsService.checkGameAvailability(
        _selectedMap!.id!,
        username,
      );
    } catch (_) {
      if (!mounted) return;
      _showInlineError(
        'Une erreur est survenue lors de la vérification du jeu.',
      );
      return;
    }

    if (!mounted) return;

    if (!isAvailable) {
      _showInlineError("La carte sélectionnée n'est plus disponible.");
      setState(() => _selectedMap = null);
      mapsService.fetchMapsForGameCreation(username);
      return;
    }

    final result = await showDialog<CharacterData>(
      context: context,
      barrierDismissible: false,
      builder: (_) => const CharacterFormDialog(unavailableAvatars: []),
    );

    if (result == null || !mounted) return;

    await _createGame(data: result);
  }

  Future<void> _createGame({required CharacterData data}) async {
    setState(() => _isCreating = true);

    final gameService = context.read<GameService>();
    final authService = context.read<AuthService>();
    final playerName = authService.username ?? 'Joueur';

    final attributes = data.attributes.map(
      (key, value) =>
          MapEntry(key, {'value': value['value'], 'dice': value['dice']}),
    );

    final mapData = {
      '_id': _selectedMap!.id,
      'name': _selectedMap!.name,
      'size': _selectedMap!.size,
      'gameMode': _selectedMap!.gameMode,
      'description': _selectedMap!.description,
      'tiles': _selectedMap!.tiles,
      'items': _selectedMap!.items,
      'imageUrl': '',
    };

    try {
      await gameService.createGame(
        playerName,
        data.avatar,
        mapData,
        attributes,
        entryFee: _entryFee,
        friendsOnly: _friendsOnly,
        creatorUid: context.read<AuthService>().uid ?? '',
      );

      if (!mounted) return;

      Navigator.of(
        context,
      ).pushReplacement(MaterialPageRoute(builder: (_) => const LobbyPage()));
    } catch (e) {
      if (mounted) _showError(e.toString());
    } finally {
      if (mounted) setState(() => _isCreating = false);
    }
  }

  void _showInlineError(String message) {
    _errorTimer?.cancel();
    setState(() => _inlineError = message);
    _errorTimer = Timer(const Duration(milliseconds: 5000), () {
      if (mounted) setState(() => _inlineError = null);
    });
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
                _buildInlineError(),
                _buildEntryFeeBar(),
                _buildFriendsOnlyBar(),
                Expanded(child: _buildMapList()),
              ],
            ),
          ),
          if (_isCreating)
            Container(
              color: Colors.black54,
              child: const Center(
                child: CircularProgressIndicator(color: Color(0xFF065c18)),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildInlineError() {
    if (_inlineError == null) return const SizedBox.shrink();
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Text(
        _inlineError!,
        textAlign: TextAlign.center,
        style: const TextStyle(color: Colors.red, fontSize: 14),
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
                'Choisissez une carte',
                textAlign: TextAlign.center,
                style: TextStyle(
                  color: Colors.white,
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                  fontFamily: 'TextFont',
                ),
              ),
            ),
            Align(
              alignment: Alignment.centerRight,
              child: ElevatedButton(
                onPressed: (_selectedMap != null && !_isCreating)
                    ? _onNext
                    : null,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF065c18),
                  disabledBackgroundColor: Colors.grey.shade700,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 20,
                    vertical: 10,
                  ),
                  shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(8),
                  ),
                ),
                child: const Text(
                  'Suivant',
                  style: TextStyle(color: Colors.white, fontSize: 15),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildEntryFeeBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white24),
        ),
        child: Row(
          children: [
            const Text(
              'Frais d\'entrée (🪙) :',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontFamily: 'TextFont',
              ),
            ),
            const SizedBox(width: 12),
            SizedBox(
              width: 80,
              child: TextField(
                keyboardType: TextInputType.number,
                inputFormatters: [FilteringTextInputFormatter.digitsOnly],
                textAlign: TextAlign.center,
                style: const TextStyle(color: Colors.white, fontSize: 16),
                decoration: InputDecoration(
                  hintText: '0 = gratuit',
                  hintStyle: const TextStyle(color: Colors.white38),
                  filled: true,
                  fillColor: Colors.white12,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 8,
                    vertical: 6,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(8),
                    borderSide: BorderSide.none,
                  ),
                ),
                onChanged: (value) {
                  final parsed = int.tryParse(value) ?? 0;
                  setState(() => _entryFee = parsed.clamp(0, 100));
                },
              ),
            ),
            const SizedBox(width: 12),
            Text(
              _entryFee > 0
                  ? 'Chaque joueur paiera $_entryFee 🪙'
                  : 'Partie gratuite',
              style: TextStyle(
                color: _entryFee > 0 ? const Color(0xFFFFD700) : Colors.white54,
                fontSize: 13,
                fontFamily: 'TextFont',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFriendsOnlyBar() {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
        decoration: BoxDecoration(
          color: Colors.black.withValues(alpha: 0.55),
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.white24),
        ),
        child: Row(
          children: [
            const Icon(Icons.people, color: Colors.white70, size: 18),
            const SizedBox(width: 8),
            const Text(
              'Amis seulement',
              style: TextStyle(
                color: Colors.white,
                fontSize: 14,
                fontFamily: 'TextFont',
              ),
            ),
            const SizedBox(width: 12),
            Switch(
              value: _friendsOnly,
              onChanged: (v) => setState(() => _friendsOnly = v),
              activeThumbColor: const Color(0xFF065c18),
              inactiveThumbColor: Colors.grey,
              inactiveTrackColor: Colors.white24,
            ),
            const SizedBox(width: 8),
            Text(
              _friendsOnly
                  ? 'Seuls vos amis pourront rejoindre'
                  : 'Tout le monde peut rejoindre',
              style: TextStyle(
                color: _friendsOnly ? Colors.greenAccent : Colors.white54,
                fontSize: 13,
                fontFamily: 'TextFont',
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapList() {
    return Consumer<MapsService>(
      builder: (context, mapsService, _) {
        if (mapsService.isLoading) {
          return const Center(
            child: CircularProgressIndicator(color: Color(0xFF065c18)),
          );
        }

        if (mapsService.errorMessage != null) {
          return Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                const Icon(
                  Icons.error_outline,
                  color: Colors.redAccent,
                  size: 40,
                ),
                const SizedBox(height: 8),
                Text(
                  mapsService.errorMessage!,
                  style: const TextStyle(color: Colors.white70),
                ),
                const SizedBox(height: 12),
                ElevatedButton(
                  onPressed: () {
                    final username = context.read<AuthService>().username ?? '';
                    mapsService.fetchMapsForGameCreation(username);
                  },
                  child: const Text('Réessayer'),
                ),
              ],
            ),
          );
        }

        if (mapsService.maps.isEmpty) {
          return const Center(
            child: Text(
              'Aucune carte disponible.',
              style: TextStyle(color: Colors.white54, fontSize: 14),
            ),
          );
        }

        return LayoutBuilder(
          builder: (context, constraints) {
            const cols = 3;
            const spacing = 8.0;
            const hPad = 12.0;
            final cardWidth =
                (constraints.maxWidth - hPad * 2 - spacing * (cols - 1)) / cols;
            return SingleChildScrollView(
              padding: const EdgeInsets.symmetric(
                horizontal: hPad,
                vertical: 8,
              ),
              child: Wrap(
                spacing: spacing,
                runSpacing: spacing,
                children: mapsService.maps.map((map) {
                  final isSelected = _selectedMap?.id == map.id;
                  return SizedBox(
                    width: cardWidth,
                    child: _MapCard(
                      map: map,
                      isSelected: isSelected,
                      onTap: () => setState(() => _selectedMap = map),
                    ),
                  );
                }).toList(),
              ),
            );
          },
        );
      },
    );
  }
}

class _MapCard extends StatelessWidget {
  final GameMap map;
  final bool isSelected;
  final VoidCallback onTap;

  const _MapCard({
    required this.map,
    required this.isSelected,
    required this.onTap,
  });

  String get _sizeLabel {
    switch (map.size) {
      case '10':
        return 'P';
      case '15':
        return 'M';
      case '20':
        return 'G';
      default:
        return '?';
    }
  }

  String _formatDate(String isoDate) {
    final dt = DateTime.tryParse(isoDate);
    if (dt == null) return isoDate;
    return '${dt.day.toString().padLeft(2, '0')}/'
        '${dt.month.toString().padLeft(2, '0')}/'
        '${dt.year}';
  }

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: isSelected
              ? const Color(0xFFAE4924)
              : const Color(0xFFAE4924).withValues(alpha: 0.85),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(
            color: isSelected ? const Color(0xFF065c18) : Colors.white12,
            width: isSelected ? 2 : 1,
          ),
        ),
        clipBehavior: Clip.hardEdge,
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.center,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 8, 4),
              child: Row(
                mainAxisAlignment: MainAxisAlignment.center,
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Flexible(
                    child: Text(
                      map.name,
                      style: TextStyle(
                        color: isSelected
                            ? const Color(0xFF199433)
                            : Colors.white,
                        fontWeight: FontWeight.bold,
                        fontSize: 17,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ),
                  const SizedBox(width: 6),
                  _SizeBadge(label: _sizeLabel),
                  if (isSelected) ...[
                    const SizedBox(width: 4),
                    const Icon(
                      Icons.check_circle,
                      color: Color(0xFF199433),
                      size: 14,
                    ),
                  ],
                ],
              ),
            ),
            SizedBox(height: 200, child: _buildImage()),
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.center,
                children: [
                  Text(
                    'Mode : ${map.gameMode}',
                    style: const TextStyle(color: Colors.white70, fontSize: 15),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    textAlign: TextAlign.center,
                  ),
                  if (map.lastSave != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Dernière M.À.J. : ${_formatDate(map.lastSave!)}',
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                  if (map.owner.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Text(
                      'Propriétaire : ${map.owner}',
                      style: const TextStyle(
                        color: Colors.white54,
                        fontSize: 13,
                      ),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      textAlign: TextAlign.center,
                    ),
                  ],
                  const SizedBox(height: 4),
                  _VisibilityBadge(visibility: map.visibility),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildImage() {
    final url = map.imageUrl;
    if (url.isNotEmpty) {
      if (url.startsWith('data:')) {
        try {
          final commaIdx = url.indexOf(',');
          if (commaIdx != -1) {
            final bytes = base64Decode(url.substring(commaIdx + 1));
            return Image.memory(
              bytes,
              width: double.infinity,
              fit: BoxFit.contain,
              errorBuilder: (_, _, _) => _imagePlaceholder(),
            );
          }
        } catch (e) {
          return Container(
            width: double.infinity,
            color: Colors.red.withValues(alpha: 0.1),
            alignment: Alignment.center,
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(
                  Icons.broken_image,
                  color: Colors.redAccent,
                  size: 32,
                ),
                const SizedBox(height: 6),
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 8),
                  child: Text(
                    'Impossible de charger l\'image : $e',
                    style: const TextStyle(
                      color: Colors.redAccent,
                      fontSize: 11,
                    ),
                    textAlign: TextAlign.center,
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ),
              ],
            ),
          );
        }
      } else {
        return Image.network(
          url,
          width: double.infinity,
          fit: BoxFit.contain,
          errorBuilder: (_, _, _) => _imagePlaceholder(),
        );
      }
    }
    return _imagePlaceholder();
  }

  Widget _imagePlaceholder() {
    return Container(
      width: double.infinity,
      color: Colors.white10,
      alignment: Alignment.center,
      child: const Icon(Icons.map, color: Colors.white38, size: 36),
    );
  }
}

class _SizeBadge extends StatelessWidget {
  final String label;

  const _SizeBadge({required this.label});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 20,
      height: 20,
      decoration: BoxDecoration(
        border: Border.all(color: Colors.white, width: 2),
        borderRadius: BorderRadius.circular(4),
      ),
      alignment: Alignment.center,
      child: Text(
        label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 11,
          fontWeight: FontWeight.bold,
        ),
      ),
    );
  }
}

class _VisibilityBadge extends StatelessWidget {
  final String visibility;

  const _VisibilityBadge({required this.visibility});

  Color get _bgColor {
    switch (visibility) {
      case 'public':
        return const Color(0xFF2ECC71).withValues(alpha: 0.18);
      case 'private':
        return const Color(0xFFE74C3C).withValues(alpha: 0.16);
      case 'private-shared':
        return const Color(0xFF3498DB).withValues(alpha: 0.16);
      default:
        return Colors.white12;
    }
  }

  String get _label {
    switch (visibility) {
      case 'public':
        return 'Public';
      case 'private':
        return 'Privé';
      case 'private-shared':
        return 'Privé-partagé';
      default:
        return visibility;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: _bgColor,
        borderRadius: BorderRadius.circular(6),
        border: Border.all(color: Colors.white24),
      ),
      child: Text(
        _label,
        style: const TextStyle(
          color: Colors.white,
          fontSize: 9,
          fontWeight: FontWeight.w600,
        ),
      ),
    );
  }
}
