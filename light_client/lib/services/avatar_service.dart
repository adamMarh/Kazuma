import 'dart:convert';
import 'dart:io';
import 'dart:ui' as ui;

import 'package:cloud_firestore/cloud_firestore.dart';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:light_client/config/server_config.dart';

class AvatarDoc {
  final String id;
  final String name;
  final String imageBase64;
  final String owner;

  AvatarDoc({
    required this.id,
    required this.name,
    required this.imageBase64,
    required this.owner,
  });

  factory AvatarDoc.fromFirestore(String id, Map<String, dynamic> data) {
    return AvatarDoc(
      id: id,
      name: data['name'] ?? '',
      imageBase64: data['imageBase64'] ?? '',
      owner: data['owner'] ?? 'global',
    );
  }

  factory AvatarDoc.fromJson(Map<String, dynamic> json) {
    return AvatarDoc(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      imageBase64: json['imageBase64'] ?? '',
      owner: json['owner'] ?? 'global',
    );
  }
}

class AvatarService {
  static const int _maxImageDimension = 400;

  final FirebaseFirestore _firestore = FirebaseFirestore.instance;
  final Map<String, AvatarDoc> _cache = {};

  Future<List<AvatarDoc>> getAvailableAvatars(String uid) async {
    try {
      final snapshot = await _firestore
          .collection('avatars')
          .where('owner', whereIn: ['global', uid])
          .get();
      return snapshot.docs
          .map((doc) => AvatarDoc.fromFirestore(doc.id, doc.data()))
          .toList();
    } catch (e) {
      debugPrint('Error fetching avatars: $e');
      return [];
    }
  }

  Future<AvatarDoc?> getAvatarById(String avatarId) async {
    if (_cache.containsKey(avatarId)) return _cache[avatarId];
    try {
      final doc = await _firestore.collection('avatars').doc(avatarId).get();
      if (!doc.exists) return null;
      final avatar = AvatarDoc.fromFirestore(doc.id, doc.data()!);
      _cache[avatarId] = avatar;
      return avatar;
    } catch (e) {
      debugPrint('Error fetching avatar $avatarId: $e');
      return null;
    }
  }

  Future<String> compressImageFile(File file) async {
    final bytes = await file.readAsBytes();
    final codec = await ui.instantiateImageCodec(bytes);
    final frame = await codec.getNextFrame();
    final image = frame.image;

    int width = image.width;
    int height = image.height;

    if (width > height) {
      if (width > _maxImageDimension) {
        height = (height * _maxImageDimension / width).round();
        width = _maxImageDimension;
      }
    } else if (height > _maxImageDimension) {
      width = (width * _maxImageDimension / height).round();
      height = _maxImageDimension;
    }

    final recorder = ui.PictureRecorder();
    final canvas = Canvas(
      recorder,
      Rect.fromLTWH(0, 0, width.toDouble(), height.toDouble()),
    );
    canvas.drawImageRect(
      image,
      Rect.fromLTWH(0, 0, image.width.toDouble(), image.height.toDouble()),
      Rect.fromLTWH(0, 0, width.toDouble(), height.toDouble()),
      Paint(),
    );
    final picture = recorder.endRecording();
    final resized = await picture.toImage(width, height);

    final byteData = await resized.toByteData(format: ui.ImageByteFormat.png);
    if (byteData == null) throw Exception("Erreur de compression de l'image");

    final resizedBytes = byteData.buffer.asUint8List();

    return base64Encode(resizedBytes);
  }

  Future<AvatarDoc> uploadAvatar(String token, String imageBase64) async {
    final url = '${ServerConfig.apiUrl}/avatars/upload';
    final response = await http.post(
      Uri.parse(url),
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Bearer $token',
      },
      body: jsonEncode({'imageBase64': imageBase64}),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      final data = jsonDecode(response.body) as Map<String, dynamic>;
      final avatar = AvatarDoc.fromJson(data);
      _cache[avatar.id] = avatar;
      return avatar;
    } else {
      final error = jsonDecode(response.body);
      throw Exception(
        error['message'] ??
            "Échec de l'upload d'avatar (${response.statusCode})",
      );
    }
  }
}
