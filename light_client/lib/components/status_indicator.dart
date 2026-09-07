import 'package:flutter/material.dart';
import 'package:light_client/services/friend/friend_models.dart';

class StatusIndicator extends StatelessWidget {
  final UserStatus status;
  final double size;

  const StatusIndicator({super.key, required this.status, this.size = 12});

  @override
  Widget build(BuildContext context) {
    if (status == UserStatus.offline) {
      return const SizedBox.shrink();
    }

    return Container(
      width: size,
      height: size,
      decoration: BoxDecoration(
        color: _colorForStatus(status),
        shape: BoxShape.circle,
        border: Border.all(color: Colors.black, width: 1.5),
      ),
    );
  }

  static Color _colorForStatus(UserStatus status) {
    switch (status) {
      case UserStatus.online:
        return const Color(0xFF4CAF50); // Green
      case UserStatus.inGame:
        return const Color(0xFFFFC107); // Amber
      case UserStatus.creatingGame:
        return const Color(0xFF9E9E9E); // Grey
      case UserStatus.busy:
        return const Color(0xFFF44336); // Red
      case UserStatus.offline:
        return Colors.transparent;
    }
  }

  static String labelForStatus(UserStatus status) {
    switch (status) {
      case UserStatus.online:
        return 'En ligne';
      case UserStatus.inGame:
        return 'En partie';
      case UserStatus.creatingGame:
        return 'En création de jeu';
      case UserStatus.busy:
        return 'Occupé';
      case UserStatus.offline:
        return 'Hors ligne';
    }
  }

  static Color colorForStatus(UserStatus status) => _colorForStatus(status);
}

/// A wrapper that shows a profile picture with a status dot at the bottom right.
class AvatarWithStatus extends StatelessWidget {
  final Widget avatar;
  final UserStatus status;
  final double avatarRadius;

  const AvatarWithStatus({
    super.key,
    required this.avatar,
    required this.status,
    this.avatarRadius = 16,
  });

  @override
  Widget build(BuildContext context) {
    if (status == UserStatus.offline) {
      return avatar;
    }

    return SizedBox(
      width: avatarRadius * 2,
      height: avatarRadius * 2,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          avatar,
          Positioned(
            right: -1,
            bottom: -1,
            child: StatusIndicator(status: status, size: avatarRadius * 0.65),
          ),
        ],
      ),
    );
  }
}
