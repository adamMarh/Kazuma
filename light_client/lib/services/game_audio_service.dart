import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';
import 'package:light_client/services/sound_service.dart';

class GameAudioService {
  static Future<void> playOneShot(
    String assetPath, {
    double volume = 1.0,
  }) async {
    try {
      bool ok = false;

      if (assetPath.contains('attack.wav')) {
        ok = await SoundService.playAttack();
      } else if (assetPath.contains('victory.wav')) {
        ok = await SoundService.playVictory();
      } else if (assetPath.contains('flag.wav')) {
        ok = await SoundService.playFlag();
      } else {
        ok = await SoundService.playChime();
      }

      if (ok) return;

      final chimeOk = await SoundService.playChime();
      if (chimeOk) return;

      await SystemSound.play(SystemSoundType.click);
    } catch (e) {
      debugPrint('Sound fallback failed for $assetPath - $e');
    }
  }
}
