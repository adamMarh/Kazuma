import 'dart:async';

import 'package:flutter/material.dart';
import 'package:socket_io_client/socket_io_client.dart' as io;

class SocketService extends ChangeNotifier {
  io.Socket? _socket;
  bool _isConnected = false;
  final String serverUrl;
  Completer<void>? _connectionCompleter;

  final List<VoidCallback> _reconnectCallbacks = [];
  final Map<String, List<Function(dynamic)>> _eventListeners = {};

  bool get isConnected => _isConnected;
  io.Socket? get socket => _socket;

  SocketService({required this.serverUrl}) : super();

  void onReconnect(VoidCallback callback) {
    _reconnectCallbacks.add(callback);
  }

  void offReconnect(VoidCallback callback) {
    _reconnectCallbacks.remove(callback);
  }

  Future<void> connect() async {
    if (_socket != null && _isConnected) {
      debugPrint('Already connected to socket server');
      return;
    }

    if (_connectionCompleter != null && !_connectionCompleter!.isCompleted) {
      debugPrint('Connection already in progress, waiting...');
      return _connectionCompleter!.future;
    }

    _connectionCompleter = Completer<void>();

    try {
      debugPrint('🔌 Connecting to: $serverUrl');

      _socket = io.io(
        serverUrl,
        io.OptionBuilder()
            .setTransports(['websocket'])
            .disableAutoConnect()
            .enableReconnection()
            .setReconnectionAttempts(double.infinity)
            .setReconnectionDelay(1000)
            .setReconnectionDelayMax(5000)
            .build(),
      );

      for (final entry in _eventListeners.entries) {
        for (final cb in entry.value) {
          _socket!.on(entry.key, cb);
        }
      }

      bool initialConnection = true;

      _socket!.onConnect((_) {
        debugPrint('Socket connected');
        _isConnected = true;
        notifyListeners();

        if (initialConnection) {
          initialConnection = false;

          if (_connectionCompleter != null &&
              !_connectionCompleter!.isCompleted) {
            _connectionCompleter!.complete();
          }
        } else {
          debugPrint('Socket reconnected – firing reconnect callbacks');
          for (final cb in _reconnectCallbacks) {
            cb();
          }
        }
      });

      _socket!.onDisconnect((_) {
        debugPrint('Socket disconnected');
        _isConnected = false;
        notifyListeners();
      });

      _socket!.on('connect_error', (error) {
        debugPrint('Socket connection error: $error');
        _isConnected = false;
        notifyListeners();

        if (!_connectionCompleter!.isCompleted) {
          _connectionCompleter!.completeError(error);
        }
      });

      _socket!.connect();

      await _connectionCompleter!.future.timeout(
        const Duration(seconds: 10),
        onTimeout: () {
          debugPrint('Connection timeout');
          throw TimeoutException('Socket connection timeout');
        },
      );
    } catch (e) {
      debugPrint('Error connecting to socket: $e');
      if (!_connectionCompleter!.isCompleted) {
        _connectionCompleter!.completeError(e);
      }
      rethrow;
    }
  }

  void emit(String event, dynamic data) {
    if (_socket == null || !_isConnected) {
      debugPrint('Cannot emit $event: not connected');
      return;
    }
    _socket!.emit(event, data);
  }

  void emitWithAck(
    String event,
    dynamic data, {
    required Function(dynamic) ack,
  }) {
    if (_socket == null || !_isConnected) {
      debugPrint('Cannot emitWithAck $event: not connected');
      ack(null);
      return;
    }
    _socket!.emitWithAck(event, data, ack: ack);
  }

  void on(String event, Function(dynamic) callback) {
    _eventListeners.putIfAbsent(event, () => []).add(callback);
    _socket?.on(event, callback);
  }

  void off(String event) {
    _eventListeners.remove(event);
    _socket?.off(event);
  }

  void disconnect() {
    if (_socket != null && _isConnected) {
      _socket!.disconnect();
    }
    _isConnected = false;
    notifyListeners();
  }

  @override
  void dispose() {
    if (_socket != null) {
      _socket!.disconnect();
      _socket!.dispose();
      _socket = null;
    }
    _isConnected = false;
    super.dispose();
  }
}
