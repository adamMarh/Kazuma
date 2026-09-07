import 'package:flutter/services.dart';

class SoundService {
  static const _channel = MethodChannel('kazuma/sound');

  static Future<bool> _invoke(String method) async {
    try {
      await _channel.invokeMethod<void>(method);
      return true;
    } catch (_) {
      return false;
    }
  }

  static Future<bool> playChime() async {
    return _invoke('playNotificationSound');
  }

  static Future<bool> playAttack() async {
    return _invoke('playAttackSound');
  }

  static Future<bool> playVictory() async {
    return _invoke('playVictorySound');
  }

  static Future<bool> playFlag() async {
    return _invoke('playFlagSound');
  }

  static Future<bool> playDebugRandom() async {
    return _invoke('playDebugRandomSound');
  }
}
