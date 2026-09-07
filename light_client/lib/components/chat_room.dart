import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:light_client/components/avatar_image.dart';
import 'package:light_client/components/message.dart';
import 'package:light_client/components/reaction_selector.dart';
import 'package:light_client/services/chat/chat_notification_service.dart';
import 'package:light_client/services/chat/chat_service.dart';
import 'package:light_client/services/currency_service.dart';
import 'package:light_client/services/user_service.dart';
import 'package:provider/provider.dart';

class ChatRoom extends StatefulWidget {
  final String gameId;
  final bool isGlobalOnly;

  const ChatRoom({super.key, required this.gameId, this.isGlobalOnly = false});

  @override
  State<ChatRoom> createState() => _ChatRoomState();
}

class _ChatRoomState extends State<ChatRoom> {
  final TextEditingController _msgCtrl = TextEditingController();
  final TextEditingController _newRoomCtrl = TextEditingController();
  final TextEditingController _searchCtrl = TextEditingController();
  final ScrollController _scrollCtrl = ScrollController();

  late ChatService _chatService;
  late ChatNotificationService _notificationService;

  String? _currentUid;
  String? _cachedCurrentUsername;
  bool _roomReady = false;
  bool _showRoomsView = false;
  bool _loadingRooms = false;
  String _errorMessage = '';

  List<ChatRoomSummary> _joinedRooms = [];
  List<ChatRoomSummary> _availableRooms = [];
  String _activeRoomId = 'global';

  final Map<String, String?> _avatarCache = {};
  final Map<String, String> _usernameCache = {};
  final Map<String, List<String>> _visualsCache = {};
  final Set<String> _visualsFetching = {};

  int _lastMsgCount = 0;

  static const double _avatarDisplaySize = 16;

  static const Color _kBg = Color(0xFF3E1D0F);
  static const Color _kBorder = Color(0xFF1E1007);
  static const Color _kHeaderBg = Color(0xFF1E1007);
  static const Color _kActiveTab = Color(0xFFD6812C);
  static const Color _kTabText = Color(0xFFFFDEAB);
  static const Color _kMessagesBg = Color(0xFF2E1A0D);
  static const Color _kMessagesBorder = Color(0xFF533012);
  static const Color _kMyMsgBg = Color(0xFF1A67C8);
  static const Color _kMyMsgBorder = Color(0xFF0E3C8A);
  static const Color _kOtherMsgBg = Color(0xFFF8E2BA);
  static const Color _kOtherMsgBorder = Color(0xFFB48B60);
  static const Color _kAuthorText = Color(0xFF413916);
  static const Color _kInputBg = Color(0xFFFFF8E1);

  @override
  void initState() {
    super.initState();
    _chatService = context.read<ChatService>();
    _notificationService = context.read<ChatNotificationService>();
    _chatService.startShakeDetection(context);
    _initializeChat();
  }

  @override
  void didUpdateWidget(covariant ChatRoom oldWidget) {
    super.didUpdateWidget(oldWidget);

    final gameContextChanged =
        oldWidget.gameId != widget.gameId ||
        oldWidget.isGlobalOnly != widget.isGlobalOnly;

    if (!gameContextChanged) return;

    _initializeRoomState();
    _removeStaleGameRoomsLocally();

    WidgetsBinding.instance.addPostFrameCallback((_) async {
      if (!mounted) return;
      await _activateRoom(_activeRoomId);
      if (mounted) {
        setState(() {});
      }
    });
  }

  bool get _shouldIncludeGameRoom {
    return !widget.isGlobalOnly &&
        widget.gameId.isNotEmpty &&
        widget.gameId != 'global';
  }

  int get _maxChars => 255;

  ChatRoomSummary get _globalRoom => const ChatRoomSummary(
    id: 'global',
    name: 'Global',
    owner: 'system',
    isSystem: true,
  );

  ChatRoomSummary get _gameRoom => ChatRoomSummary(
    id: widget.gameId,
    name: 'Discussion ${widget.gameId}',
    owner: 'system',
    isSystem: true,
  );

  String get _currentRoomId => _activeRoomId;

  ChatRoomSummary? get _activeRoom {
    for (final room in _joinedRooms) {
      if (room.id == _activeRoomId) return room;
    }
    for (final room in _availableRooms) {
      if (room.id == _activeRoomId) return room;
    }
    return null;
  }

  List<ChatRoomSummary> get _filteredAvailableRooms {
    final query = _searchCtrl.text.trim().toLowerCase();

    final baseRooms = _availableRooms.where((room) {
      return !_joinedRooms.any((joined) => _isSameRoom(joined, room));
    }).toList();

    if (query.isEmpty) return baseRooms;

    return baseRooms.where((room) {
      return room.name.toLowerCase().contains(query) ||
          room.id.toLowerCase().contains(query);
    }).toList();
  }

