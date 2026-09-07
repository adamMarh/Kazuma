import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/friend/friend_events.dart';
import 'package:light_client/services/friend/friend_models.dart';
import 'package:light_client/services/socket_service.dart';

class FriendService extends ChangeNotifier {
  final SocketService _socketService;
  final AuthService _authService;

  List<FriendEntry> _friends = [];
  List<FriendRequest> _pendingRequests = [];
  List<UserProfile> _blockedUsers = [];
  List<UserProfile> _searchResults = [];
  String _lastSearchQuery = '';
  String? _errorMessage;
  bool _registered = false;
  bool _listenersSetup = false;
  int _usersUpdateRevision = 0;
  bool _isBusy = false;

  final Set<String> _pendingSentUids = {};

  final StreamController<GameInvitation> _invitationController =
      StreamController<GameInvitation>.broadcast();

  final StreamController<Map<String, dynamic>> _lobbyBlockConflictCtrl =
      StreamController<Map<String, dynamic>>.broadcast();

  final StreamController<Map<String, dynamic>> _lobbyBlockStayOrLeaveCtrl =
      StreamController<Map<String, dynamic>>.broadcast();

  Timer? _searchDebounceTimer;

  List<FriendEntry> get friends => _friends;
  List<FriendRequest> get pendingRequests => _pendingRequests;
  List<UserProfile> get blockedUsers => _blockedUsers;
  List<UserProfile> get searchResults => _searchResults;
  String get lastSearchQuery => _lastSearchQuery;
  String? get errorMessage => _errorMessage;
  int get pendingCount => _pendingRequests.length;
  int get usersUpdateRevision => _usersUpdateRevision;
  bool get isBusy => _isBusy;
  Stream<GameInvitation> get invitationStream => _invitationController.stream;
  Stream<Map<String, dynamic>> get lobbyBlockConflictStream =>
      _lobbyBlockConflictCtrl.stream;
  Stream<Map<String, dynamic>> get lobbyBlockStayOrLeaveStream =>
      _lobbyBlockStayOrLeaveCtrl.stream;

  bool isRequestSent(String uid) => _pendingSentUids.contains(uid);

  void setBusy(bool busy) {
    if (_authService.uid == null) return;
    _isBusy = busy;
    _socketService.emit(FriendEvents.setBusy, {
      'uid': _authService.uid,
      'busy': busy,
    });
    notifyListeners();
  }

  FriendService({
    required SocketService socketService,
    required AuthService authService,
  }) : _socketService = socketService,
       _authService = authService {
    _socketService.addListener(_onSocketConnectionChanged);
    _socketService.onReconnect(_onSocketReconnected);
    _authService.addListener(_onAuthStateChanged);
  }

  void registerUser() {
    final uid = _authService.uid;
    if (uid != null && !_registered) {
      if (!_listenersSetup && _socketService.socket != null) {
        _setupSocketListeners();
        _listenersSetup = true;
      }
      if (_socketService.isConnected) {
        _socketService.emit(FriendEvents.registerUser, {
          'uid': uid,
          'username': _authService.username ?? uid,
        });
        _registered = true;
        loadFriends();
        loadPendingRequests();
      }
    }
  }

