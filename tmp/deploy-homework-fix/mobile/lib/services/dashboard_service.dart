import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class DashboardService {
  static const String baseUrl = AppConfig.apiBaseUrl;

  Future<Map<String, dynamic>> getDashboardData(String token, {
    int? schoolId,
    int? classId,
    int? studentId,
    String? fromDate,
    String? toDate,
  }) async {
    try {
      final queryParams = <String, String>{};
      if (schoolId != null) queryParams['school_id'] = schoolId.toString();
      if (classId != null) queryParams['class_id'] = classId.toString();
      if (studentId != null) queryParams['student_id'] = studentId.toString();
      if (fromDate != null) queryParams['from'] = fromDate;
      if (toDate != null) queryParams['to'] = toDate;

      final uri = Uri.parse('$baseUrl/dashboard').replace(queryParameters: queryParams);
      final response = await http.get(
        uri,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);

      if (response.statusCode == 200) {
        return {
          'success': true,
          'data': data['data'],
        };
      } else {
        return {
          'success': false,
          'message': data['error'] ?? 'Failed to fetch dashboard data',
        };
      }
    } catch (e) {
      return {
        'success': false,
        'message': 'Network error occurred: $e',
      };
    }
  }
}
