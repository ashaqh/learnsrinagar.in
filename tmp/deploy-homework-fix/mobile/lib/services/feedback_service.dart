import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class FeedbackItem {
  final String section;
  final int statementId;
  final int rating;
  final String? comment;

  FeedbackItem({
    required this.section,
    required this.statementId,
    required this.rating,
    this.comment,
  });

  Map<String, dynamic> toJson() => {
        'section': section,
        'statement_id': statementId,
        'rating': rating,
        'comment': comment,
      };
}

class FeedbackService {
  static const String baseUrl = '${AppConfig.apiBaseUrl}/feedback';

  Future<Map<String, dynamic>> getFeedback(String token) async {
    try {
      final response = await http.get(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'feedback': data['feedback']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch feedback'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> getFeedbackDetails(String token, int feedbackId) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl?id=$feedbackId'),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'feedback': data['feedback'], 'items': data['items']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to fetch details'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  /// Submits the full structured survey feedback — exactly matching the web portal form.
  /// Inserts into parent_feedback + parent_feedback_items tables.
  Future<Map<String, dynamic>> submitSurveyFeedback({
    required String token,
    required String title,
    required int studentId,
    required List<FeedbackItem> items,
  }) async {
    try {
      final response = await http.post(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'title': title,
          'student_id': studentId,
          'items': items.map((i) => i.toJson()).toList(),
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to submit feedback'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> respondToFeedback(String token, int feedbackId, String responseText) async {
    try {
      final response = await http.put(
        Uri.parse(baseUrl),
        headers: {
          'Content-Type': 'application/json',
          'Authorization': 'Bearer $token',
        },
        body: jsonEncode({
          'feedbackId': feedbackId,
          'response': responseText,
        }),
      );

      final data = jsonDecode(response.body);
      if (response.statusCode == 200) {
        return {'success': true, 'message': data['message']};
      } else {
        return {'success': false, 'message': data['error'] ?? 'Failed to respond'};
      }
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }
}
