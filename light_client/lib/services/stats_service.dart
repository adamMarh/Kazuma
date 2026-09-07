import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:light_client/config/server_config.dart';

class AccountStats {
  final int gamesPlayedClassic;
  final int gamesPlayedCTF;
  final int gamesWon;
  final int totalGameTimeMs;

  AccountStats({
    required this.gamesPlayedClassic,
    required this.gamesPlayedCTF,
    required this.gamesWon,
    required this.totalGameTimeMs,
  });

  int get totalGamesPlayed => gamesPlayedClassic + gamesPlayedCTF;

  String get averageGameTime {
    if (totalGamesPlayed == 0) return '0:00';
    final avgMs = totalGameTimeMs ~/ totalGamesPlayed;
    final minutes = avgMs ~/ 60000;
    final seconds = (avgMs % 60000) ~/ 1000;
    return '$minutes:${seconds.toString().padLeft(2, '0')}';
  }

  factory AccountStats.fromJson(Map<String, dynamic> json) {
    return AccountStats(
      gamesPlayedClassic: (json['gamesPlayedClassic'] as num?)?.toInt() ?? 0,
      gamesPlayedCTF: (json['gamesPlayedCTF'] as num?)?.toInt() ?? 0,
      gamesWon: (json['gamesWon'] as num?)?.toInt() ?? 0,
      totalGameTimeMs: (json['totalGameTimeMs'] as num?)?.toInt() ?? 0,
    );
  }

  factory AccountStats.empty() => AccountStats(
    gamesPlayedClassic: 0,
    gamesPlayedCTF: 0,
    gamesWon: 0,
    totalGameTimeMs: 0,
  );
}

class StatsService {
  final String _apiUrl = ServerConfig.apiUrl;

  Future<AccountStats> getStats(String idToken) async {
    try {
      final response = await http.get(
        Uri.parse('$_apiUrl/auth/stats'),
        headers: {'Authorization': 'Bearer $idToken'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        return AccountStats.fromJson(data);
      } else {
        debugPrint('Failed to fetch stats: ${response.statusCode}');
        return AccountStats.empty();
      }
    } catch (e) {
      debugPrint('Error fetching stats: $e');
      return AccountStats.empty();
    }
  }
}