  void loadFriends() {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.getFriends, {'userUid': uid});
    }
  }

  void loadPendingRequests() {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.getPendingRequests, {'userUid': uid});
    }
  }

  void sendFriendRequest(String toUid) {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.sendRequest, {
        'fromUid': uid,
        'toUid': toUid,
      });
      _pendingSentUids.add(toUid);
      notifyListeners();
    }
  }

  void acceptRequest(String requestId) {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.acceptRequest, {
        'requestId': requestId,
        'userUid': uid,
      });
      _pendingRequests.removeWhere((r) => r.id == requestId);
      notifyListeners();
    }
  }

  void declineRequest(String requestId) {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.declineRequest, {
        'requestId': requestId,
        'userUid': uid,
      });
      _pendingRequests.removeWhere((r) => r.id == requestId);
      notifyListeners();
    }
  }

  void removeFriend(String friendUid) {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.removeFriend, {
        'userUid': uid,
        'friendUid': friendUid,
      });
    }
  }

  void inviteFriendToGame(String friendUid, String gameId) {
    final uid = _authService.uid;
    if (uid != null) {
      _socketService.emit(FriendEvents.inviteToGame, {
        'fromUid': uid,
        'toUid': friendUid,
        'gameId': gameId,
      });
    }
  }

  void onSearchInput(String query) {
    _searchDebounceTimer?.cancel();
    final trimmed = query.trim();
    if (trimmed.length < 2) {
      _searchResults = [];
      _lastSearchQuery = '';
      notifyListeners();
      return;
    }
    if (trimmed == _lastSearchQuery) return;
    _searchDebounceTimer = Timer(const Duration(milliseconds: 300), () {
      _emitSearch(trimmed);
    });
  }

  void _emitSearch(String query) {
    final uid = _authService.uid;
    if (uid == null || query.trim().isEmpty) return;
    _lastSearchQuery = query;
    _socketService.emit(FriendEvents.searchUsers, {
      'query': query,
      'userUid': uid,
    });
  }

  void clearSearch() {
    _searchResults = [];
    _lastSearchQuery = '';
    notifyListeners();
  }

  void blockUser(String blockedUid) {
    final uid = _authService.uid;
    if (uid == null) return;
    _socketService.emit(FriendEvents.blockUser, {
      'blockerUid': uid,
      'blockedUid': blockedUid,
    });
  }

  void unblockUser(String blockedUid) {
    final uid = _authService.uid;
    if (uid == null) return;
    _socketService.emit(FriendEvents.unblockUser, {
      'blockerUid': uid,
      'blockedUid': blockedUid,
    });
  }

  Future<Map<String, dynamic>> confirmLobbyBlock(String gameId) {
    final completer = Completer<Map<String, dynamic>>();
    _socketService.emitWithAck(
      FriendEvents.lobbyBlockConfirm,
      {'gameId': gameId},
      ack: (data) {
        if (data is Map && data['success'] == true && data['game'] != null) {
          completer.complete(Map<String, dynamic>.from(data));
        } else {
          completer.completeError(
            'Impossible de rejoindre la salle après confirmation.',
          );
        }
      },
    );
    return completer.future.timeout(const Duration(seconds: 10));
  }

  void _setupSocketListeners() {
    _socketService.on(FriendEvents.friendListUpdated, (data) {
      if (data is List) {
        _friends = data
            .map(
              (e) => FriendEntry.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList();
        notifyListeners();
      }
    });

    _socketService.on(FriendEvents.pendingRequestsUpdated, (data) {
      if (data is List) {
        _pendingRequests = data
            .map(
              (e) =>
                  FriendRequest.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList();
        notifyListeners();
      }
    });

    _socketService.on(FriendEvents.receiveRequest, (data) {
      if (data is Map) {
        final request = FriendRequest.fromJson(Map<String, dynamic>.from(data));
        if (!_pendingRequests.any((r) => r.id == request.id)) {
          _pendingRequests.insert(0, request);
          notifyListeners();
        }
      } else {
        _setError('Format de données invalide pour la demande reçue.');
      }
    });

    _socketService.on(FriendEvents.requestAccepted, (data) {
      if (data is Map) {
        final request = FriendRequest.fromJson(Map<String, dynamic>.from(data));
        _pendingSentUids.remove(request.toUid);
      } else {
        _setError('Format de données invalide pour la demande acceptée.');
      }
      loadFriends();
    });

    _socketService.on(FriendEvents.requestDeclined, (data) {
      if (data is Map) {
        final request = FriendRequest.fromJson(Map<String, dynamic>.from(data));
        _pendingSentUids.remove(request.toUid);
        notifyListeners();
      } else {
        _setError('Format de données invalide pour la demande refusée.');
      }
    });

    _socketService.on(FriendEvents.friendRemoved, (_) {
      loadFriends();
    });

    _socketService.on(FriendEvents.usersUpdated, (_) {
      _usersUpdateRevision++;
      notifyListeners();
    });

    _socketService.on(FriendEvents.statusChanged, (data) {
      if (data is Map) {
        final uid = data['uid'] as String?;
        final statusStr = data['status'] as String?;
        if (uid != null) {
          final status = userStatusFromString(statusStr);
          final idx = _friends.indexWhere((f) => f.uid == uid);
          if (idx != -1) {
            _friends[idx].userStatus = status;
            notifyListeners();
          }
        }
      }
    });

    _socketService.on(FriendEvents.gameInvitation, (data) {
      if (data is Map) {
        final invitation = GameInvitation.fromJson(
          Map<String, dynamic>.from(data),
        );
        _invitationController.add(invitation);
      }
    });

    _socketService.on(FriendEvents.error, (data) {
      if (data is Map) {
        _setError((data['message'] as String?) ?? 'Erreur inconnue');
      } else {
        _setError('Une erreur inattendue est survenue.');
      }
    });

    _socketService.on(FriendEvents.searchResults, (data) {
      if (data is List) {
        _searchResults = data
            .map(
              (e) => UserProfile.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList();
        notifyListeners();
      }
    });

    _socketService.on(FriendEvents.blockedListUpdated, (data) {
      if (data is List) {
        _blockedUsers = data
            .map(
              (e) => UserProfile.fromJson(Map<String, dynamic>.from(e as Map)),
            )
            .toList();
        notifyListeners();
      }
    });

    _socketService.on(FriendEvents.userBlocked, (data) {
      if (data is Map) {
        final blockedUid = data['blockedUid'] as String?;
        if (blockedUid != null) {
          _friends.removeWhere((f) => f.uid == blockedUid);
          _searchResults.removeWhere((u) => u.uid == blockedUid);
          notifyListeners();
        }
      }
    });

    _socketService.on(FriendEvents.userUnblocked, (data) {
      if (data is Map) {
        final unblockedUid = data['unblockedUid'] as String?;
        if (unblockedUid != null) {
          _blockedUsers.removeWhere((u) => u.uid == unblockedUid);
          notifyListeners();
        }
      }
    });

    _socketService.on(FriendEvents.newUser, (_) {
      if (_lastSearchQuery.isNotEmpty) {
        _emitSearch(_lastSearchQuery);
      }
    });

    _socketService.on(FriendEvents.lobbyBlockConflict, (data) {
      if (data is Map) {
        _lobbyBlockConflictCtrl.add(Map<String, dynamic>.from(data));
      }
    });

    _socketService.on(FriendEvents.lobbyBlockStayOrLeave, (data) {
      if (data is Map) {
        _lobbyBlockStayOrLeaveCtrl.add(Map<String, dynamic>.from(data));
      }
    });
  }

  void _setError(String message) {
    _errorMessage = message;
    notifyListeners();
    Future.delayed(const Duration(seconds: 4), () {
      _errorMessage = null;
      notifyListeners();
    });
  }

  void _onSocketReconnected() {
    _registered = false;
    registerUser();
  }

  void _onSocketConnectionChanged() {
    if (_socketService.isConnected) {
      registerUser();
    }
    notifyListeners();
  }

  void _onAuthStateChanged() {
    final uid = _authService.uid;
    if (uid != null) {
      registerUser();
    } else {
      _registered = false;
      _friends = [];
      _pendingRequests = [];
      _blockedUsers = [];
      _searchResults = [];
      _lastSearchQuery = '';
      _pendingSentUids.clear();
      notifyListeners();
    }
  }

  void reset() {
    _friends = [];
    _pendingRequests = [];
    _blockedUsers = [];
    _searchResults = [];
    _lastSearchQuery = '';
    _pendingSentUids.clear();
    _errorMessage = null;
    _registered = false;
    notifyListeners();
  }

  @override
  void dispose() {
    _searchDebounceTimer?.cancel();
    _socketService.removeListener(_onSocketConnectionChanged);
    _socketService.offReconnect(_onSocketReconnected);
    _authService.removeListener(_onAuthStateChanged);

    _socketService.off(FriendEvents.friendListUpdated);
    _socketService.off(FriendEvents.pendingRequestsUpdated);
    _socketService.off(FriendEvents.receiveRequest);
    _socketService.off(FriendEvents.requestAccepted);
    _socketService.off(FriendEvents.requestDeclined);
    _socketService.off(FriendEvents.friendRemoved);
    _socketService.off(FriendEvents.usersUpdated);
    _socketService.off(FriendEvents.statusChanged);
    _socketService.off(FriendEvents.gameInvitation);
    _socketService.off(FriendEvents.error);
    _socketService.off(FriendEvents.searchResults);
    _socketService.off(FriendEvents.blockedListUpdated);
    _socketService.off(FriendEvents.userBlocked);
    _socketService.off(FriendEvents.userUnblocked);
    _socketService.off(FriendEvents.newUser);
    _socketService.off(FriendEvents.lobbyBlockConflict);
    _socketService.off(FriendEvents.lobbyBlockStayOrLeave);
    _lobbyBlockConflictCtrl.close();
    _lobbyBlockStayOrLeaveCtrl.close();
    super.dispose();
  }
}
