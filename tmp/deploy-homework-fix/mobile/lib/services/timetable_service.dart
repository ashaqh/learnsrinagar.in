import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class TimetableService {
  final String baseUrl = '${AppConfig.apiBaseUrl}/timetable';

  Future<Map<String, dynamic>> getTimetable(String token, {int? classId}) async {
    try {
      final url = classId != null ? '$baseUrl?classId=$classId' : baseUrl;
      final response = await http.get(
        Uri.parse(url),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'timetable': data['timetable']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch timetable'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
