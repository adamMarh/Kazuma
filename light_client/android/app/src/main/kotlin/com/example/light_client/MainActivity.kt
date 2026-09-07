package com.example.light_client

import android.media.MediaPlayer
import android.media.AudioManager
import android.media.RingtoneManager
import android.media.ToneGenerator
import io.flutter.embedding.android.FlutterActivity
import io.flutter.embedding.engine.FlutterEngine
import io.flutter.plugin.common.MethodChannel
import kotlin.random.Random

class MainActivity : FlutterActivity() {
    companion object {
        private const val CHANNEL = "kazuma/sound"
    }

    override fun configureFlutterEngine(flutterEngine: FlutterEngine) {
        super.configureFlutterEngine(flutterEngine)

        MethodChannel(
            flutterEngine.dartExecutor.binaryMessenger,
            CHANNEL,
        ).setMethodCallHandler { call, result ->
            when (call.method) {
                "playAttackSound" -> playRawSound(R.raw.attack, result)
                "playVictorySound" -> playRawSound(R.raw.victory, result)
                "playFlagSound" -> playRawSound(R.raw.flag, result)
                "playDebugRandomSound" -> playDebugRandomSound(result)
                "playNotificationSound" -> {
                    try {
                        val uri = RingtoneManager.getDefaultUri(
                            RingtoneManager.TYPE_NOTIFICATION,
                        )
                        val ringtone = RingtoneManager.getRingtone(applicationContext, uri)
                        ringtone.play()
                        result.success(null)
                    } catch (e: Exception) {
                        result.error("SOUND_ERROR", e.message, null)
                    }
                }
                else -> result.notImplemented()
            }
        }
    }

    private fun playRawSound(resId: Int, result: MethodChannel.Result) {
        try {
            val mediaPlayer = MediaPlayer.create(applicationContext, resId)
            if (mediaPlayer == null) {
                result.error("SOUND_ERROR", "MediaPlayer returned null", null)
                return
            }

            mediaPlayer.setOnCompletionListener { player ->
                player.release()
            }
            mediaPlayer.setOnErrorListener { player, _, _ ->
                player.release()
                true
            }
            mediaPlayer.start()
            result.success(null)
        } catch (e: Exception) {
            result.error("SOUND_ERROR", e.message, null)
        }
    }

    private fun playDebugRandomSound(result: MethodChannel.Result) {
        try {
            val tones = listOf(
                ToneGenerator.TONE_PROP_BEEP,
                ToneGenerator.TONE_PROP_BEEP2,
                ToneGenerator.TONE_PROP_PROMPT,
                ToneGenerator.TONE_CDMA_ALERT_CALL_GUARD,
                ToneGenerator.TONE_CDMA_ABBR_ALERT,
            )
            val randomTone = tones[Random.nextInt(tones.size)]

            val toneGenerator = ToneGenerator(AudioManager.STREAM_MUSIC, 100)
            toneGenerator.startTone(randomTone, 250)

            result.success(null)
        } catch (e: Exception) {
            result.error("SOUND_ERROR", e.message, null)
        }
    }
}
