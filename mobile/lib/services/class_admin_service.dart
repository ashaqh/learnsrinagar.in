import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class ClassAdminService {
  final String? token;
  static const String _baseUrl = AppConfig.apiBaseUrl;

  ClassAdminService({this.token});

  Future<Map<String, dynamic>> getClassAdminsData({int? schoolId}) async {
    try {
      final url = Uri.parse('$_baseUrl/admin/class-admins${schoolId != null ? '?school_id=$schoolId' : ''}');
      final response = await http.get(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
      );

      return json.decode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> saveClassAdmin(Map<String, dynamic> data, {int? id}) async {
    try {
      final url = Uri.parse('$_baseUrl/admin/class-admins');
      final response = id != null
          ? await http.put(
              url,
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
              body: json.encode({...data, 'id': id}),
            )
          : await http.post(
              url,
              headers: {
                'Authorization': 'Bearer $token',
                'Content-Type': 'application/json',
              },
              body: json.encode(data),
            );

      return json.decode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteClassAdmin(int id, int adminId) async {
    try {
      final url = Uri.parse('$_baseUrl/admin/class-admins');
      final response = await http.delete(
        url,
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json',
        },
        body: json.encode({'id': id, 'admin_id': adminId}),
      );

      return json.decode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
