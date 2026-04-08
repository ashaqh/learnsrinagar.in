import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class LiveClassService {
  final String baseUrl = AppConfig.apiBaseUrl;

  Future<Map<String, dynamic>> getLiveClasses(String token, {int? classId}) async {
    try {
      final queryParams = classId != null ? '?class_id=$classId' : '';
      final response = await http.get(
        Uri.parse('$baseUrl/live-classes$queryParams'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return {'success': true, 'data': jsonDecode(response.body)};
      }
      return {'success': false, 'message': 'Failed to load live classes'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // Admin CRUD Methods
  Future<Map<String, dynamic>> getAdminLiveClasses(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/live-classes'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Failed to load admin live classes'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> createLiveClass(String token, Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/live-classes'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> updateLiveClass(String token, Map<String, dynamic> data) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/admin/live-classes'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> deleteLiveClass(String token, int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/admin/live-classes'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
