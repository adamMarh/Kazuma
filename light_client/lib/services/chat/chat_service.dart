import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/components/message.dart';
import 'package:light_client/services/chat/chat_notification_service.dart';
import 'package:light_client/services/chat/message_repository.dart';
import 'package:light_client/services/chat/shake_detection_service.dart';
import 'package:light_client/services/socket_service.dart';

class ChatRoomSummary {
  final String id;
  final String name;
  final String owner;
  final String? ownerUid;
  final bool isSystem;

  const ChatRoomSummary({
    required this.id,
    required this.name,
    required this.owner,
    this.ownerUid,
    this.isSystem = false,
  });

  factory ChatRoomSummary.fromMap(Map<dynamic, dynamic> map) {
    return ChatRoomSummary(
      id: (map['id'] ?? '').toString(),
      name: (map['name'] ?? '').toString(),
      owner: (map['owner'] ?? 'system').toString(),
      ownerUid: map['ownerUid']?.toString(),
      isSystem: map['isSystem'] == true,
    );
  }

  String get roomKey => '$id::${ownerUid ?? 'system'}';
}

class ChatService extends ChangeNotifier {
  final SocketService _socketService;
  final MessageRepository _messageRepository;
  final ShakeDetectionService _shakeDetectionService;
  final ChatNotificationService _notificationService;

  String? _playerName;
  String? _uid;
  String? _userUid;
  String? _currentRoomId;

  String _selectedReaction = '🗣️';
  String lastMessage = '';
  final List<String> reactions = ['😂', '❤️', '😮', '🗣️'];

  final Map<String, List<ChatRoomSummary>> _joinedRoomsByUser = {};
  final Map<String, String> _activeRoomByUser = {};

  Completer<List<ChatRoomSummary>>? _listRoomsCompleter;
  Completer<List<ChatRoomSummary>>? _searchRoomsCompleter;
  Completer<ChatRoomSummary>? _createRoomCompleter;
  Completer<void>? _deleteRoomCompleter;
  final Map<String, Completer<List<Message>>> _historyCompleters = {};

  bool get isConnected => _socketService.isConnected;
  String get selectedReaction => _selectedReaction;
  String? get currentRoomId => _currentRoomId;

  set selectedReaction(String value) {
    _selectedReaction = value;
    notifyListeners();
  }

  ChatService({
    required SocketService socketService,
    required MessageRepository messageRepository,
    required ShakeDetectionService shakeDetectionService,
    required ChatNotificationService notificationService,
  }) : _socketService = socketService,
       _messageRepository = messageRepository,
       _shakeDetectionService = shakeDetectionService,
       _notificationService = notificationService {
    _socketService.addListener(_onSocketConnectionChanged);
    _socketService.onReconnect(_onSocketReconnected);

    _shakeDetectionService.onVerticalShake = _handleVerticalShake;
    _shakeDetectionService.onHorizontalShake = _handleHorizontalShake;
  }

  Future<void> connect(String playerName, {String? uid}) async {
    _playerName = playerName;
    _uid = uid;
    _userUid = uid;
    _notificationService.setCurrentUsername(playerName);

    if (!_socketService.isConnected) {
      await _socketService.connect();
    }

    _setupChatEventListeners();

    if (_userUid != null) {
      _socketService.emit('chat:register-user', {'uid': _userUid});
    }

    notifyListeners();
  }

  Future<void> joinRoom(String roomId) async {
    if (_playerName == null) {
      debugPrint('Cannot join room: not connected');
      return;
    }

    debugPrint('Joining room: $roomId as $_playerName');
    _socketService.emit('chat:join-room', {
      'gameId': roomId,
      'playerName': _playerName,
    });
  }

  Future<void> leaveRoom([String? roomId]) async {
    final targetRoomId = roomId ?? _currentRoomId;
    if (targetRoomId == null) return;

    debugPrint('Leaving room: $targetRoomId');
    _socketService.emit('chat:leave-room', {'gameId': targetRoomId});

    if (_currentRoomId == targetRoomId) {
      _currentRoomId = null;
    }

    notifyListeners();
  }

  Future<void> activateRoom(String roomId) async {
    _currentRoomId = roomId;

    if (_userUid != null) {
      _activeRoomByUser[_userUid!] = roomId;
    }

    _notificationService.setChatOpen(true, roomId: roomId);

    await joinRoom(roomId);
    await getMessageHistory(roomId);
    notifyListeners();
  }

