import 'package:flutter/foundation.dart';

class ServerConfig {
  static const String _prodServerUrl =
      'http://ec2-35-182-240-99.ca-central-1.compute.amazonaws.com:3000';

  static const String _devServerIp = String.fromEnvironment(
    'SERVER_IP',
    defaultValue: '10.0.2.2',
  );

  static const String _devServerPort = '3000';

  static String get _webServerUrl => 'http://localhost:$_devServerPort';

  static String get _devServerUrl =>
      kIsWeb ? _webServerUrl : 'http://$_devServerIp:$_devServerPort';

  static bool get isProduction => kReleaseMode;

  static String get serverUrl => isProduction ? _prodServerUrl : _devServerUrl;

  static String get apiUrl => '$serverUrl/api';

  static String get socketUrl => serverUrl;

  static void printDebugInfo() {
    debugPrint('');
    debugPrint('═══════════════════════════════════════════════');
    debugPrint(' Server Configuration');
    debugPrint('═══════════════════════════════════════════════');
    debugPrint(' Mode:        ${isProduction ? "PRODUCTION" : "DEVELOPMENT"}');
    debugPrint(' Platform:    ${kIsWeb ? "Web" : "Mobile"}');
    debugPrint(' Server URL:  $serverUrl');
    debugPrint(' API URL:     $apiUrl');
    debugPrint(' Socket URL:  $socketUrl');
    debugPrint('═══════════════════════════════════════════════');
    debugPrint('');
  }
}

String getServerUrl() => ServerConfig.socketUrl;

String getApiUrl() => ServerConfig.apiUrl;
