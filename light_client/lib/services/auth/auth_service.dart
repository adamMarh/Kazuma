import 'dart:async';
import 'dart:convert';
import 'dart:io';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:light_client/config/server_config.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'auth_response.dart';

class AuthService extends ChangeNotifier {
  String? _idToken;
  String? _uid;
  String? _email;
  String? _username;
  String? _avatar;

  bool _isOffline = false;

  String serverUrl = ServerConfig.apiUrl;

  String? get idToken => _idToken;
  String? get uid => _uid;
  String? get email => _email;
  String? get username => _username;
  String? get avatar => _avatar;
  bool get isAuthenticated => _idToken != null;
  bool get isOffline => _isOffline;

  static const String _keyIdToken = 'id_token';
  static const String _keyUid = 'uid';
  static const String _keyEmail = 'email';
  static const String _keyUsername = 'username';
  static const String _keyAvatar = 'avatar';

  Future<void> initialize() async {
    debugPrint('Initializing AuthService...');

    final prefs = await SharedPreferences.getInstance();
    _idToken = prefs.getString(_keyIdToken);
    _uid = prefs.getString(_keyUid);
    _email = prefs.getString(_keyEmail);
    _username = prefs.getString(_keyUsername);
    _avatar = prefs.getString(_keyAvatar);

    debugPrint('Token found in prefs: ${_idToken != null}');

    final firebaseUser = FirebaseAuth.instance.currentUser;

    if (firebaseUser != null) {
      debugPrint(
        'Firebase user present (${firebaseUser.uid}), refreshing ID token...',
      );
      final refreshed = await _silentRefreshFromFirebase(firebaseUser, prefs);

      if (refreshed) {
        debugPrint('ID token refreshed from Firebase successfully');
      } else {
        debugPrint('Firebase token refresh failed — will rely on stored token');
      }

      if (_idToken != null) {
        debugPrint('Verifying token with backend...');
        final isValid = await _verifyStoredToken();
        if (!isValid && !_isOffline) {
          debugPrint('Backend rejected token, clearing auth');
          await _clearStoredAuth();
        } else if (_isOffline) {
          debugPrint('Network unreachable — keeping user logged in locally');
        } else {
          debugPrint('Token valid, user authenticated');
        }
      }
    } else {
      if (_idToken != null) {
        debugPrint(
          'No Firebase user found but stored token exists — clearing stale auth',
        );
        await _clearStoredAuth();
      } else {
        debugPrint('No Firebase user and no stored token — unauthenticated');
      }
    }

    notifyListeners();
  }

  Future<bool> _silentRefreshFromFirebase(
    User firebaseUser,
    SharedPreferences prefs,
  ) async {
    try {
      final freshToken = await firebaseUser
          .getIdToken(true)
          .timeout(const Duration(seconds: 10));

      if (freshToken == null) return false;

      _idToken = freshToken;
      _uid = firebaseUser.uid;
      _email ??= firebaseUser.email;

      await prefs.setString(_keyIdToken, freshToken);
      await prefs.setString(_keyUid, firebaseUser.uid);
      if (firebaseUser.email != null) {
        await prefs.setString(_keyEmail, firebaseUser.email!);
      }

      debugPrint('Silent Firebase refresh succeeded');
      return true;
    } on TimeoutException {
      debugPrint('⚠️ Firebase token refresh timed out');
      return false;
    } catch (e) {
      debugPrint('⚠️ Firebase token refresh error: $e');
      return false;
    }
  }