  Future<List<Message>> getMessageHistory(String roomId) async {
    final completer = Completer<List<Message>>();
    _historyCompleters[roomId] = completer;

    _socketService.emit('chat:get-history', {'gameId': roomId});

    try {
      final messages = await completer.future;
      _messageRepository.setMessages(roomId, messages);
      return messages;
    } finally {
      if (identical(_historyCompleters[roomId], completer)) {
        _historyCompleters.remove(roomId);
      }
    }
  }

  Future<void> sendMessage(
    String message, {
    String? roomId,
    bool isLobby = false,
  }) async {
    final targetRoomId = roomId ?? _currentRoomId;
    if (targetRoomId == null) {
      debugPrint('Cannot send message: not in a room');
      return;
    }

    if (!_socketService.isConnected) {
      debugPrint('Cannot send message: not connected');
      return;
    }

    if (_playerName == null) {
      debugPrint('Cannot send message: no player name');
      return;
    }

    final messageData = {
      'author': _playerName,
      'uid': _uid,
      'content': message,
      'timestamp': DateTime.now().toIso8601String(),
      'gameId': targetRoomId,
      'fromLobby': isLobby,
    };

    _socketService.emit('chat:send-message', messageData);
    lastMessage = message;
    notifyListeners();
  }

  Stream<List<Message>> getMessages({required String roomId}) {
    Future.microtask(() {
      _messageRepository.emitCurrentMessages(roomId);
    });
    return _messageRepository.messageStreamForRoom(roomId);
  }

  List<ChatRoomSummary> getJoinedRoomsSnapshot(String uid) {
    return List.unmodifiable(_joinedRoomsByUser[uid] ?? <ChatRoomSummary>[]);
  }

  void setJoinedRooms(String uid, List<ChatRoomSummary> rooms) {
    _joinedRoomsByUser[uid] = List<ChatRoomSummary>.from(rooms);
    notifyListeners();
  }

  String getActiveRoomIdSnapshot(String uid) {
    return _activeRoomByUser[uid] ?? 'global';
  }

  void setActiveRoomId(String uid, String roomId) {
    _activeRoomByUser[uid] = roomId;
    notifyListeners();
  }

  Future<List<ChatRoomSummary>> listRooms() async {
    final completer = Completer<List<ChatRoomSummary>>();
    _listRoomsCompleter = completer;
    _socketService.emit('chat:get-rooms', {});
    return completer.future;
  }

  Future<List<ChatRoomSummary>> searchRooms(String query) async {
    final completer = Completer<List<ChatRoomSummary>>();
    _searchRoomsCompleter = completer;
    _socketService.emit('chat:search-rooms', {'query': query});
    return completer.future;
  }

  Future<ChatRoomSummary> createRoom(String roomName, String ownerName) async {
    final completer = Completer<ChatRoomSummary>();
    _createRoomCompleter = completer;

    _socketService.emit('chat:create-room', {
      'name': roomName,
      'owner': ownerName,
      'ownerUid': _uid,
    });

    return completer.future;
  }

  Future<void> deleteRoom(String roomId, String ownerName) async {
    final completer = Completer<void>();
    _deleteRoomCompleter = completer;

    _socketService.emit('chat:delete-room', {
      'roomId': roomId,
      'owner': ownerName,
      'ownerUid': _uid,
    });

    try {
      await completer.future.timeout(const Duration(seconds: 2));
    } on TimeoutException {
      debugPrint('Delete room timeout fallback for $roomId');
    }
  }

  void startShakeDetection(BuildContext context) {
    _shakeDetectionService.startDetection(context: context);
  }

  void stopShakeDetection() {
    _shakeDetectionService.stopDetection();
  }

  Future<void> refresh() async {
    if (_currentRoomId == null) return;
    await getMessageHistory(_currentRoomId!);
  }

  void _setupChatEventListeners() {
    _socketService.off('chat:history-received');
    _socketService.off('chat:receive-message');
    _socketService.off('chat:rooms-received');
    _socketService.off('chat:room-created');
    _socketService.off('chat:room-deleted');
    _socketService.off('chat:create-room-error');

    _socketService.on('chat:history-received', _handleHistoryReceived);
    _socketService.on('chat:receive-message', _handleNewMessage);
    _socketService.on('chat:rooms-received', _handleRoomsReceived);
    _socketService.on('chat:room-created', _handleRoomCreated);
    _socketService.on('chat:room-deleted', _handleRoomDeleted);
    _socketService.on('chat:create-room-error', _handleCreateRoomError);
  }

