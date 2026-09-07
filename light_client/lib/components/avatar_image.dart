import 'dart:convert';

import 'package:flutter/material.dart';

class AvatarImage extends StatelessWidget {
  final String? base64;
  final double radius;

  const AvatarImage({super.key, this.base64, this.radius = 16});

  @override
  Widget build(BuildContext context) {
    if (base64 == null || base64!.isEmpty) {
      return CircleAvatar(
        radius: radius,
        backgroundColor: Colors.grey.shade800,
        child: Icon(Icons.person, color: Colors.white54, size: radius),
      );
    }
    return CircleAvatar(
      radius: radius,
      backgroundImage: MemoryImage(base64Decode(base64!)),
    );
  }
}
