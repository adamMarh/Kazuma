import 'dart:async';
import 'dart:math';

import 'package:flutter/material.dart';
import 'package:sensors_plus/sensors_plus.dart';

class ShakeDetectionService {
  StreamSubscription<AccelerometerEvent>? _accelSubscription;
  final double shakeThreshold;
  DateTime? _lastShakeTime;
  final Duration cooldown;

  Function()? onVerticalShake;
  Function()? onHorizontalShake;

  ShakeDetectionService({
    this.shakeThreshold = 1.7,
    this.cooldown = const Duration(seconds: 2),
  });

  int _subscriberCount = 0;

  // Peak-tracking window state
  AccelerometerEvent? _peakEvent;
  double _peakMagnitude = 0;
  Timer? _windowTimer;

  void startDetection({BuildContext? context}) {
    _subscriberCount++;
    if (_subscriberCount > 1 && _accelSubscription != null) return;

    _accelSubscription?.cancel();
    _accelSubscription = accelerometerEventStream().listen((event) {
      try {
        final double magnitude =
            sqrt(event.x * event.x + event.y * event.y + event.z * event.z) -
            9.81;

        if (magnitude <= shakeThreshold) return;

        // Check cooldown before opening a window
        final now = DateTime.now();
        if (_lastShakeTime != null &&
            now.difference(_lastShakeTime!) < cooldown) {
          return;
        }

        // Track the peak event within the collection window
        if (magnitude > _peakMagnitude) {
          _peakMagnitude = magnitude;
          _peakEvent = event;
        }

        // Open a window if not already open — direction is decided when it closes
        if (_windowTimer == null || !_windowTimer!.isActive) {
          _windowTimer = Timer(const Duration(milliseconds: 300), () {
            final peak = _peakEvent;
            _peakEvent = null;
            _peakMagnitude = 0;

            if (peak == null || _subscriberCount <= 0) return;

            _lastShakeTime = DateTime.now();

            final double absX = peak.x.abs();
            final double absY = peak.y.abs();
            final double absZ = peak.z.abs();

            debugPrint('Peak axes → absX: $absX | absY: $absY | absZ: $absZ');

            // Tablet locked to landscape (portrait-native hardware):
            // X = vertical (up/down), Y = horizontal (left/right)
            final double verticalAxis = absX;
            final double horizontalAxis = absY;

            if (verticalAxis > horizontalAxis && verticalAxis > absZ) {
              debugPrint('→ VERTICAL shake fired');
              onVerticalShake?.call();
            } else if (horizontalAxis > verticalAxis && horizontalAxis > absZ) {
              debugPrint('→ HORIZONTAL shake fired');
              onHorizontalShake?.call();
            } else {
              debugPrint(
                '→ No direction matched (Z dominant or axes too close)',
              );
            }
          });
        }
      } catch (e) {
        debugPrint('Shake detection error: $e');
      }
    });
  }

  void stopDetection() {
    _subscriberCount = (_subscriberCount - 1).clamp(0, 999);

    if (_subscriberCount == 0) {
      _accelSubscription?.cancel();
      _accelSubscription = null;
      _windowTimer?.cancel();
      _windowTimer = null;
      _peakEvent = null;
      _peakMagnitude = 0;
    }
  }

  void dispose() {
    stopDetection();
  }
}