  Future<void> _initializeChat() async {
    final userService = context.read<UserService>();
    final username = await userService.getCurrentUsername();
    final currentUid = userService.getCurrentUserId();

    _cachedCurrentUsername = username;
    _currentUid = currentUid;

    if (!mounted) return;

    await _chatService.connect(username, uid: currentUid);

    _initializeRoomState();
    await _rejoinPersistedRooms();
    await _activateRoom(_activeRoomId);
    await _loadAvailableRooms();

    if (!mounted) return;

    context.read<ChatNotificationService>().setChatOpen(
      true,
      roomId: _currentRoomId,
    );

    setState(() {
      _roomReady = true;
    });
  }

  void _initializeRoomState() {
    final defaultRooms = <ChatRoomSummary>[_globalRoom];
    if (_shouldIncludeGameRoom) {
      defaultRooms.insert(0, _gameRoom);
    }

    final savedRooms = (_currentUid != null && _currentUid!.isNotEmpty)
        ? _chatService.getJoinedRoomsSnapshot(_currentUid!)
        : <ChatRoomSummary>[];

    final mergedRooms = <ChatRoomSummary>[...defaultRooms];

    for (final savedRoom in savedRooms) {
      final keepSystemRoom =
          savedRoom.id == 'global' ||
          (_shouldIncludeGameRoom && savedRoom.id == widget.gameId);

      if (savedRoom.isSystem && !keepSystemRoom) {
        continue;
      }

      final alreadyExists = mergedRooms.any(
        (room) => _isSameRoom(room, savedRoom),
      );

      if (!alreadyExists) {
        mergedRooms.add(savedRoom);
      }
    }

    _joinedRooms = mergedRooms;
    _availableRooms = _mergeSystemRooms(const []);

    _syncJoinedRoomsToService();

    final savedActiveRoomId = (_currentUid != null && _currentUid!.isNotEmpty)
        ? _chatService.getActiveRoomIdSnapshot(_currentUid!)
        : 'global';

    final activeRoomStillExists = _joinedRooms.any(
      (room) => room.id == savedActiveRoomId,
    );

    if (activeRoomStillExists) {
      _activeRoomId = savedActiveRoomId;
    } else if (_shouldIncludeGameRoom) {
      _activeRoomId = widget.gameId;
    } else {
      _activeRoomId = 'global';
    }
  }

  Future<void> _rejoinPersistedRooms() async {
    final roomsToRejoin = _joinedRooms.where((room) {
      if (room.id == _activeRoomId) return false;

      if (room.isSystem) {
        return room.id == 'global' || room.id == widget.gameId;
      }
      return true;
    }).toList();

    for (final room in roomsToRejoin) {
      try {
        await _chatService.joinRoom(room.id);
      } catch (_) {}
    }
  }

  Future<void> _activateRoom(String roomId) async {
    final roomExists =
        _availableRooms.any((room) => room.id == roomId) ||
        _joinedRooms.any((room) => room.id == roomId);

    if (!roomExists) {
      roomId = 'global';
    }

    _activeRoomId = roomId;

    if (_currentUid != null && _currentUid!.isNotEmpty) {
      _chatService.setActiveRoomId(_currentUid!, roomId);
    }

    await _chatService.activateRoom(roomId);

    if (!mounted) return;

    context.read<ChatNotificationService>().setChatOpen(true, roomId: roomId);

    setState(() {
      _roomReady = true;
      _lastMsgCount = 0;
    });
  }

  Future<void> _loadAvailableRooms() async {
    setState(() {
      _loadingRooms = true;
    });

    try {
      final rooms = await _chatService.listRooms();
      _availableRooms = _mergeSystemRooms(rooms);
      _reconcileJoinedRoomsWithAvailableRooms();
    } catch (_) {
      _availableRooms = _mergeSystemRooms(const []);
      _reconcileJoinedRoomsWithAvailableRooms();
    } finally {
      if (mounted) {
        setState(() {
          _loadingRooms = false;
        });
      }
    }
  }

  Future<void> _refreshRoomSearch() async {
    final query = _searchCtrl.text.trim();

    setState(() {
      _loadingRooms = true;
    });

    try {
      if (query.isEmpty) {
        final rooms = await _chatService.listRooms();
        _availableRooms = _mergeSystemRooms(rooms);
      } else {
        final rooms = await _chatService.searchRooms(query);
        _availableRooms = _mergeSystemRooms(rooms);
      }
      _reconcileJoinedRoomsWithAvailableRooms();
    } catch (_) {
      // keep current state
    } finally {
      if (mounted) {
        setState(() {
          _loadingRooms = false;
        });
      }
    }
  }

