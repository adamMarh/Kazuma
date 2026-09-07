import 'dart:convert';

import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:light_client/config/server_config.dart';
import 'package:light_client/services/auth/auth_service.dart';

class ShopItem {
  final String id;
  final String type;
  final String name;
  final int price;

  ShopItem({
    required this.id,
    required this.type,
    required this.name,
    required this.price,
  });

  factory ShopItem.fromJson(Map<String, dynamic> json) {
    return ShopItem(
      id: json['id'] as String,
      type: json['type'] as String,
      name: json['name'] as String,
      price: (json['price'] as num).toInt(),
    );
  }
}

class Wallet {
  final int balance;
  final List<String> ownedCharacters;
  final List<String> ownedVisuals;
  final List<String> ownedSounds;

  Wallet({
    required this.balance,
    required this.ownedCharacters,
    required this.ownedVisuals,
    required this.ownedSounds,
  });

  factory Wallet.fromJson(Map<String, dynamic> json) {
    final owned = json['owned'] as Map<String, dynamic>? ?? {};
    return Wallet(
      balance: (json['balance'] as num?)?.toInt() ?? 0,
      ownedCharacters: List<String>.from(owned['characters'] ?? []),
      ownedVisuals: List<String>.from(owned['visuals'] ?? []),
      ownedSounds: List<String>.from(owned['sounds'] ?? []),
    );
  }

  List<String> ownedByType(String type) {
    switch (type) {
      case 'characters':
        return ownedCharacters;
      case 'visuals':
        return ownedVisuals;
      case 'sounds':
        return ownedSounds;
      default:
        return [];
    }
  }

  bool ownsItem(String type, String itemId) {
    return ownedByType(type).contains(itemId);
  }
}

const _walletCacheTtl = Duration(minutes: 5);

class _CachedWallet {
  final Wallet? data;
  final DateTime expiresAt;
  _CachedWallet(this.data, this.expiresAt);
  bool get isExpired => DateTime.now().isAfter(expiresAt);
}

class CurrencyService extends ChangeNotifier {
  final AuthService _authService;

  Wallet _wallet = Wallet(
    balance: 0,
    ownedCharacters: [],
    ownedVisuals: [],
    ownedSounds: [],
  );
  Map<String, List<ShopItem>> _catalog = {'characters': [], 'visuals': []};
  bool _loading = false;
  final Map<String, _CachedWallet> _walletByUsernameCache = {};
  final Set<String> _walletByUsernameFetching = {};

  CurrencyService(this._authService);

  Wallet get wallet => _wallet;
  int get balance => _wallet.balance;
  Map<String, List<ShopItem>> get catalog => _catalog;
  bool get loading => _loading;

  Map<String, String> get _headers => {
    'Authorization': 'Bearer ${_authService.idToken}',
    'Content-Type': 'application/json',
  };

  Future<void> refreshWallet() async {
    _loading = true;
    notifyListeners();
    try {
      final response = await http.get(
        Uri.parse('${ServerConfig.apiUrl}/currency/me'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        _wallet = Wallet.fromJson(jsonDecode(response.body));
      } else {
        debugPrint('Failed to fetch wallet: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error fetching wallet: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<void> refreshShop() async {
    _loading = true;
    notifyListeners();
    try {
      final response = await http.get(
        Uri.parse('${ServerConfig.apiUrl}/currency/shop'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final walletData = data['wallet'] as Map<String, dynamic>? ?? {};
        _wallet = Wallet.fromJson(walletData);

        final catalogData = data['catalog'] as Map<String, dynamic>? ?? {};
        _catalog = {};
        catalogData.forEach((key, value) {
          _catalog[key] = (value as List)
              .map((item) => ShopItem.fromJson(item as Map<String, dynamic>))
              .toList();
        });
      } else {
        debugPrint('Failed to fetch shop: ${response.statusCode}');
      }
    } catch (e) {
      debugPrint('Error fetching shop: $e');
    } finally {
      _loading = false;
      notifyListeners();
    }
  }

  Future<Wallet?> getWalletByUsername(String username) async {
    final cached = _walletByUsernameCache[username];
    if (cached != null && !cached.isExpired) {
      return cached.data;
    }
    if (_walletByUsernameFetching.contains(username)) {
      return null;
    }
    _walletByUsernameFetching.add(username);

    try {
      final response = await http.get(
        Uri.parse('${ServerConfig.apiUrl}/currency/user/$username'),
        headers: _headers,
      );
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final walletData = data['wallet'] as Map<String, dynamic>?;
        if (walletData == null) {
          _walletByUsernameCache[username] = _CachedWallet(
            null,
            DateTime.now().add(_walletCacheTtl),
          );
          return null;
        }
        final result = Wallet.fromJson(walletData);
        _walletByUsernameCache[username] = _CachedWallet(
          result,
          DateTime.now().add(_walletCacheTtl),
        );
        return result;
      } else {
        debugPrint(
          'Failed to fetch wallet for $username: ${response.statusCode}',
        );
        return null;
      }
    } catch (e) {
      debugPrint('Error fetching wallet for $username: $e');
      return null;
    } finally {
      _walletByUsernameFetching.remove(username);
    }
  }

  Future<bool> buyItem(ShopItem item) async {
    try {
      final response = await http.post(
        Uri.parse('${ServerConfig.apiUrl}/currency/buy'),
        headers: _headers,
        body: jsonEncode({'type': item.type, 'itemId': item.id}),
      );
      if (response.statusCode == 200 || response.statusCode == 201) {
        _wallet = Wallet.fromJson(jsonDecode(response.body));
        notifyListeners();
        return true;
      } else {
        debugPrint('Buy failed: ${response.statusCode} ${response.body}');
        return false;
      }
    } catch (e) {
      debugPrint('Error buying item: $e');
      return false;
    }
  }

  bool canBuy(ShopItem item) {
    return !_wallet.ownsItem(item.type, item.id) &&
        _wallet.balance >= item.price;
  }
}