  void _handleHistoryReceived(dynamic data) {
    debugPrint('Received chat history');

    if (data is! List) {
      debugPrint('Invalid history data type: ${data.runtimeType}');
      return;
    }

    final messages = data
        .map((messageData) => _messageRepository.parseMessage(messageData))
        .whereType<Message>()
        .toList();

    String roomId = _currentRoomId ?? 'global';
    if (data.isNotEmpty && data.first is Map && data.first['gameId'] != null) {
      roomId = data.first['gameId'].toString();
    }

    final completer = _historyCompleters[roomId];
    if (completer != null && !completer.isCompleted) {
      completer.complete(messages);
    } else {
      _messageRepository.setMessages(roomId, messages);
    }

    notifyListeners();
  }

  void _handleNewMessage(dynamic data) {
    debugPrint('Received new message');

    if (data is! Map) return;

    final roomId = (data['gameId'] ?? 'global').toString();
    final message = _messageRepository.parseMessage(data);

    if (message != null) {
      _messageRepository.addMessage(roomId, message);

      _notificationService.onNewMessage(
        roomId,
        message.senderUsername,
        message.message,
      );

      notifyListeners();
    }
  }

  void _handleRoomsReceived(dynamic data) {
    if (data is! List) return;

    final rooms = data
        .whereType<Map>()
        .map((room) => ChatRoomSummary.fromMap(room))
        .toList();

    final listCompleter = _listRoomsCompleter;
    if (listCompleter != null && !listCompleter.isCompleted) {
      listCompleter.complete(rooms);
    }
    if (identical(_listRoomsCompleter, listCompleter)) {
      _listRoomsCompleter = null;
    }

    final searchCompleter = _searchRoomsCompleter;
    if (searchCompleter != null && !searchCompleter.isCompleted) {
      searchCompleter.complete(rooms);
    }
    if (identical(_searchRoomsCompleter, searchCompleter)) {
      _searchRoomsCompleter = null;
    }
  }

  void _handleRoomCreated(dynamic data) {
    if (data is! Map) return;

    final rawRoom = data['room'] is Map ? data['room'] as Map : data;
    final room = ChatRoomSummary.fromMap(rawRoom);

    final completer = _createRoomCompleter;
    if (completer != null && !completer.isCompleted) {
      completer.complete(room);
    }
    if (identical(_createRoomCompleter, completer)) {
      _createRoomCompleter = null;
    }
  }

  void _handleRoomDeleted(dynamic data) {
    final completer = _deleteRoomCompleter;
    if (completer != null && !completer.isCompleted) {
      completer.complete();
    }
    if (identical(_deleteRoomCompleter, completer)) {
      _deleteRoomCompleter = null;
    }

    if (data is Map) {
      final roomId = data['roomId']?.toString();
      if (roomId != null && roomId.isNotEmpty) {
        _messageRepository.removeRoom(roomId);
      }
    }

    notifyListeners();
  }

  void _handleCreateRoomError(dynamic data) {
    final message = data is Map && data['message'] != null
        ? data['message'].toString()
        : 'Room creation failed';

    final completer = _createRoomCompleter;
    if (completer != null && !completer.isCompleted) {
      completer.completeError(message);
    }
    if (identical(_createRoomCompleter, completer)) {
      _createRoomCompleter = null;
    }
  }

  void _handleVerticalShake() {
    if (_currentRoomId != null) {
      sendMessage(_selectedReaction);
    }
  }

  void _handleHorizontalShake() {
    if (_currentRoomId == null) return;
    if (lastMessage.isEmpty) return;
    sendMessage(lastMessage);
  }

  Future<void> _onSocketReconnected() async {
    _setupChatEventListeners();

    if (_userUid != null) {
      _socketService.emit('chat:register-user', {'uid': _userUid});
    }

    final uid = _userUid;
    if (uid != null) {
      final joinedRooms = _joinedRoomsByUser[uid] ?? <ChatRoomSummary>[];

      for (final room in joinedRooms) {
        _socketService.emit('chat:join-room', {
          'gameId': room.id,
          'playerName': _playerName,
        });
      }

      final activeRoom = _activeRoomByUser[uid];
      if (activeRoom != null) {
        _currentRoomId = activeRoom;
        await getMessageHistory(activeRoom);
      }
    }
  }

  void _onSocketConnectionChanged() {
    notifyListeners();
  }

  @override
  void dispose() {
    _socketService.removeListener(_onSocketConnectionChanged);
    _socketService.offReconnect(_onSocketReconnected);
    _shakeDetectionService.dispose();
    _notificationService.setChatOpen(false);
    super.dispose();
  }
}
