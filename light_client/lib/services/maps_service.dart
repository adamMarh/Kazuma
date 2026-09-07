import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:light_client/config/server_config.dart';
import 'package:light_client/models/game_models.dart';

class MapsService extends ChangeNotifier {
  List<GameMap> _maps = [];
  bool _isLoading = false;
  String? _errorMessage;

  List<GameMap> get maps => List.unmodifiable(_maps);
  bool get isLoading => _isLoading;
  String? get errorMessage => _errorMessage;

  Future<void> fetchMapsForGameCreation(String username) async {
    _isLoading = true;
    _errorMessage = null;
    notifyListeners();

    try {
      final uri = Uri.parse(
        '${ServerConfig.apiUrl}/maps?filter=gameCreation&username=${Uri.encodeComponent(username)}',
      );
      final response = await http.get(uri).timeout(const Duration(seconds: 10));

      if (response.statusCode == 200) {
        final List<dynamic> data = jsonDecode(response.body) as List<dynamic>;
        _maps = data
            .whereType<Map<String, dynamic>>()
            .map((m) => GameMap.fromMap(m))
            .toList();
      } else {
        _errorMessage = 'Erreur lors du chargement des cartes.';
      }
    } catch (e) {
      _errorMessage = 'Impossible de charger les cartes.';
      debugPrint('fetchMapsForGameCreation error: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> checkGameAvailability(String mapId, String username) async {
    final uri = Uri.parse(
      '${ServerConfig.apiUrl}/maps/$mapId/available?username=${Uri.encodeComponent(username)}',
    );
    final response = await http.get(uri).timeout(const Duration(seconds: 10));
    if (response.statusCode == 200) {
      final data = jsonDecode(response.body);
      return data == true;
    }
    return false;
  }
}
