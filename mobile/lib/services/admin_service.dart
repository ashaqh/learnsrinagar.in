import 'dart:convert';
import 'package:http/http.dart' as http;
import '../models/school.dart';
import '../models/class_model.dart';
import '../models/subject.dart';
import '../models/teacher_assignment.dart';
import '../models/live_class.dart';
import '../models/user.dart';
import '../config/app_config.dart';

class AdminService {
  static const String baseUrl = '${AppConfig.apiBaseUrl}/admin';

  final String? token;

  AdminService({this.token});

  Map<String, String> get _headers => {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      };

  // --- Schools ---
  Future<List<School>> getSchools() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/schools'), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['schools'] as List).map((s) => School.fromJson(s)).toList();
      }
    } catch (e) {
      // Log error internally or handle appropriately
    }
    return [];
  }

  Future<Map<String, dynamic>> createSchool(String name, String address, int? userId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/schools'),
        headers: _headers,
        body: jsonEncode({'name': name, 'address': address, 'users_id': userId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateSchool(int id, String name, String address, int? userId) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/schools'),
        headers: _headers,
        body: jsonEncode({'id': id, 'name': name, 'address': address, 'users_id': userId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteSchool(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/schools'),
        headers: _headers,
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Users (Admins/Teachers) ---
  Future<List<User>> getUsers({int? roleId}) async {
    try {
      final url = roleId != null ? '$baseUrl/users?role_id=$roleId' : '$baseUrl/users';
      final response = await http.get(Uri.parse(url), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['users'] as List).map((u) => User.fromJson(u)).toList();
      }
    } catch (e) {
      // Log error
    }
    return [];
  }

  Future<Map<String, dynamic>> createUser(String name, String email, String password, int roleId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/users'),
        headers: _headers,
        body: jsonEncode({'name': name, 'email': email, 'password': password, 'role_id': roleId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateUser(int id, String name, String email, String? password, int roleId) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/users'),
        headers: _headers,
        body: jsonEncode({
          'id': id,
          'name': name,
          'email': email,
          if (password != null && password.isNotEmpty) 'password': password,
          'role_id': roleId
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteUser(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/users'),
        headers: _headers,
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Classes ---
  Future<List<ClassModel>> getClasses() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/classes'), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['classes'] as List).map((c) => ClassModel.fromJson(c)).toList();
      }
    } catch (e) {
      print('Error fetching classes: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> createClass(String name) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/classes'),
        headers: _headers,
        body: jsonEncode({'name': name}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateClass(int id, String name) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/classes'),
        headers: _headers,
        body: jsonEncode({'id': id, 'name': name}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteClass(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/classes'),
        headers: _headers,
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Subjects ---
  Future<List<Subject>> getSubjects() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/subjects'), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body);
        return (data['subjects'] as List).map((s) => Subject.fromJson(s)).toList();
      }
    } catch (e) {
      print('Error fetching subjects: $e');
    }
    return [];
  }

  Future<Map<String, dynamic>> createSubject(String name, List<int> classIds) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/subjects'),
        headers: _headers,
        body: jsonEncode({'name': name, 'class_ids': classIds}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateSubject(int id, String name, List<int> classIds) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/subjects'),
        headers: _headers,
        body: jsonEncode({'id': id, 'name': name, 'class_ids': classIds}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteSubject(int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/subjects'),
        headers: _headers,
        body: jsonEncode({'id': id}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Teacher Management ---
  Future<Map<String, dynamic>> getTeachersData() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/teachers'), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'];
        return {
          'teachers': (data['teachers'] as List).map((u) => User.fromJson(u)).toList(),
          'classes': (data['classes'] as List).map((c) => ClassModel.fromJson(c)).toList(),
          'subjects': (data['subjects'] as List).map((s) => Subject.fromJson(s)).toList(),
          'assignments': (data['assignments'] as List).map((a) => TeacherAssignment.fromJson(a)).toList(),
        };
      }
    } catch (e) {
      // Log error
    }
    return {};
  }

  Future<Map<String, dynamic>> createTeacher(String name, String email, String password) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/teachers'),
        headers: _headers,
        body: jsonEncode({'name': name, 'email': email, 'password': password}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> updateTeacher(int id, String name, String email, String? password) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/teachers'),
        headers: _headers,
        body: jsonEncode({
          'id': id,
          'name': name,
          'email': email,
          if (password != null && password.isNotEmpty) 'password': password,
        }),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteTeacher(int id) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl/teachers'), headers: _headers, body: jsonEncode({'id': id}));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> assignSubject(int teacherId, int subjectId, int classId) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/teachers'),
        headers: _headers,
        body: jsonEncode({'_action': 'assign_subject', 'teacher_id': teacherId, 'subject_id': subjectId, 'class_id': classId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> removeAssignment(int assignmentId) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/teachers'),
        headers: _headers,
        body: jsonEncode({'_action': 'remove_assignment', 'assignment_id': assignmentId}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  // --- Live Class Management ---
  Future<Map<String, dynamic>> getLiveClassesData() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/live-classes'), headers: _headers);
      if (response.statusCode == 200) {
        final data = jsonDecode(response.body)['data'];
        return {
          'liveClasses': (data['liveClasses'] as List).map((l) => LiveClass.fromJson(l)).toList(),
          'schools': (data['schools'] as List).map((s) => School.fromJson(s)).toList(),
          'classes': (data['classes'] as List).map((c) => ClassModel.fromJson(c)).toList(),
          'subjects': (data['subjects'] as List).map((s) => Subject.fromJson(s)).toList(),
          'teachers': (data['teachers'] as List).map((u) => User.fromJson(u)).toList(),
        };
      }
    } catch (e) {
      // Log error
    }
    return {};
  }

  Future<Map<String, dynamic>> saveLiveClass(Map<String, dynamic> classData, {int? id}) async {
    try {
      final url = Uri.parse('$baseUrl/live-classes');
      final body = jsonEncode({...classData, if (id != null) 'id': id});
      final response = id != null ? await http.put(url, headers: _headers, body: body) : await http.post(url, headers: _headers, body: body);
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }

  Future<Map<String, dynamic>> deleteLiveClass(int id) async {
    try {
      final response = await http.delete(Uri.parse('$baseUrl/live-classes'), headers: _headers, body: jsonEncode({'id': id}));
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': e.toString()};
    }
  }
}