  Future<void> _createRoom() async {
    final roomName = _newRoomCtrl.text.trim();
    if (roomName.isEmpty || _cachedCurrentUsername == null) return;

    setState(() {
      _errorMessage = '';
    });

    try {
      final room = await _chatService.createRoom(
        roomName,
        _cachedCurrentUsername!,
      );
      _newRoomCtrl.clear();
      _addJoinedRoom(room);
      await _activateRoom(room.id);

      if (!mounted) return;
      setState(() {
        _showRoomsView = false;
      });
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _joinRoom(ChatRoomSummary room) async {
    if (_isJoined(room.id, room.ownerUid)) {
      await _activateRoom(room.id);
      return;
    }

    await _chatService.joinRoom(room.id);
    _addJoinedRoom(room);
    await _activateRoom(room.id);
  }

  Future<void> _leaveJoinedRoom(ChatRoomSummary room) async {
    if (room.isSystem) return;

    await _chatService.leaveRoom(room.id);

    _joinedRooms = _joinedRooms.where((r) => !_isSameRoom(r, room)).toList();
    _syncJoinedRoomsToService();

    if (_activeRoomId == room.id) {
      await _activateRoom('global');
    }

    if (mounted) {
      setState(() {});
    }
  }

  Future<void> _deleteRoom(ChatRoomSummary room) async {
    if (!_canDeleteRoom(room) || _cachedCurrentUsername == null) return;

    setState(() {
      _errorMessage = '';
    });

    try {
      await _chatService.deleteRoom(room.id, _cachedCurrentUsername!);
      _handleDeletedRoomLocally(room.id);
      await _loadAvailableRooms();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _errorMessage = e.toString();
      });
    }
  }

  Future<void> _send() async {
    final text = _msgCtrl.text.trim();
    if (text.isEmpty) return;

    final content = text.length > _maxChars
        ? text.substring(0, _maxChars)
        : text;

    await context.read<ChatService>().sendMessage(
      content,
      roomId: _currentRoomId,
      isLobby: _shouldIncludeGameRoom && _currentRoomId == widget.gameId,
    );

    _msgCtrl.clear();

    if (_scrollCtrl.hasClients) {
      _scrollCtrl.animateTo(
        0,
        duration: const Duration(milliseconds: 250),
        curve: Curves.easeOut,
      );
    }
  }

  void _addJoinedRoom(ChatRoomSummary room) {
    if (!_joinedRooms.any((joined) => _isSameRoom(joined, room))) {
      _joinedRooms.add(room);
    }
    _upsertAvailableRoom(room);
    _syncJoinedRoomsToService();

    if (mounted) setState(() {});
  }

  void _upsertAvailableRoom(ChatRoomSummary room) {
    final index = _availableRooms.indexWhere((r) => _isSameRoom(r, room));
    if (index >= 0) {
      _availableRooms[index] = room;
    } else {
      _availableRooms.add(room);
    }

    _availableRooms = _mergeSystemRooms(
      _availableRooms.where((r) => !r.isSystem).toList(),
    );
  }

  void _reconcileJoinedRoomsWithAvailableRooms() {
    final systemRoomKeys = _mergeSystemRooms(
      const [],
    ).map((room) => room.roomKey).toSet();
    final availableRoomKeys = _availableRooms
        .map((room) => room.roomKey)
        .toSet();

    final activeRoomKey =
        '$_activeRoomId::${_activeRoom?.ownerUid ?? 'system'}';

    final activeRoomIsKnown =
        _joinedRooms.any((room) => room.roomKey == activeRoomKey) ||
        availableRoomKeys.contains(activeRoomKey) ||
        systemRoomKeys.contains(activeRoomKey);

    if (!activeRoomIsKnown) {
      _activeRoomId = 'global';
      _showRoomsView = false;
    }

    _removeStaleGameRoomsLocally();

    if (mounted) {
      setState(() {});
    }
  }

  void _handleDeletedRoomLocally(String roomId) {
    _availableRooms = _availableRooms.where((r) => r.id != roomId).toList();
    _joinedRooms = _joinedRooms.where((r) => r.id != roomId).toList();
    _syncJoinedRoomsToService();

    if (_activeRoomId == roomId) {
      _activeRoomId = 'global';
      _showRoomsView = false;
    }

    if (mounted) setState(() {});
  }

  void _syncJoinedRoomsToService() {
    if (_currentUid == null || _currentUid!.isEmpty) return;
    _chatService.setJoinedRooms(_currentUid!, _joinedRooms);
  }

  List<ChatRoomSummary> _mergeSystemRooms(List<ChatRoomSummary> rooms) {
    final systemRooms = <ChatRoomSummary>[_globalRoom];
    if (_shouldIncludeGameRoom) {
      systemRooms.insert(0, _gameRoom);
    }

    final dedupedCustomRooms = <ChatRoomSummary>[];
    for (final room in rooms) {
      final exists = dedupedCustomRooms.any(
        (r) =>
            r.id == room.id &&
            (r.ownerUid ?? 'system') == (room.ownerUid ?? 'system'),
      );
      if (!exists && !room.isSystem) {
        dedupedCustomRooms.add(room);
      }
    }

    return [...systemRooms, ...dedupedCustomRooms];
  }

