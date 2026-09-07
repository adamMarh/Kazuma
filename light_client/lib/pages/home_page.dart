import 'package:flutter/material.dart';
import 'package:footer/footer.dart';
import 'package:light_client/components/avatar_image.dart';
import 'package:light_client/components/chat_drawer.dart';
import 'package:light_client/components/friend_panel.dart';
import 'package:light_client/components/status_indicator.dart';
import 'package:light_client/pages/account_settings_page.dart';
import 'package:light_client/pages/game_creation_page.dart';
import 'package:light_client/pages/join_game_page.dart';
import 'package:light_client/pages/shop_page.dart';
import 'package:light_client/pages/wallet_page.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/avatar_service.dart';
import 'package:light_client/services/chat/chat_notification_service.dart';
import 'package:light_client/services/chat/chat_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/friend/friend_models.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/user_service.dart';
import 'package:provider/provider.dart';

class HomePage extends StatefulWidget {
  const HomePage({super.key});

  @override
  State<HomePage> createState() => _HomePageState();
}

class _HomePageState extends State<HomePage>
    with SingleTickerProviderStateMixin {
  final GlobalKey<ScaffoldState> _scaffoldKey = GlobalKey<ScaffoldState>();
  bool _isDrawerOpen = false;
  VoidCallback? _busySyncListener;

  static const String _globalRoomId = 'global';

  @override
  void initState() {
    super.initState();
    _initializeChat();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      Provider.of<CurrencyService>(context, listen: false).refreshWallet();
      _setupBusySync();
    });
  }

  @override
  void dispose() {
    if (_busySyncListener != null) {
      final friendService = Provider.of<FriendService>(context, listen: false);
      friendService.removeListener(_busySyncListener!);
    }
    super.dispose();
  }

  void _setupBusySync() {
    final friendService = Provider.of<FriendService>(context, listen: false);
    final notificationService = Provider.of<ChatNotificationService>(
      context,
      listen: false,
    );

    _busySyncListener = () {
      notificationService.setMuted(friendService.isBusy);
    };
    friendService.addListener(_busySyncListener!);
  }

  Future<void> _initializeChat() async {
    final chatService = Provider.of<ChatService>(context, listen: false);
    final userService = Provider.of<UserService>(context, listen: false);
    final authService = Provider.of<AuthService>(context, listen: false);

    try {
      final username = await userService.getCurrentUsername();
      debugPrint('Initializing chat for: $username');

      await chatService.connect(username, uid: authService.uid);

      await chatService.joinRoom(_globalRoomId);

      debugPrint('Connected to chat and joined global room');
    } catch (e) {
      debugPrint('Failed to initialize chat: $e');
    }
  }

  void _signOut() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    await authService.signOut();
    if (mounted) {
      Navigator.of(context).pushNamedAndRemoveUntil('/login', (r) => false);
    }
  }

  void _openAccountSettings() {
    Navigator.of(
      context,
    ).push(MaterialPageRoute(builder: (_) => const AccountSettingsPage()));
  }

  void _toggleDrawer() {
    if (_isDrawerOpen) {
      Navigator.of(context).pop();
    } else {
      _scaffoldKey.currentState?.openDrawer();
    }
  }

  void _onDrawerChanged(bool isOpened) {
    setState(() {
      _isDrawerOpen = isOpened;
    });

    final chatService = Provider.of<ChatService>(context, listen: false);
    final notificationService = Provider.of<ChatNotificationService>(
      context,
      listen: false,
    );

    if (isOpened) {
      chatService.refresh();
      chatService.startShakeDetection(context);

      notificationService.setChatOpen(true, roomId: chatService.currentRoomId);
    } else {
      chatService.stopShakeDetection();
      notificationService.setChatOpen(false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      key: _scaffoldKey,
      drawer: const ChatDrawer(),
      onDrawerChanged: _onDrawerChanged,
      body: Stack(
        children: [
          _buildBackground(),
          _buildContent(),
          _buildChatButton(),
          const FriendPanel(),
          _buildFooter(),
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

  Widget _buildContent() {
    return SafeArea(
      child: Column(
        children: [
          _buildTopBar(),
          Expanded(child: _buildMainButtons()),
        ],
      ),
    );
  }

  Widget _buildTopBar() {
    return Padding(
      padding: const EdgeInsets.only(top: 20, left: 20, right: 20),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Consumer2<AuthService, CurrencyService>(
            builder: (context, auth, currencyService, _) {
              final displayText = auth.username ?? auth.email ?? 'Utilisateur';
              final owned = currencyService.wallet.ownedVisuals;
              final hasWhiteAura =
                  owned.contains('vis_aura') || owned.contains('visual-aura');
              final hasUsernameStyle =
                  owned.contains('vis_rainbow') ||
                  owned.contains('vis_police_nom') ||
                  owned.contains('visual-enchanted');
              final hasUsernameCrown =
                  owned.contains('vis_starry_name') ||
                  owned.contains('vis_flag_custom') ||
                  owned.contains('visual-stars');

              return Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 15,
                  vertical: 8,
                ),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.5),
                  borderRadius: BorderRadius.circular(20),
                ),
                child: Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    if (auth.avatar != null)
                      Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FutureBuilder<AvatarDoc?>(
                          future: AvatarService().getAvatarById(auth.avatar!),
                          builder: (context, snapshot) {
                            final avatarImage = AvatarImage(
                              base64: snapshot.data?.imageBase64,
                              radius: 14,
                            );

                            Widget avatarContent = avatarImage;
                            if (hasWhiteAura) {
                              avatarContent = Container(
                                padding: const EdgeInsets.all(2),
                                decoration: BoxDecoration(
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    width: 2.5,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.white.withValues(
                                        alpha: 0.6,
                                      ),
                                      blurRadius: 15,
                                      spreadRadius: 3,
                                    ),
                                    BoxShadow(
                                      color: Colors.white.withValues(
                                        alpha: 0.4,
                                      ),
                                      blurRadius: 25,
                                      spreadRadius: 1,
                                    ),
                                  ],
                                ),
                                child: Container(
                                  decoration: const BoxDecoration(
                                    shape: BoxShape.circle,
                                    color: Colors.transparent,
                                  ),
                                  child: avatarImage,
                                ),
                              );
                            }

                            return Consumer<FriendService>(
                              builder: (context, friendService, _) {
                                final status = friendService.isBusy
                                    ? UserStatus.busy
                                    : UserStatus.online;
                                return AvatarWithStatus(
                                  avatar: avatarContent,
                                  status: status,
                                  avatarRadius: 14,
                                );
                              },
                            );
                          },
                        ),
                      ),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (hasUsernameCrown)
                          const Padding(
                            padding: EdgeInsets.only(right: 4),
                            child: Icon(
                              Icons.auto_awesome,
                              size: 14,
                              color: Color(0xFFFFD700),
                            ),
                          ),
                        // username with optional gradient
                        Builder(
                          builder: (context) {
                            final baseTextStyle = TextStyle(
                              fontFamily: hasUsernameStyle
                                  ? 'ButtonFont'
                                  : 'TextFont',
                              color: Colors.white,
                              fontSize: hasUsernameStyle ? 16 : 14,
                              fontWeight: hasUsernameStyle
                                  ? FontWeight.w700
                                  : FontWeight.normal,
                            );

                            final nameText = Text(
                              displayText,
                              style: baseTextStyle,
                            );

                            Widget nameWidget;
                            if (hasUsernameStyle) {
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
                              nameWidget = ShaderMask(
                                shaderCallback: (bounds) =>
                                    gradient.createShader(
                                      Rect.fromLTWH(
                                        0,
                                        0,
                                        bounds.width,
                                        bounds.height,
                                      ),
                                    ),
                                child: nameText,
                              );
                            } else {
                              nameWidget = nameText;
                            }

                            final children = <Widget>[nameWidget];
                            if (hasUsernameCrown) {
                              children.add(
                                const Padding(
                                  padding: EdgeInsets.only(left: 6.0),
                                  child: Icon(
                                    Icons.auto_awesome,
                                    size: 14,
                                    color: Color(0xFFFFD700),
                                  ),
                                ),
                              );
                            }

                            return Row(
                              mainAxisSize: MainAxisSize.min,
                              children: children,
                            );
                          },
                        ),
                      ],
                    ),
                  ],
                ),
              );
            },
          ),
          Row(
            children: [
              _buildSettingsButton(),
              const SizedBox(width: 10),
              _buildWalletButton(),
              const SizedBox(width: 10),
              _buildLogoutButton(),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildSettingsButton() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _openAccountSettings,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.black.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(
              color: Colors.white.withValues(alpha: 0.2),
              width: 1,
            ),
          ),
          child: const Icon(
            Icons.manage_accounts,
            color: Colors.white,
            size: 20,
          ),
        ),
      ),
    );
  }

  Widget _buildMainButtons() {
    return Center(
      child: Padding(
        padding: const EdgeInsets.only(top: 100),
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            _buildMainButton(
              'Joindre une partie',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(builder: (context) => const JoinGamePage()),
                );
              },
            ),
            const SizedBox(height: 20),
            _buildMainButton(
              'Créer une partie',
              onTap: () {
                Navigator.push(
                  context,
                  MaterialPageRoute(
                    builder: (context) => const GameCreationPage(),
                  ),
                );
              },
            ),
            const SizedBox(height: 20),
            _buildMainButton(
              'Boutique',
              onTap: () async {
                await Navigator.push(
                  context,
                  MaterialPageRoute(builder: (_) => const ShopPage()),
                );
                if (!mounted) return;
                await Provider.of<CurrencyService>(
                  context,
                  listen: false,
                ).refreshWallet();
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildChatButton() {
    return AnimatedPositioned(
      duration: const Duration(milliseconds: 250),
      curve: Curves.easeInOut,
      left: _isDrawerOpen ? MediaQuery.of(context).size.width * 0.75 - 8 : 0,
      top: MediaQuery.of(context).size.height / 2 - 50,
      child: GestureDetector(
        onTap: _toggleDrawer,
        child: Stack(
          clipBehavior: Clip.none,
          children: [
            CustomPaint(
              painter: TrapezoidPainter(
                color: const Color.fromARGB(255, 35, 136, 60),
                borderColor: Colors.white.withValues(alpha: 0.3),
              ),
              child: Container(
                width: 80,
                height: 100,
                alignment: Alignment.center,
                padding: const EdgeInsets.only(right: 8),
                child: Icon(
                  _isDrawerOpen ? Icons.close : Icons.chat,
                  color: Colors.white,
                  size: 28,
                ),
              ),
            ),

            Consumer<ChatNotificationService>(
              builder: (context, notificationService, child) {
                final globalUnread = notificationService.unreadCountFor(
                  _globalRoomId,
                );
                if (globalUnread == 0 || _isDrawerOpen) {
                  return const SizedBox.shrink();
                }
                final count = globalUnread;
                return Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.all(4),
                    constraints: const BoxConstraints(
                      minWidth: 22,
                      minHeight: 22,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.red,
                      shape: BoxShape.circle,
                      border: Border.all(color: Colors.white, width: 2),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withValues(alpha: 0.4),
                          blurRadius: 4,
                          offset: const Offset(0, 2),
                        ),
                      ],
                    ),
                    child: Center(
                      child: Text(
                        count > 99 ? '99+' : '$count',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 10,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return Positioned(
      bottom: 0,
      left: 0,
      right: 0,
      child: Container(
        height: 50,
        alignment: Alignment.center,
        child: Footer(
          backgroundColor: Colors.black,
          padding: const EdgeInsets.all(10.0),
          child: const Text(
            'Équipe 109: Benesrighe Nawal, Essaouab Yassine, Jaafri Hayani Rita, Marhraoui Adam, Nazih Iliass, Rizk Karl',
            style: TextStyle(color: Colors.white),
          ),
        ),
      ),
    );
  }

  Widget _buildWalletButton() {
    return Consumer<CurrencyService>(
      builder: (context, currencyService, _) {
        return Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: () {
              Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const WalletPage()),
              );
            },
            borderRadius: BorderRadius.circular(10),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: const Color(0xFF111827),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white.withValues(alpha: 0.08)),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Text('\u{1FA99}', style: TextStyle(fontSize: 18)),
                  const SizedBox(width: 6),
                  Text(
                    currencyService.loading
                        ? '...'
                        : '${currencyService.balance}',
                    style: const TextStyle(
                      fontFamily: 'TextFont',
                      color: Color(0xFFE5E7EB),
                      fontSize: 14,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ],
              ),
            ),
          ),
        );
      },
    );
  }

  Widget _buildLogoutButton() {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: _signOut,
        borderRadius: BorderRadius.circular(8),
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
              colors: [Color(0xFFE74C3C), Color(0xFFC0392B)],
            ),
            borderRadius: BorderRadius.circular(8),
          ),
          child: const Text(
            'Déconnexion',
            style: TextStyle(
              fontFamily: 'TextFont',
              color: Colors.white,
              fontSize: 14,
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildMainButton(String text, {required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 40, vertical: 10),
        child: Stack(
          children: [
            Text(
              text,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontFamily: 'ButtonFont',
                fontSize: 36,
                fontWeight: FontWeight.w500,
                foreground: Paint()
                  ..style = PaintingStyle.stroke
                  ..strokeWidth = 1
                  ..color = const Color(0xFF7D2828),
                shadows: const [
                  Shadow(color: Color(0xFF7D2828), offset: Offset(5, 1)),
                  Shadow(color: Color(0xFF7D2828), offset: Offset(-5, 1)),
                  Shadow(color: Color(0xFF7D2828), offset: Offset(5, -1)),
                  Shadow(color: Color(0xFF7D2828), offset: Offset(-5, -1)),
                ],
              ),
            ),
            Text(
              text,
              textAlign: TextAlign.center,
              style: const TextStyle(
                fontFamily: 'ButtonFont',
                fontSize: 36,
                fontWeight: FontWeight.w500,
                color: Colors.white,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class TrapezoidPainter extends CustomPainter {
  final Color color;
  final Color borderColor;

  TrapezoidPainter({required this.color, required this.borderColor});

  @override
  void paint(Canvas canvas, Size size) {
    final paint = Paint()
      ..color = color
      ..style = PaintingStyle.fill;
    final borderPaint = Paint()
      ..color = borderColor
      ..style = PaintingStyle.stroke
      ..strokeWidth = 2;
    final shadowPaint = Paint()
      ..color = Colors.black.withValues(alpha: 0.3)
      ..maskFilter = const MaskFilter.blur(BlurStyle.normal, 8);

    final path = Path()
      ..moveTo(0, 0)
      ..lineTo(size.width, size.height * 0.3)
      ..lineTo(size.width, size.height * 0.7)
      ..lineTo(0, size.height)
      ..close();

    canvas.save();
    canvas.translate(2, 2);
    canvas.drawPath(path, shadowPaint);
    canvas.restore();

    canvas.drawPath(path, paint);
    canvas.drawPath(path, borderPaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
