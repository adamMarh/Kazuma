enum UserStatus { online, inGame, creatingGame, busy, offline }

UserStatus userStatusFromString(String? statusStr) {
  switch (statusStr) {
    case 'online':
      return UserStatus.online;
    case 'inGame':
      return UserStatus.inGame;
    case 'creatingGame':
      return UserStatus.creatingGame;
    case 'busy':
      return UserStatus.busy;
    case 'offline':
    default:
      return UserStatus.offline;
  }
}

class GameInvitation {
  final String fromUid;
  final String fromUsername;
  final String gameId;

  GameInvitation({
    required this.fromUid,
    required this.fromUsername,
    required this.gameId,
  });

  factory GameInvitation.fromJson(Map<String, dynamic> json) {
    return GameInvitation(
      fromUid: json['fromUid'] as String? ?? '',
      fromUsername: json['fromUsername'] as String? ?? '',
      gameId: (json['gameId'] ?? json['roomId']) as String? ?? '',
    );
  }
}

class FriendRequest {
  final String id;
  final String fromUid;
  final String fromUsername;
  final String toUid;
  final String toUsername;
  final String status;
  final String createdAt;

  FriendRequest({
    required this.id,
    required this.fromUid,
    required this.fromUsername,
    required this.toUid,
    required this.toUsername,
    required this.status,
    required this.createdAt,
  });

  factory FriendRequest.fromJson(Map<String, dynamic> json) {
    return FriendRequest(
      id: json['id'] as String? ?? '',
      fromUid: json['fromUid'] as String? ?? '',
      fromUsername: json['fromUsername'] as String? ?? '',
      toUid: json['toUid'] as String? ?? '',
      toUsername: json['toUsername'] as String? ?? '',
      status: json['status'] as String? ?? 'pending',
      createdAt: json['createdAt'] as String? ?? '',
    );
  }
}

class FriendEntry {
  final String uid;
  final String username;
  final String addedAt;
  UserStatus userStatus;

  FriendEntry({
    required this.uid,
    required this.username,
    required this.addedAt,
    this.userStatus = UserStatus.offline,
  });

  factory FriendEntry.fromJson(Map<String, dynamic> json) {
    return FriendEntry(
      uid: json['uid'] as String? ?? '',
      username: json['username'] as String? ?? '',
      addedAt: json['addedAt'] as String? ?? '',
      userStatus: userStatusFromString(json['userStatus'] as String?),
    );
  }
}

class UserProfile {
  final String uid;
  final String username;

  UserProfile({required this.uid, required this.username});

  factory UserProfile.fromJson(Map<String, dynamic> json) {
    return UserProfile(
      uid: json['uid'] as String? ?? '',
      username: json['username'] as String? ?? '',
    );
  }
}
