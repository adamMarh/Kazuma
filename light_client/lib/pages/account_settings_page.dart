import 'dart:io';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:image_picker/image_picker.dart';
import 'package:light_client/components/avatar_image.dart';
import 'package:light_client/components/my_button.dart';
import 'package:light_client/components/text_field.dart';
import 'package:light_client/services/auth/auth_service.dart';
import 'package:light_client/services/avatar_service.dart';
import 'package:light_client/services/friend/friend_service.dart';
import 'package:light_client/services/stats_service.dart';
import 'package:provider/provider.dart';

class AccountSettingsPage extends StatefulWidget {
  const AccountSettingsPage({super.key});

  @override
  State<AccountSettingsPage> createState() => _AccountSettingsPageState();
}

class _AccountSettingsPageState extends State<AccountSettingsPage> {
  final usernameController = TextEditingController();
  final emailController = TextEditingController();

  String? selectedAvatar;
  String? errorMessage;
  String? successMessage;
  bool isLoading = false;
  List<AvatarDoc> _avatars = [];
  AccountStats? _stats;
  bool _statsLoading = true;
  String? _pendingCustomBase64;
  bool _uploadingAvatar = false;
  bool _showDeleteConfirm = false;

  static const Color _green = Color.fromARGB(255, 35, 136, 60);
  static const Color _red = Color.fromARGB(255, 244, 67, 54);
  static const Color _darkRed = Color.fromARGB(255, 99, 27, 23);
  static const Color _grey = Color.fromARGB(255, 153, 153, 153);
  static const Color _black = Color.fromARGB(255, 53, 53, 53);

  @override
  void initState() {
    super.initState();
    final authService = Provider.of<AuthService>(context, listen: false);
    _loadAvatars();
    _loadStats();
    usernameController.text = authService.username ?? '';
    emailController.text = authService.email ?? '';
    selectedAvatar = authService.avatar;
  }

  Future<void> _loadAvatars() async {
    final avatarService = AvatarService();
    final uid = Provider.of<AuthService>(context, listen: false).uid ?? '';
    final avatars = await avatarService.getAvailableAvatars(uid);
    setState(() => _avatars = avatars);
  }

  Future<void> _loadStats() async {
    final authService = Provider.of<AuthService>(context, listen: false);
    final token = authService.idToken;
    if (token == null) {
      setState(() => _statsLoading = false);
      return;
    }
    try {
      final statsService = StatsService();
      final stats = await statsService.getStats(token);
      if (mounted) {
        setState(() {
          _stats = stats;
          _statsLoading = false;
        });
      }
    } catch (e) {
      debugPrint('Error loading stats: $e');
      if (mounted) setState(() => _statsLoading = false);
    }
  }