  Future<void> signIn(String identifier, String password) async {
    final url = '$serverUrl/auth/signin';

    try {
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({'identifier': identifier, 'password': password}),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final authResp = AuthResponse.fromJson(data);
        await _saveAuthData(authResp);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
          error['message'] ?? 'Échec de connexion (${response.statusCode})',
        );
      }
    } catch (e) {
      debugPrint('Exception: $e');
      rethrow;
    }
  }

  Future<void> createUserWithEmailAndPassword(
    String email,
    String password,
    String username, {
    String? avatar,
  }) async {
    final url = '$serverUrl/auth/signup';
    try {
      final payload = <String, dynamic>{
        'email': email,
        'password': password,
        'username': username,
      };
      if (avatar != null) payload['avatar'] = avatar;
      final response = await http.post(
        Uri.parse(url),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        final authResp = AuthResponse.fromJson(data);
        await _saveAuthData(authResp, avatarOverride: avatar);
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
          error['message'] ?? "Échec d'inscription (${response.statusCode})",
        );
      }
    } catch (e) {
      debugPrint('Exception: $e');
      rethrow;
    }
  }

  Future<void> updateProfile(
    String username,
    String email,
    String? avatar,
  ) async {
    if (_idToken == null) throw Exception('Non authentifié');

    final url = '$serverUrl/auth/update-profile';
    final payload = <String, dynamic>{'username': username, 'email': email};
    if (avatar != null) {
      payload['avatar'] = avatar;
    }

    try {
      final response = await http.patch(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $_idToken',
        },
        body: jsonEncode(payload),
      );

      if (response.statusCode == 200 || response.statusCode == 201) {
        _username = username;
        _email = email;
        if (avatar != null) _avatar = avatar;

        final prefs = await SharedPreferences.getInstance();
        await prefs.setString(_keyUsername, username);
        await prefs.setString(_keyEmail, email);
        if (avatar != null) await prefs.setString(_keyAvatar, avatar);

        notifyListeners();
      } else {
        final error = jsonDecode(response.body);
        throw Exception(
          error['message'] ??
              'Échec de la mise à jour (${response.statusCode})',
        );
      }
    } catch (e) {
      debugPrint('Exception updateProfile: $e');
      rethrow;
    }
  }

  Future<void> signOut() async {
    if (_idToken != null) {
      try {
        await http.post(
          Uri.parse('$serverUrl/auth/signout'),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $_idToken',
          },
        );
      } catch (e) {
        debugPrint('Erreur signout serveur: $e');
      }
    }

    await _clearStoredAuth();
    notifyListeners();
  }

  Future<void> clearPersistedAuth() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyIdToken);
    await prefs.remove(_keyUid);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyUsername);
  }

  Future<void> persistCurrentAuth() async {
    if (_idToken == null) return;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyIdToken, _idToken!);
    if (_uid != null) await prefs.setString(_keyUid, _uid!);
    if (_email != null) await prefs.setString(_keyEmail, _email!);
    if (_username != null) await prefs.setString(_keyUsername, _username!);
  }

  Future<void> restoreSession() async {
    if (_idToken == null) return;

    // Try to refresh the token via Firebase if the user object is available.
    // On some Android devices / OEMs the Firebase user may still be null
    // right after resume — that is fine, we just skip the refresh and use the
    // in-memory token we already have.
    final firebaseUser = FirebaseAuth.instance.currentUser;
    if (firebaseUser != null) {
      final prefs = await SharedPreferences.getInstance();
      await _silentRefreshFromFirebase(firebaseUser, prefs);
    } else {
      debugPrint('Firebase user not yet available — using existing token');
    }

    try {
      final response = await http
          .get(
            Uri.parse('$serverUrl/auth/me'),
            headers: {'Authorization': 'Bearer $_idToken'},
          )
          .timeout(const Duration(seconds: 8));

      if (response.statusCode == 200) {
        debugPrint('Session restaurée');
        _isOffline = false;
      } else if (response.statusCode == 401 || response.statusCode == 403) {
        debugPrint('Session invalide (${response.statusCode}), déconnexion');
        await signOut();
      }
    } on SocketException {
      debugPrint('⚠️ Réseau indisponible — session conservée localement');
      _isOffline = true;
    } on TimeoutException {
      debugPrint(
        '⚠️ Restauration session timeout — session conservée localement',
      );
      _isOffline = true;
    } catch (e) {
      debugPrint('⚠️ Erreur restoration session (session conservée): $e');
      _isOffline = true;
    }
  }

  Future<void> _saveAuthData(
    AuthResponse authResp, {
    String? avatarOverride,
  }) async {
    _idToken = authResp.idToken;
    _uid = authResp.uid;
    _email = authResp.email;
    _username = authResp.username;
    _avatar = avatarOverride ?? authResp.avatar ?? _avatar;

    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyIdToken, authResp.idToken);
    await prefs.setString(_keyUid, authResp.uid);
    await prefs.setString(_keyEmail, authResp.email);
    await prefs.setString(_keyUsername, authResp.username);
    if (_avatar != null) await prefs.setString(_keyAvatar, _avatar!);

    notifyListeners();
  }

  Future<void> _clearStoredAuth() async {
    _idToken = null;
    _uid = null;
    _email = null;
    _username = null;
    _avatar = null;

    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyIdToken);
    await prefs.remove(_keyUid);
    await prefs.remove(_keyEmail);
    await prefs.remove(_keyUsername);
    await prefs.remove(_keyAvatar);
  }

  /// Verify the stored token against the NestJS backend.
  ///
  /// Returns `true` for:
  ///  - HTTP 200 (valid token)
  ///  - Any network/timeout error (fail-open: cannot distinguish from
  ///    temporary outage — sets [_isOffline] = true)
  ///
  /// Returns `false` only when the backend explicitly rejects the token
  /// (HTTP 401 / 403), meaning it is definitively invalid or revoked.
  Future<bool> _verifyStoredToken() async {
    if (_idToken == null) return false;

    try {
      final response = await http
          .get(
            Uri.parse('$serverUrl/auth/me'),
            headers: {'Authorization': 'Bearer $_idToken'},
          )
          .timeout(const Duration(seconds: 8));

      _isOffline = false;

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        _uid = data['uid'] as String?;
        _email = data['email'] as String?;
        _username = data['username'] as String?;
        if (data['avatar'] != null) _avatar = data['avatar'] as String?;
        return true;
      }

      debugPrint('⚠️ Backend rejected token (HTTP ${response.statusCode})');
      return false;
    } on SocketException catch (e) {
      debugPrint('⚠️ Network unreachable during token verification: $e');
      _isOffline = true;
      return true;
    } on TimeoutException {
      debugPrint('⚠️ Token verification timed out — keeping user logged in');
      _isOffline = true;
      return true;
    } catch (e) {
      debugPrint('Unexpected token verification error: $e');
      _isOffline = true;
      return true;
    }
  }

  Future<void> deleteAccount() async {
    if (_idToken == null) {
      throw Exception('Utilisateur non connectÃ©.');
    }

    final url = Uri.parse('$serverUrl/auth/delete-account');

    final response = await http.post(
      url,
      headers: {'Authorization': 'Bearer $_idToken'},
    );

    if (response.statusCode != 200 && response.statusCode != 201) {
      throw Exception('Erreur lors de la suppression du compte.');
    }

    try {
      await FirebaseAuth.instance.currentUser?.delete();
    } catch (e) {
      debugPrint('Erreur locale firebase delete (ignorable) : $e');
    }

    await signOut();
  }
}
