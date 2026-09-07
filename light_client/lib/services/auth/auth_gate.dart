import 'dart:async';

import 'package:firebase_auth/firebase_auth.dart';
import 'package:flutter/material.dart';
import 'package:light_client/pages/home_page.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/auth/login_or_register.dart';
import 'package:provider/provider.dart';

class AuthGate extends StatefulWidget {
  const AuthGate({super.key});

  @override
  State<AuthGate> createState() => _AuthGateState();
}

class _AuthGateState extends State<AuthGate> {
  bool _isInitialized = false;

  StreamSubscription<User?>? _firebaseAuthSubscription;

  @override
  void initState() {
    super.initState();
    _initializeAuth();
  }

  @override
  void dispose() {
    _firebaseAuthSubscription?.cancel();
    super.dispose();
  }

  Future<void> _initializeAuth() async {
    final authService = context.read<AuthService>();

    await FirebaseAuth.instance.authStateChanges().first;

    await authService.initialize();

    if (!mounted) return;

    setState(() {
      _isInitialized = true;
    });

    _firebaseAuthSubscription = FirebaseAuth.instance.authStateChanges().listen(
      (firebaseUser) {
        if (firebaseUser == null && authService.isAuthenticated) {
          debugPrint(
            'AuthGate: Firebase signed out remotely — clearing local auth',
          );
          authService.signOut();
        }
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    if (!_isInitialized) {
      return const Scaffold(body: Center(child: CircularProgressIndicator()));
    }

    return Consumer<AuthService>(
      builder: (context, authService, child) {
        if (authService.isAuthenticated) {
          return const HomePage();
        }
        return const LoginOrRegister();
      },
    );
  }
}
