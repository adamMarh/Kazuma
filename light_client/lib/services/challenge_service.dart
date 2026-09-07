import 'package:flutter/foundation.dart';
import 'package:light_client/models/challenge_models.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/socket_service.dart';

class ChallengeService extends ChangeNotifier {
  final SocketService _socketService;
  final AuthService _authService;

  PlayerChallenge? _activeChallenge;
  PlayerChallenge? _challengeResult;
  List<ChallengeRecord> _challengeHistory = [];

  bool _listenersRegistered = false;

  PlayerChallenge? get activeChallenge => _activeChallenge;
  PlayerChallenge? get challengeResult => _challengeResult;
  List<ChallengeRecord> get challengeHistory =>
      List.unmodifiable(_challengeHistory);

  ChallengeService({
    required SocketService socketService,
    required AuthService authService,
  }) : _socketService = socketService,
       _authService = authService {
    _socketService.addListener(_onSocketStateChanged);
    _onSocketStateChanged();
  }

  @override
  void dispose() {
    _socketService.removeListener(_onSocketStateChanged);
    super.dispose();
  }

  void loadChallengeHistory() {
    final username = _authService.username;
    if (username == null || username.isEmpty) return;
    _socketService.emit('getChallengeHistory', {'username': username});
  }

  void clearActiveChallenge() {
    _activeChallenge = null;
    _challengeResult = null;
    notifyListeners();
  }

  void _onSocketStateChanged() {
    if (!_socketService.isConnected) return;
    _registerListeners();
  }

  void _registerListeners() {
    if (_listenersRegistered || _socketService.socket == null) return;
    _listenersRegistered = true;

    _socketService.on('challengeAssigned', (data) {
      if (data is! Map) return;
      _activeChallenge = PlayerChallenge.fromMap(
        Map<String, dynamic>.from(data),
      );
      _challengeResult = null;
      notifyListeners();
    });

    _socketService.on('challengeResult', (data) {
      if (data is! Map) return;
      _challengeResult = PlayerChallenge.fromMap(
        Map<String, dynamic>.from(data),
      );
      if (_challengeResult?.completed == true) {
        loadChallengeHistory();
      }
      notifyListeners();
    });

    _socketService.on('challengeHistory', (data) {
      if (data is! List) return;
      _challengeHistory = data
          .whereType<Map>()
          .map(
            (entry) =>
                ChallengeRecord.fromMap(Map<String, dynamic>.from(entry)),
          )
          .toList();
      notifyListeners();
    });
  }
}
