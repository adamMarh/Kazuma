// ignore_for_file: type=lint
import 'package:firebase_core/firebase_core.dart' show FirebaseOptions;
import 'package:flutter/foundation.dart'
    show defaultTargetPlatform, kIsWeb, TargetPlatform;

class DefaultFirebaseOptions {
  static FirebaseOptions get currentPlatform {
    if (kIsWeb) {
      return web;
    }
    switch (defaultTargetPlatform) {
      case TargetPlatform.android:
        return android;
      case TargetPlatform.iOS:
        return ios;
      case TargetPlatform.macOS:
        return macos;
      case TargetPlatform.windows:
        return windows;
      case TargetPlatform.linux:
        throw UnsupportedError(
          'DefaultFirebaseOptions have not been configured for linux - '
          'you can reconfigure this by running the FlutterFire CLI again.',
        );
      default:
        throw UnsupportedError(
          'DefaultFirebaseOptions are not supported for this platform.',
        );
    }
  }

  static const FirebaseOptions web = FirebaseOptions(
    apiKey: 'AIzaSyDUhhLRcKpykXVjY9gGWFE4-F9d7DdhWFU',
    appId: '1:314257484947:web:dcbb5cd8ded98375997166',
    messagingSenderId: '314257484947',
    projectId: 'kazuma-691eb',
    authDomain: 'kazuma-691eb.firebaseapp.com',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
  );

  static const FirebaseOptions android = FirebaseOptions(
    apiKey: 'AIzaSyDxvau6OXnqsIbObYQOLYIuU2zfGb9RkmI',
    appId: '1:314257484947:android:55d28cfaa649e20e997166',
    messagingSenderId: '314257484947',
    projectId: 'kazuma-691eb',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
  );

  static const FirebaseOptions ios = FirebaseOptions(
    apiKey: 'AIzaSyAmDCNjIiX7H7hJVuQau2AloHhvLIu8UZY',
    appId: '1:314257484947:ios:f1e4a763383b2e27997166',
    messagingSenderId: '314257484947',
    projectId: 'kazuma-691eb',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
    iosBundleId: 'com.example.lightClient',
  );

  static const FirebaseOptions macos = FirebaseOptions(
    apiKey: 'AIzaSyAmDCNjIiX7H7hJVuQau2AloHhvLIu8UZY',
    appId: '1:314257484947:ios:f1e4a763383b2e27997166',
    messagingSenderId: '314257484947',
    projectId: 'kazuma-691eb',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
    iosBundleId: 'com.example.lightClient',
  );

  static const FirebaseOptions windows = FirebaseOptions(
    apiKey: 'AIzaSyDUhhLRcKpykXVjY9gGWFE4-F9d7DdhWFU',
    appId: '1:314257484947:web:c3e259a88361caa5997166',
    messagingSenderId: '314257484947',
    projectId: 'kazuma-691eb',
    authDomain: 'kazuma-691eb.firebaseapp.com',
    storageBucket: 'kazuma-691eb.firebasestorage.app',
  );
}
