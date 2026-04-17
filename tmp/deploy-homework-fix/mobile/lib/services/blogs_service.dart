import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

class BlogsService {
  final String baseUrl = AppConfig.apiBaseUrl;

  Future<Map<String, dynamic>> getBlogs() async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/blogs'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Failed to load blogs'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> getBlogDetails(int id) async {
    try {
      final response = await http.get(Uri.parse('$baseUrl/blog/$id'));
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Failed to load blog details'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  // Admin CRUD Methods
  Future<Map<String, dynamic>> getAdminBlogs(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/blogs'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Failed to load admin blogs'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> createBlog(String token, Map<String, dynamic> blogData) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/blogs'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode(blogData),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> updateBlog(String token, Map<String, dynamic> blogData) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/admin/blogs'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode(blogData),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> deleteBlog(String token, int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/admin/blogs'),
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

  // Categories
  Future<Map<String, dynamic>> getCategories(String token) async {
    try {
      final response = await http.get(
        Uri.parse('$baseUrl/admin/blog-categories'),
        headers: {'Authorization': 'Bearer $token'},
      );
      if (response.statusCode == 200) {
        return jsonDecode(response.body);
      }
      return {'success': false, 'message': 'Failed to load categories'};
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> createCategory(String token, String name, String? description) async {
    try {
      final response = await http.post(
        Uri.parse('$baseUrl/admin/blog-categories'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode({'name': name, 'description': description}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> updateCategory(String token, int id, String name, String? description) async {
    try {
      final response = await http.put(
        Uri.parse('$baseUrl/admin/blog-categories'),
        headers: {
          'Authorization': 'Bearer $token',
          'Content-Type': 'application/json'
        },
        body: jsonEncode({'id': id, 'name': name, 'description': description}),
      );
      return jsonDecode(response.body);
    } catch (e) {
      return {'success': false, 'message': 'Network error: $e'};
    }
  }

  Future<Map<String, dynamic>> deleteCategory(String token, int id) async {
    try {
      final response = await http.delete(
        Uri.parse('$baseUrl/admin/blog-categories'),
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