  @override
  void dispose() {
    usernameController.dispose();
    emailController.dispose();
    super.dispose();
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

  Future<void> _onSubmit() async {
    final username = usernameController.text.trim();
    final email = emailController.text.trim();

    if (username.isEmpty || email.isEmpty) {
      setState(() {
        errorMessage = 'Tous les champs sont requis.';
        successMessage = null;
      });
      return;
    }

    setState(() {
      isLoading = true;
      errorMessage = null;
      successMessage = null;
    });

    try {
      final authService = Provider.of<AuthService>(context, listen: false);

      String? avatarId = selectedAvatar;

      if (selectedAvatar == '__pending__' &&
          _pendingCustomBase64 != null &&
          authService.idToken != null) {
        final avatarService = AvatarService();
        final newAvatar = await avatarService.uploadAvatar(
          authService.idToken!,
          _pendingCustomBase64!,
        );
        avatarId = newAvatar.id;
      }

      await authService.updateProfile(username, email, avatarId);

      if (mounted) {
        setState(() {
          successMessage = 'Profil mis à jour avec succès.';
          if (avatarId != null && avatarId != '__pending__') {
            selectedAvatar = avatarId;
            _pendingCustomBase64 = null;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          errorMessage = e.toString().replaceFirst('Exception: ', '');
        });
      }
    } finally {
      if (mounted) setState(() => isLoading = false);
    }
  }

  Future<void> _deleteAccount() async {
    if (mounted) {
      setState(() => isLoading = true);
      try {
        final authService = Provider.of<AuthService>(context, listen: false);
        await authService.deleteAccount();
        if (mounted) {
          Navigator.of(context).pushNamedAndRemoveUntil('/login', (r) => false);
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            errorMessage = 'Erreur lors de la suppression du compte.';
            isLoading = false;
            _showDeleteConfirm = false;
          });
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFF12121F),
      body: Container(
        decoration: const BoxDecoration(
          image: DecorationImage(
            image: AssetImage('assets/images/background/home_background.jpg'),
            fit: BoxFit.cover,
          ),
        ),
        child: SafeArea(
          child: Column(
            children: [
              Padding(
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 12,
                ),
                child: Align(
                  alignment: Alignment.centerLeft,
                  child: TextButton.icon(
                    onPressed: () => Navigator.of(context).pop(),
                    icon: const SizedBox.shrink(),
                    label: const Text(
                      'Retour',
                      style: TextStyle(color: Colors.white, fontSize: 15),
                    ),
                    style: TextButton.styleFrom(
                      backgroundColor: const Color(0xFFAE4924),
                      padding: const EdgeInsets.symmetric(
                        horizontal: 12,
                        vertical: 8,
                      ),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(8),
                      ),
                    ),
                  ),
                ),
              ),

              Expanded(
                child: Center(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 24,
                      vertical: 16,
                    ),
                    child: Container(
                      constraints: const BoxConstraints(maxWidth: 520),
                      padding: const EdgeInsets.all(40),
                      decoration: BoxDecoration(
                        color: Colors.black.withValues(alpha: 0.75),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _green.withValues(alpha: 0.4),
                          width: 1,
                        ),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.stretch,
                        children: [
                          const Text(
                            'Paramètres du compte',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 26,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 32),

                          _fieldLabel('Pseudonyme'),
                          const SizedBox(height: 8),
                          _fieldBox(
                            child: MyTextField(
                              controller: usernameController,
                              hintText: 'Entrez votre pseudonyme',
                              obscureText: false,
                            ),
                          ),
                          const SizedBox(height: 20),

                          _fieldLabel('Courriel'),
                          const SizedBox(height: 8),
                          _fieldBox(
                            child: MyTextField(
                              controller: emailController,
                              hintText: 'Entrez votre courriel',
                              obscureText: false,
                            ),
                          ),
                          const SizedBox(height: 28),

                          const Text(
                            'Choisir un avatar',
                            style: TextStyle(
                              color: Colors.white,
                              fontSize: 16,
                              fontWeight: FontWeight.w600,
                            ),
                          ),
                          const SizedBox(height: 14),
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

                          const SizedBox(height: 36),
                          Consumer<FriendService>(
                            builder: (context, friendService, _) {
                              return Container(
                                decoration: BoxDecoration(
                                  color: Colors.white.withValues(alpha: 0.05),
                                  borderRadius: BorderRadius.circular(12),
                                  border: Border.all(
                                    color: friendService.isBusy
                                        ? _red
                                        : Colors.white.withValues(alpha: 0.1),
                                  ),
                                ),
                                child: SwitchListTile(
                                  title: const Text(
                                    'Mode Occupé',
                                    style: TextStyle(color: Colors.white),
                                  ),
                                  subtitle: friendService.isBusy
                                      ? const Text(
                                          'Notifications en sourdine',
                                          style: TextStyle(color: Colors.grey),
                                        )
                                      : const Text(
                                          'Notifications actives',
                                          style: TextStyle(color: Colors.grey),
                                        ),
                                  value: friendService.isBusy,
                                  onChanged: (bool value) {
                                    friendService.setBusy(value);
                                  },
                                  inactiveThumbColor: _grey,
                                  inactiveTrackColor: _black,
                                  activeTrackColor: _darkRed,
                                  activeThumbColor: _red,
                                  tileColor: Colors.black,
                                ),
                              );
                            },
                          ),
                          const SizedBox(height: 32),

                          isLoading
                              ? const Center(
                                  child: CircularProgressIndicator(
                                    color: _green,
                                  ),
                                )
                              : MyButton(
                                  onTap: _onSubmit,
                                  text: 'Sauvegarder',
                                  color: _green,
                                ),

                          if (successMessage != null) ...[
                            const SizedBox(height: 16),
                            Text(
                              successMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: _green,
                                fontSize: 14,
                              ),
                            ),
                          ],

                          if (errorMessage != null) ...[
                            const SizedBox(height: 16),
                            Text(
                              errorMessage!,
                              textAlign: TextAlign.center,
                              style: const TextStyle(
                                color: Color(0xFFFF4C4C),
                                fontSize: 14,
                              ),
                            ),
                          ],

                          // ── Statistics Section ──
                          const SizedBox(height: 16),
                          Container(
                            width: double.infinity,
                            height: 1,
                            color: _green.withValues(alpha: 0.3),
                          ),
                          const SizedBox(height: 24),
                          const Text(
                            'Statistiques',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 22,
                              fontWeight: FontWeight.bold,
                              color: Colors.white,
                              letterSpacing: 1,
                            ),
                          ),
                          const SizedBox(height: 20),
                          _buildStatsSection(),

                          // Zone Danger
                          const SizedBox(height: 40),
                          const Text(
                            'Zone dangereuse',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 18,
                              fontWeight: FontWeight.bold,
                              color: Color(0xFFFF6B6B),
                            ),
                          ),
                          const SizedBox(height: 12),
                          const Text(
                            'La suppression de votre compte est irréversible. Toutes vos cartes seront supprimées.',
                            textAlign: TextAlign.center,
                            style: TextStyle(
                              fontSize: 14,
                              color: Colors.white70,
                            ),
                          ),
                          const SizedBox(height: 24),
                          if (!_showDeleteConfirm)
                            Center(
                              child: SizedBox(
                                width: 300,
                                child: MyButton(
                                  onTap: () =>
                                      setState(() => _showDeleteConfirm = true),
                                  text: 'SUPPRIMER LE COMPTE',
                                  color: Colors.transparent,
                                  isLogout: false,
                                ),
                              ),
                            )
                          else
                            Column(
                              children: [
                                const Text(
                                  'Êtes-vous sûr?',
                                  style: TextStyle(
                                    color: Colors.red,
                                    fontSize: 16,
                                    fontWeight: FontWeight.bold,
                                  ),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Expanded(
                                      child: MyButton(
                                        onTap: _deleteAccount,
                                        text: 'CONFIRMER LA SUPPRESSION',
                                        color: Colors.transparent,
                                        isLogout: false,
                                      ),
                                    ),
                                    const SizedBox(width: 16),
                                    Expanded(
                                      child: MyButton(
                                        onTap: () => setState(
                                          () => _showDeleteConfirm = false,
                                        ),
                                        text: 'ANNULER',
                                        color: Colors.transparent,
                                        isLogout: false,
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                        ],
                      ),
                    ),
                  ),
                ),
              ),
            ],
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

  Widget _buildStatsSection() {
    if (_statsLoading) {
      return const Center(
        child: Padding(
          padding: EdgeInsets.all(16),
          child: CircularProgressIndicator(color: _green),
        ),
      );
    }

    final stats = _stats ?? AccountStats.empty();

    return Column(
      children: [
        _buildStatRow(
          Icons.sports_esports,
          'Parties jouées (Classique)',
          stats.gamesPlayedClassic.toString(),
        ),
        const SizedBox(height: 12),
        _buildStatRow(
          Icons.flag,
          'Parties jouées (CTF)',
          stats.gamesPlayedCTF.toString(),
        ),
        const SizedBox(height: 12),
        _buildStatRow(
          Icons.emoji_events,
          'Parties gagnées',
          stats.gamesWon.toString(),
        ),
        const SizedBox(height: 12),
        _buildStatRow(
          Icons.timer,
          'Temps moyen par partie',
          stats.averageGameTime,
        ),
      ],
    );
  }

  Widget _buildStatRow(IconData icon, String label, String value) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.black.withValues(alpha: 0.35),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: _green.withValues(alpha: 0.25), width: 1),
      ),
      child: Row(
        children: [
          Icon(icon, color: _green, size: 22),
          const SizedBox(width: 12),
          Expanded(
            child: Text(
              label,
              style: const TextStyle(color: Colors.white70, fontSize: 14),
            ),
          ),
          Text(
            value,
            style: const TextStyle(
              color: Colors.white,
              fontSize: 16,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
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
