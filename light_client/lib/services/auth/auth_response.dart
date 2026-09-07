class AuthResponse {
  final String uid;
  final String email;
  final String username;
  final String idToken;
  final String? avatar;

  AuthResponse({
    required this.uid,
    required this.email,
    required this.username,
    required this.idToken,
    this.avatar,
  });

  factory AuthResponse.fromJson(Map<String, dynamic> json) {
    return AuthResponse(
      uid: json['uid'] as String,
      email: json['email'] as String,
      username: json['username'] as String,
      idToken: json['idToken'] as String,
      avatar: json['avatar']?.toString(),
    );
  }
}
