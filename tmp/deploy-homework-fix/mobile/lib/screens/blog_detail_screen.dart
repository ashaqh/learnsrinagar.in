import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../services/blogs_service.dart';

class BlogDetailScreen extends StatefulWidget {
  final int blogId;
  const BlogDetailScreen({super.key, required this.blogId});

  @override
  State<BlogDetailScreen> createState() => _BlogDetailScreenState();
}

class _BlogDetailScreenState extends State<BlogDetailScreen> {
  final BlogsService _blogsService = BlogsService();
  Map<String, dynamic>? _blog;
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchBlogDetails();
  }

  Future<void> _fetchBlogDetails() async {
    final result = await _blogsService.getBlogDetails(widget.blogId);
    if (mounted) {
      setState(() {
        if (result['success']) {
          _blog = result['blog'];
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  Widget _buildImage(String? base64Str) {
    if (base64Str == null || base64Str.isEmpty) return const SizedBox.shrink();
    try {
      final String cleanBase64 = base64Str.split(',').last;
      final Uint8List bytes = base64Decode(cleanBase64);
      return Image.memory(bytes, height: 200, width: double.infinity, fit: BoxFit.cover);
    } catch (e) {
      return const SizedBox.shrink();
    }
  }

  String _stripHtml(String htmlString) {
    RegExp exp = RegExp(r"<[^>]*>", multiLine: true, caseSensitive: true);
    return htmlString.replaceAll(exp, '').replaceAll('&nbsp;', ' ');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Blog Details')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : _blog == null
                  ? const Center(child: Text('Blog not found'))
                  : SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          _buildImage(_blog!['cover_image']),
                          Padding(
                            padding: const EdgeInsets.all(16.0),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                  decoration: BoxDecoration(color: Colors.blue.withValues(alpha: 0.1), borderRadius: BorderRadius.circular(4)),
                                  child: Text(_blog!['category_name'] ?? 'Uncategorized', style: const TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(height: 16),
                                Text(
                                  _blog!['title'] ?? 'Untitled',
                                  style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
                                ),
                                const SizedBox(height: 16),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(children: [const Icon(Icons.person, size: 16, color: Colors.grey), const SizedBox(width: 4), Text(_blog!['author_name'] ?? 'Unknown', style: const TextStyle(color: Colors.grey))]),
                                    Row(children: [const Icon(Icons.calendar_today, size: 16, color: Colors.grey), const SizedBox(width: 4), Text(_blog!['publish_date']?.split('T')[0] ?? '', style: const TextStyle(color: Colors.grey))]),
                                  ],
                                ),
                                const Divider(height: 32),
                                SelectableText(
                                  _stripHtml(_blog!['content'] ?? ''),
                                  style: const TextStyle(fontSize: 16, height: 1.5),
                                ),
                              ],
                            ),
                          ),
                        ],
                      ),
                    ),
    );
  }
}
