import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';

void initForegroundTask() {
  FlutterForegroundTask.init(
    androidNotificationOptions: AndroidNotificationOptions(
      channelId: 'chat_foreground_service',
      channelName: 'Service de chat en arrière-plan',
      channelDescription:
          'Maintient la connexion au chat lorsque l\'application est en arrière-plan.',
      channelImportance: NotificationChannelImportance.LOW,
      priority: NotificationPriority.LOW,
      playSound: false,
      showWhen: false,
      enableVibration: false,
    ),
    iosNotificationOptions: const IOSNotificationOptions(
      showNotification: false,
      playSound: false,
    ),
    foregroundTaskOptions: ForegroundTaskOptions(
      eventAction: ForegroundTaskEventAction.nothing(),
      autoRunOnBoot: false,
      autoRunOnMyPackageReplaced: false,
      allowWakeLock: true,
      allowWifiLock: true,
    ),
  );
}

Future<void> startForegroundService() async {
  if (await FlutterForegroundTask.isRunningService) {
    debugPrint('Foreground service already running');
    return;
  }
  debugPrint('Starting foreground service');
  await FlutterForegroundTask.startService(
    notificationTitle: 'Kazuma – Chat actif',
    notificationText: 'Connexion au chat maintenue en arrière-plan.',
    callback: _startTaskCallback,
  );
}

Future<void> stopForegroundService() async {
  if (!await FlutterForegroundTask.isRunningService) return;
  debugPrint('Stopping foreground service');
  await FlutterForegroundTask.stopService();
}

@pragma('vm:entry-point')
void _startTaskCallback() {
  FlutterForegroundTask.setTaskHandler(_ChatKeepAliveTaskHandler());
}

class _ChatKeepAliveTaskHandler extends TaskHandler {
  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    debugPrint('Foreground task started');
  }

  @override
  void onRepeatEvent(DateTime timestamp) {}

  @override
  Future<void> onDestroy(DateTime timestamp) async {
    debugPrint('Foreground task destroyed');
  }
}
