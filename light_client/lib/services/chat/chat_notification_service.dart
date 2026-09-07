import 'package:flutter/material.dart';
import 'package:flutter/scheduler.dart' hide Priority;
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:light_client/services/sound_service.dart';

class ChatNotificationService extends ChangeNotifier {
  final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();

  int _nextNotificationId = 0;

  final Map<String, int> _unreadCounts = {};

  final Set<String> _roomsWithUnread = {};

  AppLifecycleState _appLifecycleState = AppLifecycleState.resumed;

  bool _isChatOpen = false;

  String? _currentlyViewingRoom;

  String? _currentUsername;

  bool _isMuted = false;

  bool get hasUnreadMessages => _roomsWithUnread.isNotEmpty;

  int get totalUnreadCount =>
      _unreadCounts.values.fold(0, (sum, count) => sum + count);

  Set<String> get roomsWithUnread => Set.unmodifiable(_roomsWithUnread);

  bool get isChatOpen => _isChatOpen;

  int unreadCountFor(String roomId) => _unreadCounts[roomId] ?? 0;

  ChatNotificationService() {
    _initNotifications();
  }

  Future<void> _initNotifications() async {
    const androidSettings = AndroidInitializationSettings(
      '@mipmap/ic_launcher',
    );
    const iosSettings = DarwinInitializationSettings(
      requestAlertPermission: true,
      requestBadgePermission: true,
      requestSoundPermission: true,
    );
    const initSettings = InitializationSettings(
      android: androidSettings,
      iOS: iosSettings,
    );
    await _localNotifications.initialize(initSettings);
  }

  void setCurrentUsername(String username) {
    _currentUsername = username;
  }

  void _safeNotifyListeners() {
    final phase = SchedulerBinding.instance.schedulerPhase;

    if (phase == SchedulerPhase.idle ||
        phase == SchedulerPhase.postFrameCallbacks) {
      notifyListeners();
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      notifyListeners();
    });
  }

  void setAppLifecycleState(AppLifecycleState state) {
    _appLifecycleState = state;
  }

  void setMuted(bool isMuted) {
    _isMuted = isMuted;
  }

  void setChatOpen(bool isOpen, {String? roomId, bool notify = true}) {
    _isChatOpen = isOpen;
    _currentlyViewingRoom = isOpen ? roomId : null;

    if (isOpen && roomId != null) {
      markRoomAsRead(roomId);
      return;
    }

    if (notify) {
      _safeNotifyListeners();
    }
  }

  void setChatOpenSilently(bool isOpen, {String? roomId}) {
    _isChatOpen = isOpen;
    _currentlyViewingRoom = isOpen ? roomId : null;

    if (isOpen && roomId != null) {
      _unreadCounts.remove(roomId);
      _roomsWithUnread.remove(roomId);
    }
  }

  Future<void> onNewMessage(
    String roomId,
    String senderUsername,
    String messageContent,
  ) async {
    if (senderUsername == _currentUsername) return;
    if (_isMuted) return;

    final bool isViewingThisRoom =
        _isChatOpen && _currentlyViewingRoom == roomId;
    if (!isViewingThisRoom) {
      _unreadCounts[roomId] = (_unreadCounts[roomId] ?? 0) + 1;
      _roomsWithUnread.add(roomId);
      notifyListeners();
    }

    final bool isInBackground = _appLifecycleState != AppLifecycleState.resumed;

    if (isInBackground) {
      await _showPushNotification(senderUsername, messageContent, roomId);
    } else {
      await SoundService.playChime();
    }
  }

  void markRoomAsRead(String roomId) {
    _unreadCounts.remove(roomId);
    _roomsWithUnread.remove(roomId);
    notifyListeners();
  }

  void markAllAsRead() {
    _unreadCounts.clear();
    _roomsWithUnread.clear();
    notifyListeners();
  }

  Future<void> _showPushNotification(
    String sender,
    String message,
    String roomId,
  ) async {
    try {
      final id = _nextNotificationId++;

      await _localNotifications.show(
        id,
        'Nouveau message de $sender',
        message,
        const NotificationDetails(
          android: AndroidNotificationDetails(
            'chat_messages',
            'Messages de chat',
            channelDescription:
                'Notifications pour les nouveaux messages de chat',
            importance: Importance.high,
            priority: Priority.high,
            playSound: true,
          ),
          iOS: DarwinNotificationDetails(
            presentAlert: true,
            presentBadge: true,
            presentSound: true,
          ),
        ),
      );
    } catch (e) {
      debugPrint('Error showing push notification: $e');
    }
  }
}
