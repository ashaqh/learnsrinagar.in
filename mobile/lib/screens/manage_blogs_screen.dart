import 'dart:convert';
import 'dart:typed_data';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/blogs_service.dart';
import 'manage_blog_form_screen.dart';

class ManageBlogsScreen extends StatefulWidget {
  const ManageBlogsScreen({super.key});

  @override
  State<ManageBlogsScreen> createState() => _ManageBlogsScreenState();
}

class _ManageBlogsScreenState extends State<ManageBlogsScreen> with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final BlogsService _blogsService = BlogsService();
  
  List<dynamic> _blogs = [];
  List<dynamic> _categories = [];
  bool _isLoadingBlogs = true;
  bool _isLoadingCategories = true;
  String? _blogsError;
  String? _categoriesError;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    _tabController.addListener(() {
      setState(() {}); // To update FAB
    });
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    _fetchBlogs();
    _fetchCategories();
  }

  Future<void> _fetchBlogs() async {
    setState(() => _isLoadingBlogs = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    final result = await _blogsService.getAdminBlogs(token);
    if (mounted) {
      setState(() {
        if (result['success']) {
          _blogs = result['blogs'] ?? [];
          _blogsError = null;
        } else {
          _blogsError = result['message'];
        }
        _isLoadingBlogs = false;
      });
    }
  }

  Future<void> _fetchCategories() async {
    setState(() => _isLoadingCategories = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    final result = await _blogsService.getCategories(token);
    if (mounted) {
      setState(() {
        if (result['success']) {
          _categories = result['categories'] ?? [];
          _categoriesError = null;
        } else {
          _categoriesError = result['message'];
        }
        _isLoadingCategories = false;
      });
    }
  }

  Future<void> _deleteBlog(int id) async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Blog'),
        content: const Text('Are you sure you want to delete this blog post?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final result = await _blogsService.deleteBlog(token, id);
      if (mounted && result['success']) {
        _fetchBlogs();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Blog deleted')));
      }
    }
  }

  Future<void> _showCategoryDialog([Map<String, dynamic>? category]) async {
    final nameController = TextEditingController(text: category?['name'] ?? '');
    final descController = TextEditingController(text: category?['description'] ?? '');
    final isEditing = category != null;

    final result = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(isEditing ? 'Edit Category' : 'Add Category'),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: nameController,
              decoration: const InputDecoration(labelText: 'Name', hintText: 'e.g. Announcements'),
              autofocus: true,
            ),
            const SizedBox(height: 12),
            TextField(
              controller: descController,
              decoration: const InputDecoration(labelText: 'Description (Optional)'),
              maxLines: 2,
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1)),
            child: Text(isEditing ? 'Update' : 'Create', style: const TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (result == true && nameController.text.isNotEmpty) {
      final token = Provider.of<AuthProvider>(context, listen: false).token;
      if (token == null) return;

      final response = isEditing
          ? await _blogsService.updateCategory(token, category['id'], nameController.text, descController.text)
          : await _blogsService.createCategory(token, nameController.text, descController.text);

      if (mounted) {
        if (response['success']) {
          _fetchCategories();
          ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Category saved')));
        } else {
          ScaffoldMessenger.of(context).showSnackBar(
            SnackBar(content: Text(response['message'] ?? 'Failed to save category'), backgroundColor: Colors.red),
          );
        }
      }
    }
  }

  Future<void> _deleteCategory(int id) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Category'),
        content: const Text('Delete this category? Linked blogs may become uncategorized.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () => Navigator.pop(context, true),
            style: ElevatedButton.styleFrom(backgroundColor: Colors.red),
            child: const Text('Delete', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final token = Provider.of<AuthProvider>(context, listen: false).token;
      if (token == null) return;

      final result = await _blogsService.deleteCategory(token, id);
      if (mounted && result['success']) {
        _fetchCategories();
        ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Category deleted')));
      }
    }
  }

  Widget _buildThumbnail(String? base64Str) {
    if (base64Str == null || base64Str.isEmpty) {
      return Container(
        width: 50, height: 50,
        decoration: BoxDecoration(color: Colors.grey[100], borderRadius: BorderRadius.circular(8)),
        child: Icon(LucideIcons.image, size: 20, color: Colors.grey[400]),
      );
    }
    try {
      final String cleanBase64 = base64Str.split(',').last;
      final Uint8List bytes = base64Decode(cleanBase64);
      return ClipRRect(
        borderRadius: BorderRadius.circular(8),
        child: Image.memory(bytes, width: 50, height: 50, fit: BoxFit.cover),
      );
    } catch (e) {
      return Container(width: 50, height: 50, child: Icon(LucideIcons.image_off));
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: const Text('Blog Management', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        bottom: TabBar(
          controller: _tabController,
          labelColor: const Color(0xFF6366F1),
          unselectedLabelColor: Colors.grey,
          indicatorColor: const Color(0xFF6366F1),
          tabs: const [
            Tab(text: 'All Blogs'),
            Tab(text: 'Categories'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _buildBlogsTab(),
          _buildCategoriesTab(),
        ],
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          if (_tabController.index == 0) {
            final created = await Navigator.push(context, MaterialPageRoute(builder: (_) => const ManageBlogFormScreen()));
            if (created == true) _fetchBlogs();
          } else {
            _showCategoryDialog();
          }
        },
        label: Text(_tabController.index == 0 ? 'New Blog' : 'New Category'),
        icon: const Icon(LucideIcons.plus),
        backgroundColor: const Color(0xFF6366F1),
      ),
    );
  }

  Widget _buildBlogsTab() {
    if (_isLoadingBlogs) return const Center(child: CircularProgressIndicator());
    if (_blogsError != null) return Center(child: Text(_blogsError!));
    if (_blogs.isEmpty) return const Center(child: Text('No blogs found'));

    return RefreshIndicator(
      onRefresh: _fetchBlogs,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _blogs.length,
        separatorBuilder: (_, __) => const SizedBox(height: 12),
        itemBuilder: (context, index) {
          final blog = _blogs[index];
          return Container(
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: Colors.grey[100]!),
              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
            ),
            child: Row(
              children: [
                _buildThumbnail(blog['thumbnail_image']),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(blog['title'] ?? 'Untitled', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 14), maxLines: 1, overflow: TextOverflow.ellipsis),
                      const SizedBox(height: 4),
                      Text(blog['category_name'] ?? 'Uncategorized', style: TextStyle(color: Colors.indigo[400], fontSize: 11, fontWeight: FontWeight.w600)),
                    ],
                  ),
                ),
                Row(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    IconButton(
                      icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blue),
                      onPressed: () async {
                        final updated = await Navigator.push(context, MaterialPageRoute(builder: (_) => ManageBlogFormScreen(blog: blog)));
                        if (updated == true) _fetchBlogs();
                      },
                    ),
                    IconButton(
                      icon: const Icon(LucideIcons.trash_2, size: 18, color: Colors.red),
                      onPressed: () => _deleteBlog(blog['id']),
                    ),
                  ],
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  Widget _buildCategoriesTab() {
    if (_isLoadingCategories) return const Center(child: CircularProgressIndicator());
    if (_categoriesError != null) return Center(child: Text(_categoriesError!));
    if (_categories.isEmpty) return const Center(child: Text('No categories found'));

    return RefreshIndicator(
      onRefresh: _fetchCategories,
      child: ListView.separated(
        padding: const EdgeInsets.all(16),
        itemCount: _categories.length,
        separatorBuilder: (_, __) => const SizedBox(height: 8),
        itemBuilder: (context, index) {
          final cat = _categories[index];
          return ListTile(
            contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 4),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12), side: BorderSide(color: Colors.grey[100]!)),
            leading: Icon(LucideIcons.tag, size: 20, color: Colors.indigo[300]),
            title: Text(cat['name'] ?? 'Untitled', style: const TextStyle(fontWeight: FontWeight.w600)),
            subtitle: cat['description'] != null ? Text(cat['description'], maxLines: 1, overflow: TextOverflow.ellipsis) : null,
            trailing: Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                IconButton(icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blue), onPressed: () => _showCategoryDialog(cat)),
                IconButton(icon: const Icon(LucideIcons.trash_2, size: 18, color: Colors.red), onPressed: () => _deleteCategory(cat['id'])),
              ],
            ),
          );
        },
      ),
    );
  }
}
