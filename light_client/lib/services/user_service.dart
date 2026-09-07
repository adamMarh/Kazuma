import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:light_client/services/auth/auth_service.dart';

class UserService {
  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final AuthService _authService;
  final Map<String, String?> _avatarByUsernameCache = {};
  final Set<String> _avatarByUsernameFetching = {};
  final Map<String, String?> _avatarByUidCache = {};
  final Set<String> _avatarByUidFetching = {};
  final Map<String, String> _usernameByUidCache = {};

  UserService(this._authService);

  String? getCurrentUserId() {
    return _authService.uid;
  }

  Future<String> getCurrentUsername() async {
    if (_authService.username != null && _authService.username!.isNotEmpty) {
      return _authService.username!;
    }

    final uid = _authService.uid;
    if (uid == null) {
      return 'Guest';
    }

    try {
      final userDoc = await _firestore.collection('users').doc(uid).get();
      return userDoc.data()?['username'] ?? 'Guest';
    } catch (e) {
      debugPrint('Error fetching username: $e');
      return 'Guest';
    }
  }

  Future<String?> getAvatarBase64ByUid(String uid) async {
    if (_avatarByUidCache.containsKey(uid)) {
      return _avatarByUidCache[uid];
    }
    if (_avatarByUidFetching.contains(uid)) {
      return null;
    }
    _avatarByUidFetching.add(uid);

    try {
      final userDoc = await _firestore.collection('users').doc(uid).get();
      final avatarId = userDoc.data()?['avatar'] as String?;
      if (avatarId == null) {
        _avatarByUidCache[uid] = null;
        return null;
      }

      final avatarDoc = await _firestore
          .collection('avatars')
          .doc(avatarId)
          .get();
      final result = avatarDoc.data()?['imageBase64'] as String?;
      _avatarByUidCache[uid] = result;
      return result;
    } catch (e) {
      debugPrint('Error fetching avatar base64 for $uid: $e');
      return null;
    } finally {
      _avatarByUidFetching.remove(uid);
    }
  }

  Future<String?> getAvatarBase64ByUsername(String username) async {
    final trimmedUsername = username.trim();
    if (trimmedUsername.isEmpty || trimmedUsername.toLowerCase() == 'unknown') {
      return null;
    }

    if (_avatarByUsernameCache.containsKey(trimmedUsername)) {
      return _avatarByUsernameCache[trimmedUsername];
    }

    if (_avatarByUsernameFetching.contains(trimmedUsername)) {
      return null;
    }
    _avatarByUsernameFetching.add(trimmedUsername);

    try {
      final userQuery = await _firestore
          .collection('users')
          .where('username', isEqualTo: trimmedUsername)
          .limit(1)
          .get();

      if (userQuery.docs.isEmpty) return null;

      final avatarId = userQuery.docs.first.data()['avatar'] as String?;
      if (avatarId == null || avatarId.isEmpty) return null;

      final avatarDoc = await _firestore
          .collection('avatars')
          .doc(avatarId)
          .get();
      final result = avatarDoc.data()?['imageBase64'] as String?;
      _avatarByUsernameCache[trimmedUsername] = result;
      return result;
    } catch (e) {
      debugPrint('Error fetching avatar base64 for username $username: $e');
      return null;
    } finally {
      _avatarByUsernameFetching.remove(trimmedUsername);
    }
  }

  Future<String> getUsernameById(String uid) async {
    if (_usernameByUidCache.containsKey(uid)) {
      return _usernameByUidCache[uid]!;
    }

    try {
      final userDoc = await _firestore.collection('users').doc(uid).get();
      final username = userDoc.data()?['username'] ?? 'Unknown';
      _usernameByUidCache[uid] = username;
      return username;
    } catch (e) {
      debugPrint('Error fetching username for $uid: $e');
      return 'Unknown';
    }
  }
}
