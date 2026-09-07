import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:light_client/constants/shop_catalog.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:provider/provider.dart';

class WalletPage extends StatefulWidget {
  const WalletPage({super.key});

  @override
  State<WalletPage> createState() => _WalletPageState();
}

class _WalletPageState extends State<WalletPage> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  String? _playingId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      Provider.of<CurrencyService>(context, listen: false).refreshWallet();
    });
  }

  @override
  void dispose() {
    _audioPlayer.dispose();
    super.dispose();
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
    return Padding(
      padding: const EdgeInsets.all(16),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          _buildBackButton(),
          const Text(
            'Portefeuille',
            style: TextStyle(
              fontFamily: 'TextFont',
              color: Colors.white,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(width: 40),
        ],
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
      builder: (context, currencyService, child) {
        if (currencyService.loading) {
          return const Center(
            child: CircularProgressIndicator(
              color: Color.fromARGB(255, 35, 136, 60),
            ),
          );
        }

        final wallet = currencyService.wallet;
        return SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24),
          child: Column(
            children: [
              _buildBalanceCard(wallet.balance),
              const SizedBox(height: 16),
              _buildOwnedSection('Personnages', wallet.ownedCharacters),
              const SizedBox(height: 12),
              _buildOwnedSection('Visuels', wallet.ownedVisuals),
              const SizedBox(height: 12),
              _buildOwnedSection('Sons', wallet.ownedSounds),
              const SizedBox(height: 24),
              _buildRefreshButton(currencyService),
            ],
          ),
        );
      },
    );
  }

  Widget _buildBalanceCard(int balance) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 18),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.75),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: const Color.fromARGB(255, 35, 136, 60).withValues(alpha: 0.5),
        ),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          const Text(
            'Solde',
            style: TextStyle(
              fontFamily: 'TextFont',
              color: Colors.white70,
              fontSize: 18,
            ),
          ),
          Text(
            '$balance 🪙',
            style: const TextStyle(
              fontFamily: 'TextFont',
              color: Color(0xFFFFD700),
              fontSize: 24,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildOwnedSection(String title, List<String> items) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.65),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: Colors.white.withValues(alpha: 0.1)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            title,
            style: const TextStyle(
              fontFamily: 'TextFont',
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 8),
          if (items.isEmpty)
            Text(
              'Aucun',
              style: TextStyle(
                fontFamily: 'TextFont',
                color: Colors.white.withValues(alpha: 0.5),
                fontSize: 14,
              ),
            )
          else
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: items.map((item) {
                final preview = getShopItemPreviewImage(item);
                final cls = getShopItemVisualClass(item);
                final soundPath = getShopItemSound(item);
                Widget label;
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
                  label = ShaderMask(
                    shaderCallback: (bounds) => gradient.createShader(
                      Rect.fromLTWH(0, 0, bounds.width, bounds.height),
                    ),
                    child: Text(
                      getShopItemDisplayName(item),
                      style: const TextStyle(
                        fontFamily: 'TextFont',
                        color: Colors.white,
                        fontSize: 13,
                      ),
                    ),
                  );
                } else if (cls == 'visual-stars') {
                  label = Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Text(
                        '✦ ',
                        style: TextStyle(color: Color(0xFFFFD700)),
                      ),
                      Text(
                        getShopItemDisplayName(item),
                        style: const TextStyle(
                          fontFamily: 'TextFont',
                          color: Colors.white,
                          fontSize: 13,
                        ),
                      ),
                      const Text(
                        ' ✦',
                        style: TextStyle(color: Color(0xFFFFD700)),
                      ),
                    ],
                  );
                } else {
                  label = Text(
                    getShopItemDisplayName(item),
                    style: const TextStyle(
                      fontFamily: 'TextFont',
                      color: Colors.white,
                      fontSize: 13,
                    ),
                  );
                }

                return Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.white.withValues(alpha: 0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: Colors.white.withValues(alpha: 0.2),
                    ),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      if (preview != null) ...[
                        Image.asset(
                          preview,
                          width: 20,
                          height: 20,
                          fit: BoxFit.cover,
                        ),
                        const SizedBox(width: 6),
                      ],
                      label,
                      if (soundPath != null) ...[
                        const SizedBox(width: 8),
                        SizedBox(
                          height: 28,
                          child: IconButton(
                            padding: EdgeInsets.zero,
                            icon: Icon(
                              _playingId == item
                                  ? Icons.pause_circle
                                  : Icons.play_circle,
                              color: Colors.white,
                              size: 20,
                            ),
                            onPressed: () async {
                              if (_playingId == item) {
                                await _audioPlayer.stop();
                                setState(() {
                                  _playingId = null;
                                });
                              } else {
                                await _audioPlayer.stop();
                                setState(() {
                                  _playingId = item;
                                });
                                await _audioPlayer.play(
                                  AssetSource(
                                    soundPath.replaceFirst('assets/', ''),
                                  ),
                                );
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
                    ],
                  ),
                );
              }).toList(),
            ),
        ],
      ),
    );
  }

  Widget _buildRefreshButton(CurrencyService currencyService) {
    return ElevatedButton.icon(
      onPressed: currencyService.loading
          ? null
          : () => currencyService.refreshWallet(),
      icon: const Icon(Icons.refresh),
      label: const Text('Rafraîchir', style: TextStyle(fontFamily: 'TextFont')),
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color.fromARGB(255, 35, 136, 60),
        foregroundColor: Colors.white,
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }
}
