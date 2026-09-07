class Message {
  final String senderId;
  final String senderUsername;
  final String message;
  final DateTime timestamp;

  Message({
    required this.senderId,
    required this.senderUsername,
    required this.message,
    required this.timestamp,
  });

  factory Message.fromMap(Map<String, dynamic> map) {
    return Message(
      senderId: map['senderId'] ?? '',
      senderUsername: map['senderUsername'] ?? 'Unknown',
      message: map['message'] ?? '',
      timestamp: map['timestamp'] is DateTime
          ? map['timestamp']
          : DateTime.parse(map['timestamp']),
    );
  }

  Map<String, dynamic> toMap() {
    return {
      'senderId': senderId,
      'senderUsername': senderUsername,
      'message': message,
      'timestamp': timestamp.toIso8601String(),
    };
  }
}
