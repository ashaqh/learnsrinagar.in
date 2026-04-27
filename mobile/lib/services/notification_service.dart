import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:http/http.dart' as http;
import 'dart:convert';
import '../config/app_config.dart';
import '../models/user.dart';
import '../main.dart'; // To access navigatorKey

class NotificationService {
  static final FirebaseMessaging _fcm = FirebaseMessaging.instance;
  static const _storage = FlutterSecureStorage();
  static final FlutterLocalNotificationsPlugin _localNotifications =
      FlutterLocalNotificationsPlugin();
  static const String _syncStateKey = 'fcm_sync_state';
  static const String _initStateKey = 'fcm_init_state';

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
    const AndroidInitializationSettings androidSettings =
        AndroidInitializationSettings('@mipmap/ic_launcher');
    const InitializationSettings initSettings = InitializationSettings(
      android: androidSettings,
    );
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
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.createNotificationChannel(channel);

    // Request Android 13+ Notification Permissions
    final granted = await _localNotifications
        .resolvePlatformSpecificImplementation<
          AndroidFlutterLocalNotificationsPlugin
        >()
        ?.requestNotificationsPermission();
    if (kDebugMode) print('Local notification permission granted: $granted');

    // Request FCM permissions (iOS/Android)
    NotificationSettings settings = await _fcm.requestPermission(
      alert: true,
      badge: true,
      sound: true,
    );
    if (kDebugMode) {
      print('FCM permission status: ${settings.authorizationStatus}');
    }

    // Configure FCM to NOT auto-show heads-up (we do it ourselves via flutter_local_notifications)
    // This ensures foreground notifications also make sound/vibration
    await _fcm.setForegroundNotificationPresentationOptions(
      alert: false,
      badge: true,
      sound: false,
    );

    // Get FCM Token (don't sync yet - user might not be logged in)
    String? token = await _fcm.getToken();
    if (kDebugMode) {
      print('FCM Token: ${_tokenPreview(token)}');
    }
    await _storage.write(key: 'fcm_token', value: token);
    await _recordInitState(
      status: 'initialized',
      detail:
          'Firebase Messaging initialized with permission ${settings.authorizationStatus.name}',
      tokenPreview: _tokenPreview(token),
    );

