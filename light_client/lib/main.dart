import 'dart:async';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_localizations/flutter_localizations.dart';
import 'package:intl/date_symbol_data_local.dart';
import 'package:light_client/config/server_config.dart';
import 'package:light_client/firebase_options.dart';
import 'package:light_client/pages/home_page.dart';
import 'package:light_client/pages/in_game_page.dart';
import 'package:light_client/pages/lobby_page.dart';
import 'package:light_client/pages/shop_page.dart';
import 'package:light_client/pages/wallet_page.dart';
import 'package:light_client/services/auth/auth_gate.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/challenge_service.dart';
import 'package:light_client/services/chat/chat_notification_service.dart';
import 'package:light_client/services/chat/chat_service.dart';
import 'package:light_client/services/chat/message_repository.dart';
import 'package:light_client/services/chat/shake_detection_service.dart';
import 'package:light_client/services/combat_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/debug_mode_service.dart';
import 'package:light_client/services/foreground_service.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/game_service.dart';
import 'package:light_client/services/maps_service.dart';
import 'package:light_client/services/movement_service.dart';
import 'package:light_client/services/qrcode_service.dart';
import 'package:light_client/services/socket_service.dart';
import 'package:light_client/services/turn_service.dart';
import 'package:light_client/components/game_invitation_dialog.dart';
import 'package:light_client/services/user_service.dart';
import 'package:provider/provider.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();

  await Firebase.initializeApp(options: DefaultFirebaseOptions.currentPlatform);

  await initializeDateFormatting('fr_CA', null);
  await initializeDateFormatting('en_US', null);

  await SystemChrome.setPreferredOrientations([
    DeviceOrientation.landscapeLeft,
    DeviceOrientation.landscapeRight,
  ]);

  initForegroundTask();

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (context) => AuthService()),

        ProxyProvider<AuthService, UserService>(
          update: (context, authService, previous) => UserService(authService),
        ),

        ChangeNotifierProvider(
          create: (context) => SocketService(serverUrl: getServerUrl()),
        ),

        ChangeNotifierProxyProvider<SocketService, GameService>(
          create: (context) =>
              GameService(socketService: context.read<SocketService>()),
          update: (context, socketService, previous) =>
              previous ?? GameService(socketService: socketService),
        ),

        ChangeNotifierProxyProvider2<SocketService, GameService, CombatService>(
          create: (context) => CombatService(
            socketService: context.read<SocketService>(),
            gameService: context.read<GameService>(),
          ),
          update: (context, socketService, gameService, previous) =>
              previous ??
              CombatService(
                socketService: socketService,
                gameService: gameService,
              ),
        ),

        ChangeNotifierProxyProvider2<
          SocketService,
          GameService,
          MovementService
        >(
          create: (context) => MovementService(
            socketService: context.read<SocketService>(),
            gameService: context.read<GameService>(),
          ),
          update: (context, socketService, gameService, previous) =>
              previous ??
              MovementService(
                socketService: socketService,
                gameService: gameService,
              ),
        ),

        ChangeNotifierProxyProvider3<
          SocketService,
          GameService,
          MovementService,
          TurnService
        >(
          create: (context) => TurnService(
            socketService: context.read<SocketService>(),
            gameService: context.read<GameService>(),
            movementService: context.read<MovementService>(),
          ),
          update:
              (
                context,
                socketService,
                gameService,
                movementService,
                previous,
              ) =>
                  previous ??
                  TurnService(
                    socketService: socketService,
                    gameService: gameService,
                    movementService: movementService,
                  ),
        ),

        ChangeNotifierProxyProvider2<
          SocketService,
          GameService,
          DebugModeService
        >(
          create: (context) => DebugModeService(
            socketService: context.read<SocketService>(),
            gameService: context.read<GameService>(),
          ),
          update: (context, socketService, gameService, previous) =>
              previous ??
              DebugModeService(
                socketService: socketService,
                gameService: gameService,
              ),
        ),

        ChangeNotifierProvider(create: (context) => MapsService()),

        ChangeNotifierProvider(create: (context) => MessageRepository()),

        ChangeNotifierProxyProvider<AuthService, CurrencyService>(
          create: (context) => CurrencyService(context.read<AuthService>()),
          update: (context, authService, previous) =>
              previous ?? CurrencyService(authService),
        ),

        ChangeNotifierProxyProvider2<
          SocketService,
          AuthService,
          ChallengeService
        >(
          create: (context) => ChallengeService(
            socketService: context.read<SocketService>(),
            authService: context.read<AuthService>(),
          ),
          update: (context, socketService, authService, previous) =>
              previous ??
              ChallengeService(
                socketService: socketService,
                authService: authService,
              ),
        ),

        Provider(create: (context) => ShakeDetectionService()),

        ChangeNotifierProvider(create: (context) => ChatNotificationService()),

        ChangeNotifierProxyProvider2<SocketService, AuthService, FriendService>(
          create: (context) => FriendService(
            socketService: context.read<SocketService>(),
            authService: context.read<AuthService>(),
          ),
          update: (context, socketService, authService, previous) =>
              previous ??
              FriendService(
                socketService: socketService,
                authService: authService,
              ),
        ),

        ChangeNotifierProxyProvider4<
          SocketService,
          MessageRepository,
          ShakeDetectionService,
          ChatNotificationService,
          ChatService
        >(
          create: (context) => ChatService(
            socketService: context.read<SocketService>(),
            messageRepository: context.read<MessageRepository>(),
            shakeDetectionService: context.read<ShakeDetectionService>(),
            notificationService: context.read<ChatNotificationService>(),
          ),
          update:
              (
                context,
                socketService,
                messageRepository,
                shakeService,
                notificationService,
                previous,
              ) =>
                  previous ??
                  ChatService(
                    socketService: socketService,
                    messageRepository: messageRepository,
                    shakeDetectionService: shakeService,
                    notificationService: notificationService,
                  ),
        ),
      ],
      child: const MyApp(),
    ),
  );
}

