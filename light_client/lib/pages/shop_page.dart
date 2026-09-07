import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:light_client/constants/shop_catalog.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:provider/provider.dart';

class ShopPage extends StatefulWidget {
  const ShopPage({super.key});

  @override
  State<ShopPage> createState() => _ShopPageState();
}

class _ShopPageState extends State<ShopPage> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _playingId;

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
  }

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CurrencyService>(context, listen: false).refreshShop();
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Stack(
        children: [
          _buildBackground(),
          SafeArea(
            child: Column(
              children: [
                _buildHeader(),
                Expanded(child: _buildBody()),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildBackground() {
    return Container(
      decoration: const BoxDecoration(
        image: DecorationImage(
          image: AssetImage('assets/images/background/home_background.jpg'),
          fit: BoxFit.cover,
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return Consumer<CurrencyService>(
      builder: (context, cs, _) => Padding(
        padding: const EdgeInsets.all(16),
        child: Row(
          children: [
            _buildBackButton(),
            const Expanded(
              child: Text(
                'Boutique',
                textAlign: TextAlign.center,
                style: TextStyle(
                  fontFamily: 'ButtonFont',
                  fontSize: 32,
                  color: Colors.white,
                  shadows: [
                    Shadow(
                      offset: Offset(2, 2),
                      blurRadius: 4,
                      color: Colors.black54,
                    ),
                  ],
                ),
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.black.withValues(alpha: 0.65),
                borderRadius: BorderRadius.circular(12),
                border: Border.all(
                  color: const Color(0xFFFFD700).withValues(alpha: 0.5),
                ),
              ),
              child: Text(
                '${cs.balance} 🪙',
                style: const TextStyle(
                  fontFamily: 'TextFont',
                  color: Color(0xFFFFD700),
                  fontSize: 18,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildBackButton() {
    return TextButton.icon(
      onPressed: () => Navigator.of(context).pop(),
      icon: const SizedBox.shrink(),
      label: const Text(
        'Retour',
        style: TextStyle(color: Colors.white, fontSize: 15),
      ),
      style: TextButton.styleFrom(
        backgroundColor: const Color(0xFFAE4924),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
      ),
    );
  }

  Widget _buildBody() {
    return Consumer<CurrencyService>(
      builder: (context, cs, _) {
        if (cs.loading) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color.fromARGB(255, 35, 136, 60),
            ),
          );
        }

        final categories = <_Category>[
          _Category('Personnages', cs.catalog['characters'] ?? []),
          _Category('Visuels', cs.catalog['visuals'] ?? []),
          _Category('Sons', cs.catalog['sounds'] ?? []),
        ];

        return ListView(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
          children: [
            for (final cat in categories)
              if (cat.items.isNotEmpty) ...[
                _buildCategoryHeader(cat.name),
                const SizedBox(height: 8),
                _buildItemGrid(cs, cat.items),
                const SizedBox(height: 16),
              ],
          ],
        );
      },
    );
  }

  Widget _buildCategoryHeader(String title) {
    return Text(
      title,
      style: const TextStyle(
        fontFamily: 'TextFont',
        color: Colors.white,
        fontSize: 20,
        fontWeight: FontWeight.bold,
        shadows: [
          Shadow(offset: Offset(1, 1), blurRadius: 3, color: Colors.black54),
        ],
      ),
    );
  }

  Widget _buildItemGrid(CurrencyService cs, List<ShopItem> items) {
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 3,
        childAspectRatio: 0.85,
        crossAxisSpacing: 12,
        mainAxisSpacing: 12,
      ),
      itemCount: items.length,
      itemBuilder: (context, index) => _buildItemCard(cs, items[index]),
    );
  }

  Widget _buildItemCard(CurrencyService cs, ShopItem item) {
    final owned = cs.wallet.ownsItem(item.type, item.id);
    final canAfford = cs.canBuy(item);

    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: owned
              ? const Color.fromARGB(255, 35, 136, 60).withValues(alpha: 0.6)
              : Colors.white.withValues(alpha: 0.15),
          width: owned ? 2 : 1,
        ),
      ),
      child: Padding(
        padding: const EdgeInsets.all(10),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            if (getShopItemPreviewImage(item.id) != null)
              Image.asset(
                getShopItemPreviewImage(item.id)!,
                width: 48,
                height: 48,
                fit: BoxFit.cover,
              )
            else if (item.type == 'sounds')
              Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    _iconForType(item.type),
                    color: owned
                        ? const Color.fromARGB(255, 35, 136, 60)
                        : Colors.white70,
                    size: 28,
                  ),
                  const SizedBox(width: 8),
                  SizedBox(
                    height: 32,
                    child: IconButton(
                      padding: EdgeInsets.zero,
                      icon: Icon(
                        _playingId == item.id
                            ? Icons.pause_circle
                            : Icons.play_circle,
                        color: Colors.white,
                      ),
                      onPressed: () async {
                        final soundPath = getShopItemSound(item.id);
                        if (soundPath == null) return;
                        if (_playingId == item.id) {
                          await _audioPlayer.stop();
                          setState(() {
                            _playingId = null;
                          });
                        } else {
                          await _audioPlayer.stop();
                          setState(() {
                            _playingId = item.id;
                          });
                          await _audioPlayer.play(
                            AssetSource(soundPath.replaceFirst('assets/', '')),
                          );
                          // When finished, clear playingId
                          _audioPlayer.onPlayerComplete.listen((_) {
                            setState(() {
                              _playingId = null;
                            });
                          });
                        }
                      },
                    ),
                  ),
                ],
              )
            else
              Icon(
                _iconForType(item.type),
                color: owned
                    ? const Color.fromARGB(255, 35, 136, 60)
                    : Colors.white70,
                size: 32,
              ),
            const SizedBox(height: 8),
            Builder(
              builder: (ctx) {
                final cls = getShopItemVisualClass(item.id);
                if (cls == 'visual-enchanted') {
                  final gradient = const LinearGradient(
                    colors: [
                      Color(0xFFFF0000),
                      Color(0xFFFF7F00),
                      Color(0xFFFFFF00),
                      Color(0xFF00FF00),
                      Color(0xFF0000FF),
                      Color(0xFF4B0082),
                      Color(0xFF9400D3),
                      Color(0xFFFF0000),
                    ],
                  );
                  return ShaderMask(
                    shaderCallback: (bounds) => gradient.createShader(
                      Rect.fromLTWH(0, 0, bounds.width, bounds.height),
                    ),
                    child: Text(
                      getShopItemDisplayName(item.id),
                      textAlign: TextAlign.center,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontFamily: 'TextFont',
                        color: Colors.white,
                        fontSize: 13,
                      ),
                    ),
                  );
                }
                if (cls == 'visual-stars') {
                  return Row(
                    mainAxisSize: MainAxisSize.min,
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      const Icon(
                        Icons.auto_awesome,
                        size: 14,
                        color: Color(0xFFFFD700),
                      ),
                      const SizedBox(width: 4),
                      Flexible(
                        child: Text(
                          getShopItemDisplayName(item.id),
                          textAlign: TextAlign.center,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontFamily: 'TextFont',
                            color: Colors.white,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      const SizedBox(width: 4),
                      const Icon(
                        Icons.auto_awesome,
                        size: 14,
                        color: Color(0xFFFFD700),
                      ),
                    ],
                  );
                }
                // default
                return Text(
                  getShopItemDisplayName(item.id),
                  textAlign: TextAlign.center,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: const TextStyle(
                    fontFamily: 'TextFont',
                    color: Colors.white,
                    fontSize: 13,
                  ),
                );
              },
            ),
            const SizedBox(height: 6),
            if (owned)
              const Text(
                'Possédé ✓',
                style: TextStyle(
                  fontFamily: 'TextFont',
                  color: Color.fromARGB(255, 35, 136, 60),
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              )
            else
              _buildBuyButton(cs, item, canAfford),
          ],
        ),
      ),
    );
  }

  Widget _buildBuyButton(CurrencyService cs, ShopItem item, bool canAfford) {
    return SizedBox(
      height: 36,
      child: ElevatedButton(
        onPressed: canAfford ? () => _handleBuy(cs, item) : null,
        style: ElevatedButton.styleFrom(
          backgroundColor: canAfford
              ? const Color(0xFF4CAF50)
              : Colors.grey.shade600,
          foregroundColor: Colors.white,
          padding: const EdgeInsets.symmetric(horizontal: 12),
          textStyle: const TextStyle(
            fontFamily: 'TextFont',
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          elevation: 4,
          shadowColor: Colors.black.withValues(alpha: 0.5),
        ),
        child: Text(
          '${item.price} 🪙',
          style: const TextStyle(
            color: Colors.white,
            fontSize: 16,
            fontWeight: FontWeight.bold,
          ),
        ),
      ),
    );
  }

  Future<void> _handleBuy(CurrencyService cs, ShopItem item) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E1E2E),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
        title: const Text(
          'Confirmer l\'achat',
          style: TextStyle(fontFamily: 'TextFont', color: Colors.white),
        ),
        content: Text(
          'Acheter "${item.name}" pour ${item.price} 🪙 ?',
          style: const TextStyle(fontFamily: 'TextFont', color: Colors.white70),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Annuler',
              style: TextStyle(fontFamily: 'TextFont'),
            ),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: const Color.fromARGB(255, 35, 136, 60),
              foregroundColor: Colors.white,
            ),
            child: const Text(
              'Acheter',
              style: TextStyle(fontFamily: 'TextFont'),
            ),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await cs.buyItem(item);
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              success ? 'Achat réussi !' : 'Échec de l\'achat.',
              style: const TextStyle(fontFamily: 'TextFont'),
            ),
            backgroundColor: success
                ? const Color.fromARGB(255, 35, 136, 60)
                : Colors.red,
          ),
        );
      }
    }
  }

  IconData _iconForType(String type) {
    switch (type) {
      case 'character':
        return Icons.person;
      case 'visual':
        return Icons.palette;
      case 'sound':
        return Icons.music_note;
      default:
        return Icons.shopping_bag;
    }
  }
}

class _Category {
  final String name;
  final List<ShopItem> items;
  _Category(this.name, this.items);
}
