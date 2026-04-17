import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:image_picker/image_picker.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/blogs_service.dart';

class ManageBlogFormScreen extends StatefulWidget {
  final Map<String, dynamic>? blog;
  final int? initialCategoryId;
  const ManageBlogFormScreen({super.key, this.blog, this.initialCategoryId});

  @override
  State<ManageBlogFormScreen> createState() => _ManageBlogFormScreenState();
}

class _ManageBlogFormScreenState extends State<ManageBlogFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _blogsService = BlogsService();
  final _picker = ImagePicker();

  late TextEditingController _titleController;
  late TextEditingController _shortDescController;
  late TextEditingController _contentController;
  late TextEditingController _dateController;
  
  int? _selectedCategoryId;
  List<dynamic> _categories = [];
  String? _thumbnailBase64;
  String? _coverBase64;
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.blog?['title'] ?? '');
    _shortDescController = TextEditingController(text: widget.blog?['short_desc'] ?? '');
    _contentController = TextEditingController(text: widget.blog?['content'] ?? '');
    _dateController = TextEditingController(text: widget.blog?['publish_date']?.split('T')[0] ?? DateTime.now().toString().split(' ')[0]);
    _selectedCategoryId = widget.blog?['category_id'] ?? widget.initialCategoryId;
    _thumbnailBase64 = widget.blog?['thumbnail_image'];
    _coverBase64 = widget.blog?['cover_image'];
    _fetchCategories();
  }

  Future<void> _fetchCategories() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;
    final result = await _blogsService.getCategories(token);
    if (mounted && result['success']) {
      setState(() {
        _categories = result['categories'];
        // Only set default if not already set by initialCategoryId or existing blog
        if (_selectedCategoryId == null && _categories.isNotEmpty) {
          _selectedCategoryId = _categories[0]['id'];
        }
      });
    }
  }

  Future<void> _pickImage(bool isThumbnail) async {
    final XFile? image = await _picker.pickImage(source: ImageSource.gallery, maxWidth: 1024, imageQuality: 85);
    if (image != null) {
      final bytes = await image.readAsBytes();
      setState(() {
        if (isThumbnail) {
          _thumbnailBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        } else {
          _coverBase64 = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        }
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    if (_selectedCategoryId == null) {
      ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please select a category')));
      return;
    }

    setState(() => _isSaving = true);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    
    final blogData = {
      if (widget.blog != null) 'id': widget.blog!['id'],
      'title': _titleController.text,
      'category_id': _selectedCategoryId,
      'short_desc': _shortDescController.text,
      'content': _contentController.text,
      'publish_date': _dateController.text,
      'thumbnail_image': _thumbnailBase64,
      'cover_image': _coverBase64,
    };

    final result = widget.blog == null 
      ? await _blogsService.createBlog(token!, blogData)
      : await _blogsService.updateBlog(token!, blogData);

    if (mounted) {
      setState(() => _isSaving = false);
      if (result['success']) {
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Error saving blog')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      appBar: AppBar(
        title: Text(widget.blog == null ? 'Create Blog' : 'Edit Blog', style: const TextStyle(color: Colors.black87)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              _buildSectionTitle('Basic Information'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _titleController,
                decoration: _inputDecoration('Blog Title', LucideIcons.heading),
                validator: (v) => v?.isEmpty == true ? 'Title is required' : null,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                initialValue: _selectedCategoryId,
                decoration: _inputDecoration('Category', LucideIcons.tag),
                items: _categories.map((c) => DropdownMenuItem<int>(value: c['id'], child: Text(c['name']))).toList(),
                onChanged: (v) => setState(() => _selectedCategoryId = v),
              ),
              const SizedBox(height: 24),
              _buildSectionTitle('Description & Content'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _shortDescController,
                decoration: _inputDecoration('Short Description', LucideIcons.list_minus),
                maxLines: 2,
              ),
              const SizedBox(height: 16),
              TextFormField(
                controller: _contentController,
                decoration: _inputDecoration('Detailed Content (HTML/Markdown)', LucideIcons.file_text),
                maxLines: 10,
              ),
              const SizedBox(height: 24),
              _buildSectionTitle('Publishing'),
              const SizedBox(height: 12),
              TextFormField(
                controller: _dateController,
                readOnly: true,
                decoration: _inputDecoration('Publish Date', LucideIcons.calendar),
                onTap: () async {
                  final date = await showDatePicker(
                    context: context,
                    initialDate: DateTime.now(),
                    firstDate: DateTime(2020),
                    lastDate: DateTime(2030),
                  );
                  if (date != null) {
                    setState(() {
                      _dateController.text = date.toString().split(' ')[0];
                    });
                  }
                },
              ),
              const SizedBox(height: 24),
              _buildSectionTitle('Media Assets'),
              const SizedBox(height: 12),
              Row(
                children: [
                   Expanded(
                    child: _buildImagePickerTile(
                      label: 'Thumbnail',
                      hasImage: _thumbnailBase64 != null,
                      onTap: () => _pickImage(true),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: _buildImagePickerTile(
                      label: 'Cover Image',
                      hasImage: _coverBase64 != null,
                      onTap: () => _pickImage(false),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 40),
              ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF6366F1),
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 18),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  elevation: 0,
                ),
                child: Center(
                  child: _isSaving 
                    ? const SizedBox(height: 20, width: 20, child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2))
                    : const Text('Save Blog Post', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionTitle(String title) {
    return Text(
      title,
      style: TextStyle(color: Colors.grey[800], fontSize: 13, fontWeight: FontWeight.w600, letterSpacing: 0.5),
    );
  }

  InputDecoration _inputDecoration(String label, IconData icon) {
    return InputDecoration(
      labelText: label,
      prefixIcon: Icon(icon, size: 20),
      border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[300]!)),
      enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide(color: Colors.grey[200]!)),
      focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Color(0xFF6366F1), width: 2)),
      filled: true,
      fillColor: Colors.grey[50],
      contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
    );
  }

  Widget _buildImagePickerTile({required String label, required bool hasImage, required VoidCallback onTap}) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(12),
      child: Container(
        padding: const EdgeInsets.symmetric(vertical: 20),
        decoration: BoxDecoration(
          color: hasImage ? Colors.green[50] : Colors.grey[50],
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: hasImage ? Colors.green[200]! : Colors.grey[300]!),
        ),
        child: Column(
          children: [
            Icon(
              hasImage ? Icons.check_circle : LucideIcons.upload,
              color: hasImage ? Colors.green[700] : Colors.grey[600],
            ),
            const SizedBox(height: 8),
            Text(
              label,
              style: TextStyle(
                color: hasImage ? Colors.green[700] : Colors.grey[700],
                fontSize: 12,
                fontWeight: FontWeight.w500,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
