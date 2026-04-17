import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import '../models/user.dart';
import '../services/auth_service.dart';
import '../services/notification_service.dart';

class AuthProvider with ChangeNotifier {
  User? _user;
  String? _token;
  bool _isLoading = false;
  bool _isInitializing = true;
  final _storage = const FlutterSecureStorage();
  final _authService = AuthService();

  User? get user => _user;
  String? get token => _token;
  bool get isLoading => _isLoading;
  bool get isInitializing => _isInitializing;
  bool get isAuthenticated => _token != null;

  AuthProvider() {
    _loadSession();
  }

  Future<void> _loadSession() async {
    final minimumSplash = Future<void>.delayed(const Duration(milliseconds: 1200));

    try {
      _token = await _storage.read(key: 'jwt_token');
      final userData = await _storage.read(key: 'user_data');
      if (_token != null && userData != null) {
        try {
          _user = User.fromJson(jsonDecode(userData));
          debugPrint('[AUTH] Session loaded for user ${_user?.email}. Syncing FCM token...');
          // Sync FCM token on startup for returning users (no login event needed)
          await NotificationService.syncTokenWithBackend();
          debugPrint('[AUTH] FCM token sync complete.');
        } catch (e) {
          debugPrint('[AUTH] Error loading session: $e');
          _token = null;
          _user = null;
        }
      } else {
        debugPrint('[AUTH] No saved session found (jwt: ${_token != null}, userData: ${userData != null})');
      }
    } finally {
      await minimumSplash;
      _isInitializing = false;
      notifyListeners();
    }
  }

  Future<String?> login(String email, String password) async {
    _isLoading = true;
    notifyListeners();

    final result = await _authService.login(email, password);

    if (result['success']) {
      _token = result['token'];
      _user = result['user'];
      await _storage.write(key: 'jwt_token', value: _token);
      await _storage.write(key: 'user_data', value: jsonEncode(_user!.toJson()));
      
      // Sync FCM token now that the user is authenticated 
      // This ensures device_tokens table has the correct user_id
      debugPrint('[AUTH] Login complete. Syncing FCM token...');
      await NotificationService.syncTokenWithBackend();

      _isLoading = false;
      notifyListeners();
      return null; // Success
    } else {
      _isLoading = false;
      notifyListeners();
      return result['message']; // Error message
    }
  }

  Future<void> logout() async {
    _token = null;
    _user = null;
    await _storage.delete(key: 'jwt_token');
    await _storage.delete(key: 'user_data');
    notifyListeners();
  }
}
