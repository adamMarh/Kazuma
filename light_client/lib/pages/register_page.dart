import 'package:flutter/material.dart';
import 'package:image_picker/image_picker.dart';
import 'package:light_client/components/avatar_image.dart';
import 'package:light_client/components/my_button.dart';
import 'package:light_client/components/text_field.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/avatar_service.dart';
import 'package:provider/provider.dart';

import 'dart:io';

import 'package:flutter/services.dart';

class RegisterPage extends StatefulWidget {
  final void Function()? onTap;
  const RegisterPage({super.key, required this.onTap});

  @override
  State<RegisterPage> createState() => _RegisterPageState();
}

class _RegisterPageState extends State<RegisterPage> {
  final emailController = TextEditingController();
  final passwordController = TextEditingController();
  final confirmPasswordController = TextEditingController();
  final usernameController = TextEditingController();

  String? selectedAvatar;
  bool isFormValid = false;
  List<AvatarDoc> _avatars = [];
  String? _pendingCustomBase64;
  bool _uploadingAvatar = false;

  static const Color _green = Color.fromARGB(255, 35, 136, 60);

  @override
  void initState() {
    super.initState();
    _loadAvatars();
    emailController.addListener(_validateForm);
    usernameController.addListener(_validateForm);
    passwordController.addListener(_validateForm);
    confirmPasswordController.addListener(_validateForm);
  }

  Future<void> _loadAvatars() async {
    final avatarService = AvatarService();
    final uid = Provider.of<AuthService>(context, listen: false).uid ?? '';
    final avatars = await avatarService.getAvailableAvatars(uid);
    setState(() => _avatars = avatars);
  }

  @override
  void dispose() {
    emailController.dispose();
    usernameController.dispose();
    passwordController.dispose();
    confirmPasswordController.dispose();
    super.dispose();
  }

  void _validateForm() {
    final valid =
        emailController.text.trim().isNotEmpty &&
        usernameController.text.trim().isNotEmpty &&
        passwordController.text.trim().isNotEmpty &&
        confirmPasswordController.text.trim().isNotEmpty &&
        selectedAvatar != null;

    if (valid != isFormValid) {
      setState(() => isFormValid = valid);
    }
  }

  Future<void> _takePhoto() async {
    setState(() => _uploadingAvatar = true);
    try {
      final picker = ImagePicker();
      final photo = await picker.pickImage(
        source: ImageSource.camera,
        maxWidth: 400,
        maxHeight: 400,
        imageQuality: 80,
      );
      if (photo == null) {
        setState(() => _uploadingAvatar = false);
        return;
      }

      final avatarService = AvatarService();
      final base64 = await avatarService.compressImageFile(File(photo.path));

      setState(() {
        _avatars = _avatars.where((a) => a.id != '__pending__').toList();
        _avatars.add(
          AvatarDoc(
            id: '__pending__',
            name: 'custom',
            imageBase64: base64,
            owner: 'custom',
          ),
        );
        _pendingCustomBase64 = base64;
        selectedAvatar = '__pending__';
        _uploadingAvatar = false;
      });
      _validateForm();
    } on PlatformException catch (e) {
      if (mounted) {
        setState(() => _uploadingAvatar = false);
        final message =
            (e.code == 'camera_access_denied' ||
                e.code == 'photo_access_denied')
            ? 'Accès à la caméra refusé. Veuillez l\'autoriser dans les paramètres de votre appareil.'
            : e.message ?? 'Erreur caméra.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(message),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _uploadingAvatar = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  void signUp() async {
    if (!isFormValid) return;

    if (passwordController.text != confirmPasswordController.text) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: const Text('Les mots de passe ne correspondent pas'),
          backgroundColor: Colors.red.shade700,
        ),
      );
      return;
    }

    final authService = Provider.of<AuthService>(context, listen: false);

