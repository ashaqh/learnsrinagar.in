import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class StudentService {
  final String baseUrl = '${AppConfig.apiBaseUrl}/admin/students';
  final String? token;

  StudentService({this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  Future<Map<String, dynamic>> getStudents({int? classId, int? schoolId}) async {
    try {
      String url = baseUrl;
      final params = <String>[];
      if (classId != null) params.add('classId=$classId');
      if (schoolId != null) params.add('schoolId=$schoolId');
      if (params.isNotEmpty) url += '?${params.join('&')}';

      final response = await http.get(Uri.parse(url), headers: _headers);
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> createStudent(Map<String, dynamic> data) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: _headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> updateStudent(Map<String, dynamic> data) async {
    try {
      final response = await http.put(
        Uri.parse(baseUrl),
        headers: _headers,
        body: jsonEncode(data),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> deleteStudent(int id) async {
    try {
      final response = await http.delete(
        Uri.parse(baseUrl),
        headers: _headers,
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