  void _removeStaleGameRoomsLocally() {
    final currentAllowedGameId = _shouldIncludeGameRoom ? widget.gameId : null;

    bool shouldKeepRoom(ChatRoomSummary room) {
      if (!room.isSystem) return true;
      if (room.id == 'global') return true;
      if (currentAllowedGameId != null && room.id == currentAllowedGameId) {
        return true;
      }
      return false;
    }

    _joinedRooms = _joinedRooms.where(shouldKeepRoom).toList();
    _availableRooms = _availableRooms.where(shouldKeepRoom).toList();

    _syncJoinedRoomsToService();

    if (_activeRoomId != 'global') {
      final activeStillExists =
          _joinedRooms.any((r) => r.id == _activeRoomId) ||
          _availableRooms.any((r) => r.id == _activeRoomId);

      if (!activeStillExists) {
        _activeRoomId = 'global';
        _showRoomsView = false;
      }
    }
  }

  bool _isJoined(String roomId, String? ownerUid) {
    return _joinedRooms.any(
      (joined) => joined.id == roomId && joined.ownerUid == ownerUid,
    );
  }

  bool _isSameRoom(ChatRoomSummary a, ChatRoomSummary b) {
    return a.id == b.id && (a.ownerUid ?? 'system') == (b.ownerUid ?? 'system');
  }

  bool _canDeleteRoom(ChatRoomSummary room) {
    return !room.isSystem && room.owner == _cachedCurrentUsername;
  }

  bool _canLeaveRoom(ChatRoomSummary room) {
    return !room.isSystem;
  }

  Future<String?> _getAvatar(String senderId, String senderUsername) async {
    final key = senderId.isNotEmpty
        ? 'uid:$senderId'
        : 'username:$senderUsername';

    if (_avatarCache.containsKey(key)) {
      return _avatarCache[key];
    }

    final userService = context.read<UserService>();
    String? base64;

    try {
      if (senderId.isNotEmpty) {
        base64 = await userService.getAvatarBase64ByUid(senderId);
      } else {
        base64 = await userService.getAvatarBase64ByUsername(senderUsername);
      }
    } catch (e) {
      debugPrint('Err fetching avatar: $e');
    }

    if (mounted) {
      setState(() {
        _avatarCache[key] = base64;
      });
    }
    return base64;
  }

  Future<String> _getUsername(
    String uid, {
    required String fallbackName,
  }) async {
    if (!_looksLikeUid(uid)) return fallbackName;
    if (_usernameCache.containsKey(uid)) return _usernameCache[uid]!;
    final userService = Provider.of<UserService>(context, listen: false);
    final username = await userService.getUsernameById(uid);
    _usernameCache[uid] = username;
    return username;
  }

  bool _looksLikeUid(String uid) {
    final value = uid.trim();
    return value.isNotEmpty &&
        value.toLowerCase() != 'unknown' &&
        !value.contains(' ');
  }

  String _resolveDisplayUsername(String? fetched, String fallback) {
    final trimmedFallback = fallback.trim();
    final trimmedFetched = (fetched ?? '').trim();

    if (trimmedFetched.isNotEmpty &&
        trimmedFetched.toLowerCase() != 'unknown') {
      return trimmedFetched;
    }
    if (trimmedFallback.isNotEmpty) {
      return trimmedFallback;
    }
    return 'Unknown';
  }

  void _prefetchMessageData(Message msg) {
    _getAvatar(msg.senderId, msg.senderUsername);
    _getUsername(msg.senderId, fallbackName: msg.senderUsername).then((_) {
      _ensureVisualsForSender(msg.senderId, msg.senderUsername);
    });
  }

  Future<void> _ensureVisualsForSender(
    String senderId,
    String senderUsername,
  ) async {
    final username = _usernameCache[senderId] ?? senderUsername;
    if (_visualsCache.containsKey(username) ||
        _visualsFetching.contains(username)) {
      return;
    }
    _visualsFetching.add(username);

    try {
      final currencyService = Provider.of<CurrencyService>(
        context,
        listen: false,
      );
      final currentUsername = _cachedCurrentUsername ?? '';

      List<String> visuals;
      if (username == currentUsername) {
        visuals = currencyService.wallet.ownedVisuals;
      } else {
        final other = await currencyService.getWalletByUsername(username);
        visuals = other?.ownedVisuals ?? [];
      }

      if (mounted) {
        setState(() {
          _visualsCache[username] = visuals;
        });
      }
    } catch (e) {
      debugPrint('Error fetching visuals for $username: $e');
    } finally {
      _visualsFetching.remove(username);
    }
  }

