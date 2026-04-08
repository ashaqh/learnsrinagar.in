import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class ProfileService {
  final String baseUrl = AppConfig.apiBaseUrl;

  Future<Map<String, dynamic>> changePassword(
      String token, String currentPassword, String newPassword, String confirmPassword) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/change-password'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'currentPassword': currentPassword,
          'newPassword': newPassword,
          'confirmPassword': confirmPassword,
        }),
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return data;
      } else {
        return {
          'success': false,
          'message': data['message'] ?? data['error'] ?? 'Failed to change password'
        };
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
