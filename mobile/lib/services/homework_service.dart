import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';
import '../models/teacher_assignment.dart';

class HomeworkService {
  final String baseUrl = '${AppConfig.apiBaseUrl}/homework';

  Future<Map<String, dynamic>> getHomework(String token, {int? classId, int? studentId}) async {
    try {
      String url = baseUrl;
      if (studentId != null) {
        url = '$baseUrl?studentId=$studentId';
      } else if (classId != null) {
        url = '$baseUrl?classId=$classId';
      }
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {
          'success': true,
          'homework': data['homework'],
          'assignedSubjects': (data['assignedSubjects'] as List? ?? [])
              .map((item) => TeacherAssignment.fromJson(item))
              .toList(),
        };
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch homework'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> createHomework(
    String token, 
    int classId, 
    int subjectId, 
    String title, 
    String description
  ) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'classId': classId,
          'subjectId': subjectId,
          'title': title,
          'description': description,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to create homework'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