  Widget _buildAvatarWithVisuals(Message msg) {
    final key = msg.senderId.isNotEmpty
        ? 'uid:${msg.senderId}'
        : 'username:${msg.senderUsername}';
    final base64 = _avatarCache[key];
    final username = _usernameCache[msg.senderId] ?? msg.senderUsername;
    final visuals = _visualsCache[username] ?? <String>[];

    final hasAura =
        visuals.contains('vis_aura') || visuals.contains('visual-aura');

    final avatarWidget = AvatarImage(
      base64: base64,
      radius: _avatarDisplaySize,
    );

    Widget decoratedAvatar = avatarWidget;
    if (hasAura) {
      decoratedAvatar = Container(
        padding: const EdgeInsets.all(2),
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(
            color: Colors.white.withValues(alpha: 0.8),
            width: 2.5,
          ),
          boxShadow: [
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.6),
              blurRadius: 15,
              spreadRadius: 3,
            ),
            BoxShadow(
              color: Colors.white.withValues(alpha: 0.4),
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
          child: avatarWidget,
        ),
      );
    }

    return SizedBox(width: 24, height: 24, child: decoratedAvatar);
  }

  Widget _buildUsernameWithVisuals(Message msg) {
    final fetchedUsername = _usernameCache[msg.senderId];
    final resolvedUsername = fetchedUsername ?? msg.senderUsername;
    final visuals = _visualsCache[resolvedUsername] ?? <String>[];
    final displayUsername = _resolveDisplayUsername(
      fetchedUsername,
      msg.senderUsername,
    );

    final hasUsernameStyle =
        visuals.contains('vis_rainbow') ||
        visuals.contains('vis_police_nom') ||
        visuals.contains('visual-enchanted');
    final hasUsernameCrown =
        visuals.contains('vis_starry_name') ||
        visuals.contains('vis_flag_custom') ||
        visuals.contains('visual-stars');
    final hasTrailingStar = hasUsernameCrown;

    Widget usernameWidget;
    if (hasUsernameStyle) {
      const gradient = LinearGradient(
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

      usernameWidget = ShaderMask(
        blendMode: BlendMode.srcIn,
        shaderCallback: (bounds) => gradient.createShader(
          Rect.fromLTWH(0, 0, bounds.width, bounds.height),
        ),
        child: Text(
          displayUsername,
          style: const TextStyle(
            fontWeight: FontWeight.bold,
            color: Colors.white,
            fontSize: 12,
            fontFamily: 'TextFont',
          ),
          overflow: TextOverflow.ellipsis,
        ),
      );
    } else {
      usernameWidget = Text(
        displayUsername,
        style: const TextStyle(
          fontWeight: FontWeight.bold,
          color: _kAuthorText,
          fontSize: 12,
          fontFamily: 'TextFont',
        ),
        overflow: TextOverflow.ellipsis,
      );
    }

    final usernameRowChildren = <Widget>[];

    if (hasTrailingStar) {
      usernameRowChildren.add(
        const Padding(
          padding: EdgeInsets.only(right: 4),
          child: Icon(Icons.auto_awesome, size: 12, color: Color(0xFFFFD700)),
        ),
      );
    }

    usernameRowChildren.add(usernameWidget);

    if (hasTrailingStar) {
      usernameRowChildren.add(
        const Padding(
          padding: EdgeInsets.only(left: 4),
          child: Icon(Icons.auto_awesome, size: 12, color: Color(0xFFFFD700)),
        ),
      );
    }

    return Row(mainAxisSize: MainAxisSize.min, children: usernameRowChildren);
  }

  Widget _buildHeader() {
    return Container(
      color: _kHeaderBg,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
      child: Row(
        children: [
          Expanded(
            child: Text(
              _showRoomsView ? '💬 Gestion des salles' : '💬 Chat',
              style: const TextStyle(
                color: _kTabText,
                fontSize: 15,
                fontWeight: FontWeight.bold,
                fontFamily: 'TextFont',
                shadows: [Shadow(offset: Offset(1, 1), color: Colors.black)],
              ),
            ),
          ),
          ElevatedButton(
            onPressed: () {
              setState(() {
                _showRoomsView = !_showRoomsView;
              });
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: _kActiveTab,
              foregroundColor: Colors.white,
              shape: RoundedRectangleBorder(
                borderRadius: BorderRadius.circular(0),
              ),
            ),
            child: Text(
              _showRoomsView ? 'Retour' : 'Salles',
              style: const TextStyle(
                fontFamily: 'TextFont',
                fontSize: 12,
                fontWeight: FontWeight.bold,
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildRoomsView() {
    return Container(
      decoration: BoxDecoration(
        color: _kMessagesBg,
        border: Border.all(color: _kMessagesBorder, width: 2),
      ),
      padding: const EdgeInsets.fromLTRB(8, 8, 8, 6),
      child: Column(
        children: [
          _buildCompactCreateBar(),
          const SizedBox(height: 8),
          _buildCompactSearchBar(),
          if (_errorMessage.isNotEmpty) ...[
            const SizedBox(height: 6),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                _errorMessage,
                style: const TextStyle(
                  color: Colors.redAccent,
                  fontSize: 11,
                  fontFamily: 'TextFont',
                ),
              ),
            ),
          ],
          const SizedBox(height: 10),
          Expanded(
            child: _loadingRooms
                ? const Center(child: CircularProgressIndicator())
                : ListView(
                    children: [
                      const Text(
                        'Mes salles',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'TextFont',
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ..._joinedRooms.map(_buildJoinedRoomTile),
                      const SizedBox(height: 12),
                      const Text(
                        'Salles disponibles',
                        style: TextStyle(
                          color: Colors.white,
                          fontWeight: FontWeight.bold,
                          fontFamily: 'TextFont',
                          fontSize: 13,
                        ),
                      ),
                      const SizedBox(height: 6),
                      ..._filteredAvailableRooms.map(_buildAvailableRoomTile),
                      if (_filteredAvailableRooms.isEmpty)
                        const Padding(
                          padding: EdgeInsets.only(top: 8),
                          child: Text(
                            'Aucune salle trouvée',
                            style: TextStyle(
                              color: Colors.white70,
                              fontFamily: 'TextFont',
                              fontSize: 11,
                            ),
                          ),
                        ),
                    ],
                  ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactCreateBar() {
    final canCreate =
        _newRoomCtrl.text.trim().isNotEmpty && _cachedCurrentUsername != null;

    return Container(
      padding: const EdgeInsets.all(6),
      decoration: BoxDecoration(
        color: const Color(0xFF2A160B),
        border: Border.all(color: _kMessagesBorder, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: Row(
        children: [
          const Icon(
            Icons.add_comment_outlined,
            size: 16,
            color: Color(0xFFFFDEAB),
          ),
          const SizedBox(width: 6),
          Expanded(
            child: SizedBox(
              height: 42,
              child: TextField(
                controller: _newRoomCtrl,
                maxLength: 40,
                onChanged: (_) => setState(() {}),
                style: const TextStyle(
                  color: Color(0xFF2E1A0D),
                  fontFamily: 'TextFont',
                  fontSize: 12,
                ),
                decoration: InputDecoration(
                  hintText: 'Nouvelle salle',
                  hintStyle: const TextStyle(
                    color: Colors.black45,
                    fontFamily: 'TextFont',
                    fontSize: 11,
                  ),
                  counterText: '',
                  isDense: true,
                  filled: true,
                  fillColor: _kInputBg,
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 10,
                    vertical: 10,
                  ),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(3),
                    borderSide: const BorderSide(color: _kMessagesBorder),
                  ),
                  enabledBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(3),
                    borderSide: const BorderSide(color: _kMessagesBorder),
                  ),
                  focusedBorder: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(3),
                    borderSide: const BorderSide(
                      color: _kActiveTab,
                      width: 1.5,
                    ),
                  ),
                ),
                onSubmitted: (_) => _createRoom(),
              ),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            height: 42,
            child: ElevatedButton(
              onPressed: canCreate ? _createRoom : null,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kActiveTab,
                foregroundColor: Colors.white,
                disabledBackgroundColor: const Color(0xFF7A5A3A),
                disabledForegroundColor: Colors.white60,
                elevation: 0,
                padding: const EdgeInsets.symmetric(horizontal: 12),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(3),
                  side: const BorderSide(color: _kBorder, width: 1.5),
                ),
              ),
              child: const Text(
                'Créer',
                style: TextStyle(
                  fontFamily: 'TextFont',
                  fontSize: 11,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCompactSearchBar() {
    return Container(
      height: 40,
      decoration: BoxDecoration(
        color: _kInputBg.withValues(alpha: 0.96),
        border: Border.all(color: _kMessagesBorder, width: 1.5),
        borderRadius: BorderRadius.circular(3),
      ),
      child: TextField(
        controller: _searchCtrl,
        onChanged: (_) => _refreshRoomSearch(),
        style: const TextStyle(
          color: Color(0xFF2E1A0D),
          fontFamily: 'TextFont',
          fontSize: 12,
        ),
        decoration: InputDecoration(
          hintText: 'Rechercher une salle',
          hintStyle: const TextStyle(
            color: Colors.black45,
            fontFamily: 'TextFont',
            fontSize: 11,
          ),
          prefixIcon: const Icon(
            Icons.search,
            size: 18,
            color: Color(0xFF6E563D),
          ),
          suffixIcon: _searchCtrl.text.isNotEmpty
              ? IconButton(
                  onPressed: () async {
                    _searchCtrl.clear();
                    setState(() {});
                    await _refreshRoomSearch();
                  },
                  icon: const Icon(
                    Icons.close,
                    size: 16,
                    color: Color(0xFF6E563D),
                  ),
                )
              : null,
          isDense: true,
          filled: true,
          fillColor: Colors.transparent,
          contentPadding: const EdgeInsets.symmetric(
            horizontal: 10,
            vertical: 10,
          ),
          border: InputBorder.none,
        ),
      ),
    );
  }

  Widget _buildJoinedRoomTile(ChatRoomSummary room) {
    final isActive = room.id == _activeRoomId;

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: isActive
            ? _kActiveTab.withValues(alpha: 0.2)
            : Colors.transparent,
        border: Border.all(color: _kMessagesBorder),
      ),
      child: ListTile(
        dense: true,
        title: Row(
          children: [
            Expanded(
              child: Text(
                room.name,
                style: const TextStyle(
                  color: Colors.white,
                  fontFamily: 'TextFont',
                ),
              ),
            ),
            Consumer<ChatNotificationService>(
              builder: (context, notificationService, _) {
                final unread = notificationService.unreadCountFor(room.id);
                if (unread > 0) {
                  return Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 6,
                      vertical: 2,
                    ),
                    decoration: BoxDecoration(
                      color: Colors.redAccent,
                      borderRadius: BorderRadius.circular(10),
                    ),
                    child: Text(
                      unread.toString(),
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 11,
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  );
                }
                return const SizedBox.shrink();
              },
            ),
          ],
        ),
        subtitle: Text(
          room.isSystem ? 'Système' : 'Créée par ${room.owner}',
          style: const TextStyle(color: Colors.white70, fontSize: 11),
        ),
        onTap: () async {
          await _activateRoom(room.id);
          if (!mounted) return;
          setState(() {
            _showRoomsView = false;
          });
        },
        trailing: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            if (_canDeleteRoom(room))
              IconButton(
                onPressed: () => _deleteRoom(room),
                icon: const Icon(Icons.delete, color: Colors.redAccent),
              ),
            if (_canLeaveRoom(room))
              IconButton(
                onPressed: () => _leaveJoinedRoom(room),
                icon: const Icon(Icons.logout, color: Colors.white),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildAvailableRoomTile(ChatRoomSummary room) {
    final joined = _isJoined(room.id, room.ownerUid);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(border: Border.all(color: _kMessagesBorder)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            room.name,
            style: const TextStyle(
              color: Colors.white,
              fontFamily: 'TextFont',
              fontWeight: FontWeight.bold,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            room.isSystem ? 'Salle système' : 'Créée par ${room.owner}',
            style: const TextStyle(color: Colors.white70, fontSize: 11),
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              ElevatedButton(
                onPressed: () async {
                  if (joined) {
                    await _activateRoom(room.id);
                  } else {
                    await _joinRoom(room);
                  }

                  if (!mounted) return;
                  setState(() {
                    _showRoomsView = false;
                  });
                },
                child: Text(joined ? 'Ouvrir' : 'Joindre'),
              ),
              if (_canDeleteRoom(room))
                ElevatedButton(
                  onPressed: () => _deleteRoom(room),
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.redAccent,
                  ),
                  child: const Text('Supprimer'),
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildMessagesArea() {
    return Container(
      decoration: BoxDecoration(
        color: _kMessagesBg,
        border: Border.all(color: _kMessagesBorder, width: 2),
      ),
      padding: const EdgeInsets.all(8),
      child: Consumer<ChatService>(
        builder: (context, chatService, _) {
          if (!_roomReady || !chatService.isConnected) {
            return const Center(child: CircularProgressIndicator());
          }

          return StreamBuilder<List<Message>>(
            stream: chatService.getMessages(roomId: _currentRoomId),
            builder: (context, snapshot) {
              final messages = snapshot.data ?? <Message>[];

              for (final msg in messages) {
                _prefetchMessageData(msg);
              }

              if (messages.length > _lastMsgCount) {
                WidgetsBinding.instance.addPostFrameCallback((_) {
                  if (_scrollCtrl.hasClients) {
                    _scrollCtrl.animateTo(
                      0,
                      duration: const Duration(milliseconds: 250),
                      curve: Curves.easeOut,
                    );
                  }
                });
              }
              _lastMsgCount = messages.length;

              if (messages.isEmpty) {
                return const Center(
                  child: Text(
                    'Aucun message. Soyez le premier à écrire!',
                    style: TextStyle(
                      color: Colors.white54,
                      fontStyle: FontStyle.italic,
                      fontSize: 12,
                      fontFamily: 'TextFont',
                    ),
                  ),
                );
              }

              final reversed = messages.reversed.toList();

              return Column(
                children: [
                  Container(
                    width: double.infinity,
                    padding: const EdgeInsets.only(bottom: 8),
                    child: Text(
                      'Salle actuelle: ${_activeRoom?.name ?? _currentRoomId}',
                      style: const TextStyle(
                        color: _kTabText,
                        fontFamily: 'TextFont',
                        fontWeight: FontWeight.bold,
                      ),
                    ),
                  ),
                  Expanded(
                    child: ListView.builder(
                      controller: _scrollCtrl,
                      reverse: true,
                      itemCount: reversed.length,
                      itemBuilder: (_, i) => _buildMessageLine(reversed[i]),
                    ),
                  ),
                ],
              );
            },
          );
        },
      ),
    );
  }

  Widget _buildMessageLine(Message msg) {
    final isMe = msg.senderId == _currentUid;
    final time = DateFormat('HH:mm:ss').format(msg.timestamp);

    return Container(
      margin: const EdgeInsets.only(bottom: 6),
      child: Row(
        mainAxisAlignment: isMe
            ? MainAxisAlignment.end
            : MainAxisAlignment.start,
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Flexible(
            child: Container(
              margin: EdgeInsets.only(
                left: isMe ? 30.0 : 0.0,
                right: isMe ? 0.0 : 30.0,
              ),
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
              decoration: BoxDecoration(
                color: isMe ? _kMyMsgBg : _kOtherMsgBg,
                border: Border.all(
                  color: isMe ? _kMyMsgBorder : _kOtherMsgBorder,
                  width: 2,
                ),
                borderRadius: BorderRadius.circular(4),
                boxShadow: const [
                  BoxShadow(color: Colors.black, offset: Offset(1, 1)),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      _buildAvatarWithVisuals(msg),
                      const SizedBox(width: 6),
                      Flexible(child: _buildUsernameWithVisuals(msg)),
                      const SizedBox(width: 6),
                      Text(
                        time,
                        style: const TextStyle(
                          color: Color(0xFFAAAAAA),
                          fontSize: 10,
                          fontFamily: 'TextFont',
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 4),
                  Text(
                    msg.message,
                    softWrap: true,
                    style: TextStyle(
                      color: isMe ? Colors.white : const Color(0xFF2E1A0D),
                      fontSize: 12,
                      fontFamily: 'TextFont',
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildInputArea() {
    return Container(
      padding: const EdgeInsets.only(top: 6),
      decoration: const BoxDecoration(
        border: Border(top: BorderSide(color: _kBg, width: 2)),
        color: _kMessagesBg,
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.end,
        children: [
          const ReactionSelector(),
          const SizedBox(width: 4),
          Expanded(
            child: Container(
              constraints: const BoxConstraints(minHeight: 32),
              decoration: BoxDecoration(
                color: _kInputBg,
                border: Border.all(color: const Color(0xFF533012), width: 2),
                borderRadius: BorderRadius.circular(2),
              ),
              child: TextField(
                controller: _msgCtrl,
                maxLength: _maxChars,
                minLines: 1,
                maxLines: 5,
                style: const TextStyle(
                  color: Color(0xFF2E1A0D),
                  fontSize: 12,
                  fontFamily: 'TextFont',
                ),
                decoration: InputDecoration(
                  hintText:
                      'Tapez un message dans ${_activeRoom?.name ?? _currentRoomId}...',
                  hintStyle: const TextStyle(
                    color: Colors.black45,
                    fontSize: 11,
                    fontFamily: 'TextFont',
                  ),
                  contentPadding: const EdgeInsets.symmetric(
                    horizontal: 6,
                    vertical: 8,
                  ),
                  counterText: '',
                  border: InputBorder.none,
                ),
                onSubmitted: (_) => _send(),
              ),
            ),
          ),
          const SizedBox(width: 6),
          SizedBox(
            height: 32,
            child: ElevatedButton(
              onPressed: _send,
              style: ElevatedButton.styleFrom(
                backgroundColor: _kActiveTab,
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(horizontal: 10),
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(0),
                  side: const BorderSide(color: _kBg, width: 2),
                ),
                elevation: 0,
              ),
              child: const Text(
                'Envoyer',
                style: TextStyle(
                  fontFamily: 'TextFont',
                  fontSize: 12,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }

  @override
  void dispose() {
    _notificationService.setChatOpenSilently(false);
    _chatService.stopShakeDetection();
    _msgCtrl.dispose();
    _newRoomCtrl.dispose();
    _searchCtrl.dispose();
    _scrollCtrl.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: _kBg,
        border: Border.all(color: _kBorder, width: 4),
        boxShadow: const [BoxShadow(color: Colors.black, offset: Offset(4, 4))],
      ),
      padding: const EdgeInsets.all(10),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          _buildHeader(),
          const SizedBox(height: 6),
          Expanded(
            child: _showRoomsView ? _buildRoomsView() : _buildMessagesArea(),
          ),
          if (!_showRoomsView) ...[
            const SizedBox(height: 8),
            _buildInputArea(),
          ],
        ],
      ),
    );
  }
}
