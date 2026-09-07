class PlayerChallenge {
  final String challengeId;
  final String description;
  final int target;
  final int reward;
  final String stat;
  final bool completed;
  final int? progress;

  PlayerChallenge({
    required this.challengeId,
    required this.description,
    required this.target,
    required this.reward,
    required this.stat,
    required this.completed,
    this.progress,
  });

  factory PlayerChallenge.fromMap(Map<String, dynamic> map) {
    int parseInt(dynamic value) =>
        value is int ? value : int.tryParse(value?.toString() ?? '') ?? 0;

    return PlayerChallenge(
      challengeId: map['challengeId']?.toString() ?? '',
      description: map['description']?.toString() ?? '',
      target: parseInt(map['target']),
      reward: parseInt(map['reward']),
      stat: map['stat']?.toString() ?? '',
      completed: map['completed'] == true,
      progress: map['progress'] == null ? null : parseInt(map['progress']),
    );
  }
}

class ChallengeRecord {
  final String challengeId;
  final String description;
  final String gameId;
  final String completedAt;
  final int reward;

  ChallengeRecord({
    required this.challengeId,
    required this.description,
    required this.gameId,
    required this.completedAt,
    required this.reward,
  });

  factory ChallengeRecord.fromMap(Map<String, dynamic> map) {
    int parseInt(dynamic value) =>
        value is int ? value : int.tryParse(value?.toString() ?? '') ?? 0;

    return ChallengeRecord(
      challengeId: map['challengeId']?.toString() ?? '',
      description: map['description']?.toString() ?? '',
      gameId: map['gameId']?.toString() ?? '',
      completedAt: map['completedAt']?.toString() ?? '',
      reward: parseInt(map['reward']),
    );
  }
}
