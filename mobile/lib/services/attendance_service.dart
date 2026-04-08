import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class AttendanceService {
  final String baseUrl = '${AppConfig.apiBaseUrl}/attendance';

  Future<Map<String, dynamic>> getStudents(String token, int classId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?classId=$classId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'students': data['students']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch students'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> postAttendance(String token, int classId, String date, List<Map<String, dynamic>> records) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'classId': classId,
          'date': date,
          'attendanceRecords': records,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to post attendance'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> getStudentAttendance(String token, {int? studentId}) async {
    try {
      final url = studentId != null ? '$baseUrl?studentId=$studentId' : baseUrl;
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'attendance': data['attendance']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch attendance'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
  Future<Map<String, dynamic>> getAttendanceForClass(String token, int classId, String date) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?classId=$classId&date=$date&view=records'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'attendance': data['attendance'] ?? []};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch attendance'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