final GlobalKey<NavigatorState> globalNavigatorKey = GlobalKey<NavigatorState>();

class MyApp extends StatefulWidget {
  const MyApp({super.key});

  @override
  State<MyApp> createState() => _MyAppState();
}

class _MyAppState extends State<MyApp> with WidgetsBindingObserver {
  static const _pauseDebounce = Duration(seconds: 2);
  Timer? _pauseTimer;
  bool _didClearPersistedAuth = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addObserver(this);
  }

  @override
  void dispose() {
    _pauseTimer?.cancel();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    final authService = Provider.of<AuthService>(context, listen: false);
    final notificationService = Provider.of<ChatNotificationService>(
      context,
      listen: false,
    );

    notificationService.setAppLifecycleState(state);

    if (state == AppLifecycleState.paused) {
      // Skip lifecycle handling while the QR camera is active to avoid
      // clearing auth / starting the foreground service for a brief pause.
      if (QrScannerPage.isActive) return;

      // Start foreground service immediately so the socket stays alive
      // and the server does not clear the active session.
      startForegroundService();

      // Debounce clearPersistedAuth so transient pauses (notification
      // panel, split-screen gesture) don't wipe local credentials.
      _pauseTimer?.cancel();
      _didClearPersistedAuth = false;
      _pauseTimer = Timer(_pauseDebounce, () {
        authService.clearPersistedAuth();
        _didClearPersistedAuth = true;
      });
    } else if (state == AppLifecycleState.resumed) {
      // Also skip on resume while the scanner is active (e.g. returning from
      // app settings after the permission prompt).
      if (QrScannerPage.isActive) return;

      // Cancel the debounce timer — app came back before cleanup ran.
      _pauseTimer?.cancel();
      _pauseTimer = null;

      stopForegroundService();

      if (_didClearPersistedAuth) {
        _didClearPersistedAuth = false;
        authService.persistCurrentAuth().then(
          (_) => authService.restoreSession(),
        );
      }
    } else if (state == AppLifecycleState.detached) {
      _pauseTimer?.cancel();
      stopForegroundService();
      final gameService = Provider.of<GameService>(context, listen: false);
      final gameId = gameService.currentGameId;
      if (gameId != null) {
        gameService.quitGame(gameId);
        gameService.clearCurrentGame();
      }
      final socketService = Provider.of<SocketService>(context, listen: false);
      socketService.disconnect();
    }
  }

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: globalNavigatorKey,
      debugShowCheckedModeBanner: false,
      title: 'Kazuma',
      supportedLocales: const [Locale('en', 'US'), Locale('fr', 'CA')],
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        for (var supportedLocale in supportedLocales) {
          if (supportedLocale.languageCode == locale?.languageCode &&
              supportedLocale.countryCode == locale?.countryCode) {
            return supportedLocale;
          }
        }
        return supportedLocales.first;
      },
      builder: (context, child) {
        return GameInvitationOverlay(child: child!);
      },
      home: const AuthGate(),
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
        fontFamily: 'TextFont',
      ),
      routes: {
        '/home': (context) => const HomePage(),
        '/lobby': (context) => const LobbyPage(),
        '/in-game': (context) => const InGamePage(),
        '/login': (context) => const AuthGate(),
        '/register': (context) => const AuthGate(),
        '/wallet': (context) => const WalletPage(),
        '/shop': (context) => const ShopPage(),
      },
    );
  }
}
