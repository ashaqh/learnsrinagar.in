import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../config/app_config.dart';
import '../main.dart'; // To access navigatorKey

class NotificationService {
  static final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  static const _storage = FlutterSecureStorage();
  static final FlutterLocalNotificationsPlugin _localNotifications = FlutterLocalNotificationsPlugin();

  static Future<void> initialize() async {
    // Listen for background notification tap
    FirebaseMessaging.onMessageOpenedApp.listen(_handleMessageTap);

    // Check for initial message (app launched from terminated state)
    FirebaseMessaging.instance.getInitialMessage().then((message) {
      if (message != null) {
        _handleMessageTap(message);
      }
    });

    // Initialize Local Notifications for Heads-Up and Foreground
    // Initialize local notifications
    const AndroidInitializationSettings androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
    const InitializationSettings initSettings = InitializationSettings(android: androidSettings);
    await _localNotifications.initialize(
      settings: initSettings,
      onDidReceiveNotificationResponse: (NotificationResponse response) {
        navigateToNotifications();
      },
    );

    // Create high importance channel for Android 8.0+
    const AndroidNotificationChannel channel = AndroidNotificationChannel(
      'high_importance_channel', // must match backend channelId
      'High Importance Notifications',
      description: 'This channel is used for important notifications.',
      importance: Importance.high,
      playSound: true,
      enableVibration: true,
    );
    
    await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.createNotificationChannel(channel);

    // Request Android 13+ Notification Permissions
    final granted = await _localNotifications
        .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>()
        ?.requestNotificationsPermission();
    if (kDebugMode) print('Local notification permission granted: $granted');

    // Request FCM permissions (iOS/Android)
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (kDebugMode) print('FCM permission status: ${settings.authorizationStatus}');

    // Configure FCM to NOT auto-show heads-up (we do it ourselves via flutter_local_notifications)
    // This ensures foreground notifications also make sound/vibration
    await _fcm.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: true,
      sound: false,
    );

    // Get FCM Token (don't sync yet - user might not be logged in)
    String? token = await _fcm.getToken();
    if (kDebugMode) print('FCM Token: ${token?.substring(0, 20)}...');
    if (token != null) {
      await _storage.write(key: 'fcm_token', value: token);
    }

    // Listen for token refreshes and store locally
    _fcm.onTokenRefresh.listen((newToken) async {
      if (kDebugMode) print('FCM Token refreshed: ${newToken.substring(0, 20)}...');
      await _storage.write(key: 'fcm_token', value: newToken);
      // Try to sync if user is already logged in
      await syncTokenWithBackend();
    });

    // Handle background messages
    FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

    // Handle foreground messages to explicitly show them with sound
    FirebaseMessaging.onMessage.listen((RemoteMessage message) {
      if (kDebugMode) {
        print('==> Foreground message received!');
        print('    Title: ${message.notification?.title}');
        print('    Body: ${message.notification?.body}');
      }
      
      RemoteNotification? notification = message.notification;

      if (notification != null) {
        _localNotifications.show(
          id: notification.hashCode,
          title: notification.title,
          body: notification.body,
          notificationDetails: const NotificationDetails(
            android: AndroidNotificationDetails(
              'high_importance_channel',
              'High Importance Notifications',
              channelDescription: 'This channel is used for important notifications.',
              icon: '@mipmap/ic_launcher',
              importance: Importance.high,
              priority: Priority.high,
              playSound: true,
              enableVibration: true,
            ),
          ),
        );
      }
    });