    // Listen for token refreshes and store locally
    _fcm.onTokenRefresh.listen((newToken) async {
      if (kDebugMode) {
        print('FCM Token refreshed: ${_tokenPreview(newToken)}');
      }
      await _storage.write(key: 'fcm_token', value: newToken);
      // Try to sync if user is already logged in
      await syncTokenWithBackend(source: 'token-refresh');
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
              channelDescription:
                  'This channel is used for important notifications.',
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
    await syncTokenWithBackend(source: 'initialize');
  }

  static Future<Map<String, dynamic>> syncTokenWithBackend({
    bool forceRefresh = false,
    String source = 'manual',
  }) async {
    final jwt = await _storage.read(key: 'jwt_token');
    var fcmToken = forceRefresh ? null : await _storage.read(key: 'fcm_token');
    final deviceType = _detectDeviceType();

    if (kDebugMode) {
      print(
        '[FCM-SYNC] source: $source, jwt present: ${jwt != null}, fcmToken present: ${fcmToken != null}',
      );
    }

    // If FCM token not in storage, try to fetch it directly from Firebase
    if (fcmToken == null) {
      if (kDebugMode) {
        print(
          '[FCM-SYNC] FCM token missing from storage, fetching from Firebase...',
        );
      }
      try {
        fcmToken = await _fcm.getToken();
        if (fcmToken != null) {
          await _storage.write(key: 'fcm_token', value: fcmToken);
          if (kDebugMode) {
            print(
              '[FCM-SYNC] Fetched and stored FCM token: ${_tokenPreview(fcmToken)}',
            );
          }
        } else {
          if (kDebugMode) {
            print(
              '[FCM-SYNC] Firebase returned null token. Check Google Play Services / device setup.',
            );
          }
        }
      } catch (e) {
        if (kDebugMode) {
          print('[FCM-SYNC] Error fetching FCM token from Firebase: $e');
        }
      }
    } else {
      if (kDebugMode) {
        print('[FCM-SYNC] fcmToken prefix: ${_tokenPreview(fcmToken)}');
      }
    }

    if (jwt != null && fcmToken != null) {
      try {
        final url = '${AppConfig.apiBaseUrl}/notifications';
        if (kDebugMode) print('[FCM-SYNC] POSTing to $url');
        final response = await http
            .post(
              Uri.parse(url),
              headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer $jwt',
              },
              body: jsonEncode({
                'action': 'sync-token',
                'fcmToken': fcmToken,
                'deviceType': deviceType,
              }),
            )
            .timeout(const Duration(seconds: 10));
        Map<String, dynamic>? responseData;
        try {
          responseData = jsonDecode(response.body) as Map<String, dynamic>;
        } catch (_) {
          responseData = null;
        }

        if (kDebugMode) {
          print('[FCM-SYNC] Response: ${response.statusCode} ${response.body}');

          if (response.statusCode < 200 || response.statusCode >= 300) {
            print(
              '[FCM-SYNC] *** BACKEND TOKEN SYNC FAILED with status ${response.statusCode} ***',
            );
          } else if (responseData != null && responseData['success'] != true) {
            print(
              '[FCM-SYNC] *** BACKEND TOKEN SYNC REJECTED: ${responseData['message']} ***',
            );
          } else {
            print('[FCM-SYNC] Token sync confirmed by backend.');
          }
        }
        final success =
            response.statusCode >= 200 &&
            response.statusCode < 300 &&
            (responseData == null || responseData['success'] == true);
        final result = <String, dynamic>{
          'success': success,
          'source': source,
          'statusCode': response.statusCode,
          'deviceType': deviceType,
          'tokenPreview': _tokenPreview(fcmToken),
          'response': responseData,
        };
        await _recordSyncState(
          success ? 'success' : 'error',
          detail: success
              ? 'Token synced successfully'
              : (responseData?['message']?.toString() ?? 'Backend rejected token sync'),
          source: source,
          deviceType: deviceType,
          statusCode: response.statusCode,
          jwtPresent: jwt.isNotEmpty,
          tokenPreview: _tokenPreview(fcmToken),
        );
        return result;
      } catch (e) {
        if (kDebugMode) {
          print('[FCM-SYNC] *** ERROR syncing FCM token: $e ***');
        }
        await _recordSyncState(
          'error',
          detail: e.toString(),
          source: source,
          deviceType: deviceType,
          jwtPresent: jwt.isNotEmpty,
          tokenPreview: _tokenPreview(fcmToken),
        );
        return {
          'success': false,
          'source': source,
          'deviceType': deviceType,
          'tokenPreview': _tokenPreview(fcmToken),
          'error': e.toString(),
        };
      }
    } else {
      if (kDebugMode) {
        print('[FCM-SYNC] Skipped: missing jwt or fcmToken');
      }
      final detail = jwt == null
          ? 'JWT missing; user is not authenticated'
          : 'FCM token missing; Firebase did not return a token';
      await _recordSyncState(
        'skipped',
        detail: detail,
        source: source,
        deviceType: deviceType,
        jwtPresent: jwt != null,
        tokenPreview: _tokenPreview(fcmToken),
      );
      return {
        'success': false,
        'skipped': true,
        'source': source,
        'deviceType': deviceType,
        'tokenPreview': _tokenPreview(fcmToken),
        'reason': detail,
      };
    }
  }

  static Future<void> removeToken() async {
    final jwt = await _storage.read(key: 'jwt_token');
    final fcmToken = await _storage.read(key: 'fcm_token');

    if (jwt != null && fcmToken != null) {
      try {
        final url = '${AppConfig.apiBaseUrl}/notifications';
        await http.post(
          Uri.parse(url),
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer $jwt',
          },
          body: jsonEncode({
            'action': 'remove-token',
            'fcmToken': fcmToken,
          }),
        ).timeout(const Duration(seconds: 10));

        if (kDebugMode) {
          print('[FCM] Token removed from backend');
        }
      } catch (e) {
        if (kDebugMode) {
          print('[FCM] Error removing token from backend: $e');
        }
      }
    }

