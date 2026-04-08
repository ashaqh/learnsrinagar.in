import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import '../services/blogs_service.dart';
import 'blog_detail_screen.dart';

class BlogsScreen extends StatefulWidget {
  const BlogsScreen({super.key});

  @override
  State<BlogsScreen> createState() => _BlogsScreenState();
}

class _BlogsScreenState extends State<BlogsScreen> {
  final BlogsService _blogsService = BlogsService();
  List<dynamic> _blogs = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchBlogs();
  }

  Future<void> _fetchBlogs() async {
    final result = await _blogsService.getBlogs();
    if (mounted) {
      setState(() {
        if (result['success']) {
          _blogs = result['blogs'] ?? [];
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  Widget _buildImage(String? base64Str) {
    if (base64Str == null || base64Str.isEmpty) {
      return Container(color: Colors.grey[300], height: 150, width: double.infinity, child: const Icon(Icons.image, size: 50, color: Colors.grey));
    }
    try {
      final String cleanBase64 = base64Str.split(',').last;
      final Uint8List bytes = base64Decode(cleanBase64);
      return Image.memory(bytes, height: 150, width: double.infinity, fit: BoxFit.cover);
    } catch (e) {
      return Container(color: Colors.grey[300], height: 150, width: double.infinity, child: const Icon(Icons.broken_image, size: 50, color: Colors.grey));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Blogs'),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : _blogs.isEmpty
                  ? const Center(child: Text('No blogs found.'))
                  : RefreshIndicator(
                      onRefresh: _fetchBlogs,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _blogs.length,
                        itemBuilder: (context, index) {
                          final blog = _blogs[index];
                          return Card(
                            margin: const EdgeInsets.only(bottom: 16),
                            clipBehavior: Clip.antiAlias,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                            child: InkWell(
                              onTap: () {
                                Navigator.push(
                                  context,
                                  MaterialPageRoute(builder: (_) => BlogDetailScreen(blogId: blog['id'])),
                                );
                              },
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  _buildImage(blog['thumbnail_image']),
                                  Padding(
                                    padding: const EdgeInsets.all(16.0),
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                          decoration: BoxDecoration(color: Colors.blue.withOpacity(0.1), borderRadius: BorderRadius.circular(4)),
                                          child: Text(blog['category_name'] ?? 'Uncategorized', style: const TextStyle(color: Colors.blue, fontSize: 12, fontWeight: FontWeight.bold)),
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          blog['title'] ?? 'Untitled',
                                          style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 8),
                                        Text(
                                          blog['short_desc'] ?? '',
                                          style: TextStyle(color: Colors.grey[600], fontSize: 14),
                                          maxLines: 3,
                                          overflow: TextOverflow.ellipsis,
                                        ),
                                        const SizedBox(height: 16),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Row(children: [const Icon(Icons.person, size: 14, color: Colors.grey), const SizedBox(width: 4), Text(blog['author_name'] ?? 'Unknown', style: const TextStyle(fontSize: 12, color: Colors.grey))]),
                                            Row(children: [const Icon(Icons.calendar_today, size: 14, color: Colors.grey), const SizedBox(width: 4), Text(blog['publish_date']?.split('T')[0] ?? '', style: const TextStyle(fontSize: 12, color: Colors.grey))]),
                                          ],
                                        )
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          );
                        },
                      ),
                    ),
    );
  }
}