    try {
      final avatarForSignup = selectedAvatar == '__pending__'
          ? _avatars.where((a) => a.id != '__pending__').firstOrNull?.id
          : selectedAvatar;

      await authService.createUserWithEmailAndPassword(
        emailController.text.trim(),
        passwordController.text.trim(),
        usernameController.text.trim(),
        avatar: avatarForSignup,
      );

      if (_pendingCustomBase64 != null && authService.idToken != null) {
        try {
          final avatarService = AvatarService();
          final newAvatar = await avatarService.uploadAvatar(
            authService.idToken!,
            _pendingCustomBase64!,
          );
          await authService.updateProfile(
            usernameController.text.trim(),
            emailController.text.trim(),
            newAvatar.id,
          );
        } catch (e) {
          debugPrint('Custom avatar upload failed (non-critical): $e');
        }
      }
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(e.toString().replaceFirst('Exception: ', '')),
            backgroundColor: Colors.red.shade700,
          ),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: Container(
        decoration: const BoxDecoration(
          image: DecorationImage(
            image: AssetImage('assets/images/background/home_background.jpg'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
          child: Center(
            child: SingleChildScrollView(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: Container(
                constraints: const BoxConstraints(maxWidth: 600),
                padding: const EdgeInsets.all(40),
                decoration: BoxDecoration(
                  color: Colors.black.withValues(alpha: 0.75),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(color: _green, width: 1),
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    const Text(
                      'Inscription',
                      textAlign: TextAlign.center,
                      style: TextStyle(
                        fontSize: 32,
                        fontWeight: FontWeight.bold,
                        color: Colors.white,
                        fontFamily: 'monospace',
                        letterSpacing: 2,
                      ),
                    ),
                    const SizedBox(height: 40),

                    _fieldLabel('Courriel'),
                    const SizedBox(height: 8),
                    _fieldBox(
                      child: MyTextField(
                        controller: emailController,
                        hintText: 'Entrez votre courriel',
                        obscureText: false,
                      ),
                    ),
                    const SizedBox(height: 20),

                    _fieldLabel("Nom d'utilisateur"),
                    const SizedBox(height: 8),
                    _fieldBox(
                      child: MyTextField(
                        controller: usernameController,
                        hintText: "Entrez votre nom d'utilisateur",
                        obscureText: false,
                      ),
                    ),
                    const SizedBox(height: 20),

                    _fieldLabel('Mot de passe'),
                    const SizedBox(height: 8),
                    _fieldBox(
                      child: MyTextField(
                        controller: passwordController,
                        hintText: 'Entrez votre mot de passe',
                        obscureText: true,
                      ),
                    ),
                    const SizedBox(height: 20),

                    _fieldLabel('Confirmer le mot de passe'),
                    const SizedBox(height: 8),
                    _fieldBox(
                      child: MyTextField(
                        controller: confirmPasswordController,
                        hintText: 'Confirmez votre mot de passe',
                        obscureText: true,
                      ),
                    ),
                    const SizedBox(height: 28),

                    const Text(
                      'Choisir un avatar',
                      style: TextStyle(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                    const SizedBox(height: 12),
                    Align(
                      alignment: Alignment.centerLeft,
                      child: ElevatedButton.icon(
                        onPressed: _uploadingAvatar ? null : _takePhoto,
                        icon: _uploadingAvatar
                            ? const SizedBox(
                                width: 16,
                                height: 16,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : const Icon(Icons.camera_alt, size: 18),
                        label: Text(
                          _uploadingAvatar
                              ? 'Chargement...'
                              : 'Prendre une photo',
                        ),
                        style: ElevatedButton.styleFrom(
                          backgroundColor: _green,
                          foregroundColor: Colors.white,
                          padding: const EdgeInsets.symmetric(
                            horizontal: 16,
                            vertical: 10,
                          ),
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(8),
                          ),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _buildAvatarGrid(),
                    const SizedBox(height: 32),

                    MyButton(
                      onTap: isFormValid ? signUp : null,
                      text: "S'inscrire",
                      color: isFormValid ? _green : Colors.grey.shade700,
                    ),
                    const SizedBox(height: 24),

                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        Text(
                          'Déjà un compte ? ',
                          style: TextStyle(
                            color: Colors.grey.shade300,
                            fontSize: 14,
                          ),
                        ),
                        GestureDetector(
                          onTap: widget.onTap,
                          child: const Text(
                            'Se connecter',
                            style: TextStyle(
                              color: _green,
                              fontSize: 14,
                              fontWeight: FontWeight.w600,
                              decoration: TextDecoration.underline,
                              decorationColor: _green,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _fieldLabel(String text) => Text(
    text,
    style: const TextStyle(
      color: Colors.white,
      fontSize: 14,
      fontWeight: FontWeight.w500,
    ),
  );

  Widget _fieldBox({required Widget child}) {
    return Container(
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.3),
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: _green.withValues(alpha: 0.5), width: 1),
      ),
      child: child,
    );
  }

  Widget _buildAvatarGrid() {
    if (_avatars.isEmpty) {
      return const Center(child: CircularProgressIndicator());
    }
    return GridView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
        crossAxisCount: 6,
        crossAxisSpacing: 8,
        mainAxisSpacing: 8,
      ),
      itemCount: _avatars.length,
      itemBuilder: (context, index) {
        final avatar = _avatars[index];
        final isSelected = selectedAvatar == avatar.id;
        final isPending = avatar.id == '__pending__';

        return GestureDetector(
          onTap: () {
            setState(() => selectedAvatar = avatar.id);
            _validateForm();
          },
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              AnimatedContainer(
                duration: const Duration(milliseconds: 150),
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  border: Border.all(
                    color: isSelected ? _green : Colors.transparent,
                    width: 3,
                  ),
                  boxShadow: isSelected
                      ? [
                          BoxShadow(
                            color: _green.withValues(alpha: 0.5),
                            blurRadius: 8,
                          ),
                        ]
                      : null,
                ),
                child: ClipOval(
                  child: AvatarImage(base64: avatar.imageBase64, radius: 30),
                ),
              ),
              if (isPending)
                Positioned(
                  bottom: -2,
                  left: 0,
                  right: 0,
                  child: Center(
                    child: Container(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 4,
                        vertical: 1,
                      ),
                      decoration: BoxDecoration(
                        color: _green,
                        borderRadius: BorderRadius.circular(4),
                      ),
                      child: const Text(
                        'Perso.',
                        style: TextStyle(
                          color: Colors.white,
                          fontSize: 8,
                          fontWeight: FontWeight.bold,
                        ),
                      ),
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }
}
