import 'dart:async';

import 'package:flutter/material.dart';
import 'package:light_client/components/message.dart';

class MessageRepository extends ChangeNotifier {
  final Map<String, List<Message>> _messagesByRoom = {};
  final Map<String, StreamController<List<Message>>> _roomControllers = {};

  List<Message> messagesForRoom(String roomId) {
    return List.unmodifiable(_messagesByRoom[roomId] ?? <Message>[]);
  }

  Stream<List<Message>> messageStreamForRoom(String roomId) {
    _roomControllers.putIfAbsent(
      roomId,
      () => StreamController<List<Message>>.broadcast(),
    );
    return _roomControllers[roomId]!.stream;
  }

  Message? parseMessage(dynamic data) {
    try {
      if (data is! Map) {
        debugPrint('Invalid message payload type: ${data.runtimeType}');
        return null;
      }

      final timestamp = _parseTimestamp(data['timestamp']);

      final senderUsername =
          (data['author'] ?? data['senderUsername'] ?? 'Unknown').toString();
      final senderId = (data['uid'] ?? data['senderId'] ?? '').toString();

      return Message(
        senderId: senderId,
        senderUsername: senderUsername,
        message: (data['content'] ?? '').toString(),
        timestamp: timestamp,
      );
    } catch (e) {
      debugPrint('Error parsing message: $e');
      return null;
    }
  }

  DateTime _parseTimestamp(dynamic raw) {
    if (raw is String) {
      final parsed = DateTime.tryParse(raw);
      if (parsed != null) {
        return parsed.isUtc ? parsed.toLocal() : parsed;
      }
      return DateTime.now();
    }

    if (raw is int) {
      final millis = raw < 1000000000000 ? raw * 1000 : raw;
      return DateTime.fromMillisecondsSinceEpoch(millis, isUtc: true).toLocal();
    }

    if (raw is Map && raw[r'$date'] != null) {
      final dateField = raw[r'$date'];
      if (dateField is String) {
        final parsed = DateTime.tryParse(dateField);
        if (parsed != null) {
          return parsed.isUtc ? parsed.toLocal() : parsed;
        }
      }
      if (dateField is int) {
        final millis = dateField < 1000000000000 ? dateField * 1000 : dateField;
        return DateTime.fromMillisecondsSinceEpoch(
          millis,
          isUtc: true,
        ).toLocal();
      }
    }

    return DateTime.now();
  }

  void addMessage(String roomId, Message message) {
    final roomMessages = _messagesByRoom.putIfAbsent(roomId, () => <Message>[]);
    roomMessages.add(message);
    _sortAndNotify(roomId);
  }

  void setMessages(String roomId, List<Message> messages) {
    _messagesByRoom[roomId] = List<Message>.from(messages)
      ..sort((a, b) => a.timestamp.compareTo(b.timestamp));
    _emitRoom(roomId);
    notifyListeners();
  }

  void addMessages(String roomId, List<Message> messages) {
    final roomMessages = _messagesByRoom.putIfAbsent(roomId, () => <Message>[]);
    roomMessages.addAll(messages);
    _sortAndNotify(roomId);
  }

  void clearMessages(String roomId) {
    _messagesByRoom[roomId] = <Message>[];
    _emitRoom(roomId);
    notifyListeners();
  }

  void clearAllMessages() {
    _messagesByRoom.clear();
    for (final controller in _roomControllers.values) {
      controller.add(<Message>[]);
    }
    notifyListeners();
  }

  void emitCurrentMessages(String roomId) {
    _emitRoom(roomId);
  }

  void removeRoom(String roomId) {
    _messagesByRoom.remove(roomId);
    _roomControllers[roomId]?.add(<Message>[]);
    notifyListeners();
  }

  void _sortAndNotify(String roomId) {
    final roomMessages = _messagesByRoom.putIfAbsent(roomId, () => <Message>[]);
    roomMessages.sort((a, b) => a.timestamp.compareTo(b.timestamp));
    _emitRoom(roomId);
    notifyListeners();
  }

  void _emitRoom(String roomId) {
    _roomControllers.putIfAbsent(
      roomId,
      () => StreamController<List<Message>>.broadcast(),
    );
    _roomControllers[roomId]!.add(
      List<Message>.from(_messagesByRoom[roomId] ?? <Message>[]),
    );
  }

  @override
  void dispose() {
    for (final controller in _roomControllers.values) {
      controller.close();
    }
    super.dispose();
  }
}
