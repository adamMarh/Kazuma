import 'package:flutter/material.dart';
import 'package:mobile_scanner/mobile_scanner.dart';
import 'package:permission_handler/permission_handler.dart';

/// A full-screen QR code scanner page.
/// Returns the scanned raw string via [Navigator.pop] when a barcode is detected.
/// Returns `null` if the user presses the back button without scanning
/// or if camera permission is not granted.
class QrScannerPage extends StatefulWidget {
  /// True while the scanner page is on screen. Checked by the app lifecycle
  /// handler so that brief paused/resumed cycles caused by the camera or the
  /// system permission dialog don't interfere with auth/foreground-service.
  static bool isActive = false;

  const QrScannerPage({super.key});

  @override
  State<QrScannerPage> createState() => _QrScannerPageState();
}

class _QrScannerPageState extends State<QrScannerPage>
    with WidgetsBindingObserver {
  bool _hasPopped = false;
  bool _isCheckingPermission = true;
  bool _permissionGranted = false;
  bool _waitingForSettings = false;
  MobileScannerController? _controller;

  @override
  void initState() {
    super.initState();
    QrScannerPage.isActive = true;
    WidgetsBinding.instance.addObserver(this);
    _checkAndRequestPermission();
  }

  @override
  void dispose() {
    QrScannerPage.isActive = false;
    _controller?.dispose();
    WidgetsBinding.instance.removeObserver(this);
    super.dispose();
  }

  /// Re-check permission when the user comes back from app settings.
  @override
  void didChangeAppLifecycleState(AppLifecycleState state) {
    if (state == AppLifecycleState.resumed && _waitingForSettings) {
      _waitingForSettings = false;
      _checkAndRequestPermission();
    }
  }

  Future<void> _checkAndRequestPermission() async {
    setState(() => _isCheckingPermission = true);

    // Always call request() directly — this shows the native system dialog
    // when the permission is set to "ask every time" or hasn't been decided yet.
    final status = await Permission.camera.request();

    if (status.isGranted || status.isLimited) {
      await _startCamera();
      return;
    }

    if (status.isPermanentlyDenied) {
      if (!mounted) return;
      final openSettings = await _showPermissionDialog(
        title: 'Permission requise',
        message:
            "L'accès à la caméra est nécessaire pour scanner un code QR. "
            'Veuillez activer la permission dans les paramètres de votre appareil.',
        confirmLabel: 'Ouvrir les paramètres',
      );

      if (openSettings == true) {
        _waitingForSettings = true;
        await openAppSettings();
        return; // Will re-check in didChangeAppLifecycleState
      }
    }

    // Permission denied (user tapped "deny") or cancelled — just go back.
    if (mounted) Navigator.of(context).pop();
  }

  Future<void> _startCamera() async {
    try {
      _controller = MobileScannerController(autoStart: true);
      if (mounted) {
        setState(() {
          _permissionGranted = true;
          _isCheckingPermission = false;
        });
      }
    } catch (e) {
      debugPrint('Camera init error: $e');
      if (mounted) Navigator.of(context).pop();
    }
  }

  Future<bool?> _showPermissionDialog({
    required String title,
    required String message,
    required String confirmLabel,
  }) {
    return showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1A1A2E),
        title: Text(title, style: const TextStyle(color: Colors.white)),
        content: Text(message, style: const TextStyle(color: Colors.white70)),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text(
              'Annuler',
              style: TextStyle(color: Colors.white54),
            ),
          ),
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            child: Text(
              confirmLabel,
              style: const TextStyle(color: Colors.deepPurpleAccent),
            ),
          ),
        ],
      ),
    );
  }

  void _onDetect(BarcodeCapture capture) {
    if (_hasPopped) return;
    final List<Barcode> barcodes = capture.barcodes;
    if (barcodes.isNotEmpty && barcodes.first.rawValue != null) {
      _hasPopped = true;
      Navigator.of(context).pop(barcodes.first.rawValue!);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.black,
      body: _isCheckingPermission
          ? _buildLoading()
          : _permissionGranted
          ? _buildScanner()
          : const SizedBox.shrink(),
    );
  }

  Widget _buildLoading() {
    return const Center(
      child: CircularProgressIndicator(color: Colors.deepPurpleAccent),
    );
  }

  Widget _buildScanner() {
    return Stack(
      children: [
        MobileScanner(controller: _controller!, onDetect: _onDetect),
        SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Align(
              alignment: Alignment.topLeft,
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
        ),
        Center(
          child: Container(
            width: 220,
            height: 220,
            decoration: BoxDecoration(
              border: Border.all(color: Colors.deepPurpleAccent, width: 2),
              borderRadius: BorderRadius.circular(16),
            ),
          ),
        ),
      ],
    );
  }
}