    await _storage.delete(key: 'fcm_token');
  }

  static Future<Map<String, dynamic>> deleteNotification(
    int notificationId,
  ) async {
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
        headers: {'Authorization': 'Bearer $jwt'},
      );

      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return data['notifications'] ?? [];
      }
    } catch (e) {
      if (kDebugMode) {
        print('Error fetching notifications: $e');
      }
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
      if (kDebugMode) {
        print('Error sending manual notification: $e');
      }
      return {'success': false, 'message': e.toString()};
    }
  }

  static void _handleMessageTap(RemoteMessage message) {
    if (kDebugMode) {
      print("[FCM-TAP] Global notification tap handled: ${message.messageId}");
    }
    navigateToNotifications();
  }

  static Future<void> subscribeToRelevantTopics(User user) async {
    try {
      // 1. Subscribe by global role
      if (user.roleName == 'super_admin') {
        await _fcm.subscribeToTopic('super_admin');
      }

      // 2. Subscribe by school
      if (user.schoolId != null) {
        await _fcm.subscribeToTopic('school_${user.schoolId}');

        // Teachers and School Admins might need school-level broadcast
        if (user.roleName == 'teacher' || user.roleName == 'school_admin') {
          await _fcm.subscribeToTopic('teachers_${user.schoolId}');
        }
      }

      // 3. Subscribe to all class-specific topics
      for (final classId in user.classIds) {
        await _fcm.subscribeToTopic('class_$classId');
      }

      if (kDebugMode) {
        print(
          '[FCM-TOPIC] Subscribed for ${user.email} -> role: ${user.roleName}, school: ${user.schoolId}, classes: ${user.classIds}',
        );
      }
    } catch (e) {
      if (kDebugMode) print('[FCM-TOPIC] Error subscribing to topics: $e');
    }
  }

  static Future<void> unsubscribeFromRelevantTopics(User user) async {
    try {
      if (user.roleName == 'super_admin') {
        await _fcm.unsubscribeFromTopic('super_admin');
      }
      if (user.schoolId != null) {
        await _fcm.unsubscribeFromTopic('school_${user.schoolId}');
        if (user.roleName == 'teacher' || user.roleName == 'school_admin') {
          await _fcm.unsubscribeFromTopic('teachers_${user.schoolId}');
        }
      }
      for (final classId in user.classIds) {
        await _fcm.unsubscribeFromTopic('class_$classId');
      }
      if (kDebugMode) {
        print('[FCM-TOPIC] Unsubscribed from all topics for ${user.email}');
      }
    } catch (e) {
      if (kDebugMode) {
        print('[FCM-TOPIC] Error unsubscribing: $e');
      }
    }
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

  static Future<void> recordInitializationFailure(Object error) async {
    await _recordInitState(
      status: 'error',
      detail: error.toString(),
      tokenPreview: null,
    );
  }

  static String _detectDeviceType() {
    if (kIsWeb) return 'web';

    switch (defaultTargetPlatform) {
      case TargetPlatform.iOS:
        return 'ios';
      case TargetPlatform.android:
        return 'android';
      default:
        return 'android';
    }
  }

  static String? _tokenPreview(String? token) {
    if (token == null || token.isEmpty) return null;
    return token.length > 24 ? '${token.substring(0, 24)}...' : token;
  }

  static Future<void> _recordInitState({
    required String status,
    required String detail,
    required String? tokenPreview,
  }) async {
    await _storage.write(
      key: _initStateKey,
      value: jsonEncode({
        'status': status,
        'detail': detail,
        'tokenPreview': tokenPreview,
        'updatedAt': DateTime.now().toIso8601String(),
      }),
    );
  }

  static Future<void> _recordSyncState(
    String status, {
    required String detail,
    required String source,
    required String deviceType,
    required bool jwtPresent,
    int? statusCode,
    String? tokenPreview,
  }) async {
    await _storage.write(
      key: _syncStateKey,
      value: jsonEncode({
        'status': status,
        'detail': detail,
        'source': source,
        'deviceType': deviceType,
        'jwtPresent': jwtPresent,
        'statusCode': statusCode,
        'tokenPreview': tokenPreview,
        'updatedAt': DateTime.now().toIso8601String(),
      }),
    );
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