    // Final sync attempt after initialization
    await syncTokenWithBackend();
  }

  static Future<void> _saveToken(String token) async {
    await _storage.write(key: 'fcm_token', value: token);
    // Sync with backend (only succeeds if user is logged in and has JWT)
    await syncTokenWithBackend();
  }

  static Future<void> syncTokenWithBackend() async {
    final jwt = await _storage.read(key: 'jwt_token');
    var fcmToken = await _storage.read(key: 'fcm_token');

    if (kDebugMode) {
      print('[FCM-SYNC] jwt present: ${jwt != null}, fcmToken present: ${fcmToken != null}');
    }

    // If FCM token not in storage, try to fetch it directly from Firebase
    if (fcmToken == null) {
      if (kDebugMode) print('[FCM-SYNC] FCM token missing from storage, fetching from Firebase...');
      try {
        fcmToken = await _fcm.getToken();
        if (fcmToken != null) {
          await _storage.write(key: 'fcm_token', value: fcmToken);
          if (kDebugMode) print('[FCM-SYNC] Fetched and stored FCM token: ${fcmToken.substring(0, 20)}...');
        } else {
          if (kDebugMode) print('[FCM-SYNC] Firebase returned null token. Check Google Play Services / device setup.');
        }
      } catch (e) {
        if (kDebugMode) print('[FCM-SYNC] Error fetching FCM token from Firebase: $e');
      }
    } else {
      if (kDebugMode) print('[FCM-SYNC] fcmToken prefix: ${fcmToken.substring(0, 30)}...');
    }

    if (jwt != null && fcmToken != null) {
      try {
        final url = '${AppConfig.apiBaseUrl}/notifications';
        if (kDebugMode) print('[FCM-SYNC] POSTing to $url');
        final response = await http.post(
          Uri.parse(url),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $jwt',
          },
          body: jsonEncode({
            'action': 'sync-token',
            'fcmToken': fcmToken,
            'deviceType': 'android'
          }),
        ).timeout(const Duration(seconds: 10));
        if (kDebugMode) print('[FCM-SYNC] Response: ${response.statusCode} ${response.body}');
      } catch (e) {
        if (kDebugMode) print('[FCM-SYNC] *** ERROR syncing FCM token: $e ***');
      }
    } else {
      if (kDebugMode) print('[FCM-SYNC] Skipped: missing jwt or fcmToken');
    }
  }

  static Future<Map<String, dynamic>> deleteNotification(int notificationId) async {
    final jwt = await _storage.read(key: 'jwt_token');
    if (jwt == null) return {'success': false, 'message': 'Not authenticated'};

    try {
      final response = await http.delete(
        Uri.parse('${AppConfig.apiBaseUrl}/notifications'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $jwt',
        },
        body: jsonEncode({
          'action': 'delete',
          'notificationId': notificationId,
        }),
      );

      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  static Future<List<dynamic>> fetchNotifications() async {
    final jwt = await _storage.read(key: 'jwt_token');
    if (jwt == null) return [];

    try {
      final response = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/notifications'),
        headers: {
          'Authorization': 'Bearer $jwt',
        },
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['notifications'] ?? [];
      }
    } catch (e) {
      if (kDebugMode) print('Error fetching notifications: $e');
    }
    return [];
  }

  static Future<void> markAsRead([int? notificationId]) async {
    final jwt = await _storage.read(key: 'jwt_token');
    if (jwt == null) return;

    try {
      await http.put(
        Uri.parse('${AppConfig.apiBaseUrl}/notifications'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $jwt',
        },
        body: jsonEncode({
          'action': 'mark-read',
          'notificationId': notificationId,
        }),
      );
    } catch (e) {
      if (kDebugMode) print('Error marking as read: $e');
    }
  }

  static Future<Map<String, dynamic>> sendManualNotification({
    required String title,
    required String message,
    required String targetType,
    String? targetId,
  }) async {
    final jwt = await _storage.read(key: 'jwt_token');
    if (jwt == null) return {'success': false, 'message': 'Unauthorized'};

    try {
      final response = await http.post(
        Uri.parse('${AppConfig.apiBaseUrl}/notifications'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $jwt',
        },
        body: jsonEncode({
          'action': 'send-manual',
          'title': title,
          'message': message,
          'targetType': targetType,
          'targetId': targetId,
        }),
      );

      return jsonDecode(response.body);
    } catch (e) {
      if (kDebugMode) print('Error sending manual notification: $e');
      return {'success': false, 'message': e.toString()};
    }
  }

  static void _handleMessageTap(RemoteMessage message) {
    if (kDebugMode) {
      print("[FCM-TAP] Global notification tap handled: ${message.messageId}");
    }
    navigateToNotifications();
  }

  static void navigateToNotifications() {
     if (navigatorKey.currentState != null) {
      navigatorKey.currentState!.pushNamed('/notifications');
    } else {
       if (kDebugMode) {
        print("[FCM-NAV] Error: Navigator state is null");
       }
    }
  }
}

// Global background handler - MUST be a top-level function
// Firebase MUST be re-initialized in background isolate
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  await Firebase.initializeApp();
  if (kDebugMode) {
    print("==> Background message received: ${message.messageId}");
    print("    Title: ${message.notification?.title}");
  }
}
