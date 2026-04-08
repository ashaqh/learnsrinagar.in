import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/homework_service.dart';

class HomeworkScreen extends StatefulWidget {
  final int? classId; // For teachers to filter by class
  const HomeworkScreen({super.key, this.classId});

  @override
  State<HomeworkScreen> createState() => _HomeworkScreenState();
}

class _HomeworkScreenState extends State<HomeworkScreen> {
  final _homeworkService = HomeworkService();
  List<dynamic> _homeworkList = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchHomework();
  }

  Future<void> _fetchHomework() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      int? targetId;
      if (auth.user?.roleName == 'parent' && auth.user!.studentIds.isNotEmpty) {
        targetId = auth.user!.studentIds.first;
      } else if (auth.user?.roleName == 'student') {
        targetId = auth.user!.id;
      }

      final result = await _homeworkService.getHomework(auth.token!,
          classId: widget.classId, studentId: targetId);

      if (mounted) {
        setState(() {
          if (result['success'] == true) {
            _homeworkList = result['homework'] ?? [];
          } else {
            _errorMessage = result['message']?.toString() ?? 'Failed to load homework';
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error loading homework: $e';
          _isLoading = false;
        });
      }
    }
  }

  String _formatDate(dynamic date) {
    if (date == null) return 'N/A';
    try {
      final dt = DateTime.parse(date.toString());
      return DateFormat('MMM dd, yyyy').format(dt);
    } catch (_) {
      return date.toString().split('T')[0];
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;
    final isTeacher = user?.roleName == 'teacher';
    final isSchoolAdmin = user?.roleName == 'school_admin';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Homework'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          if (isTeacher)
            IconButton(
              icon: const Icon(LucideIcons.plus),
              onPressed: () => _showCreateHomeworkDialog(),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.circle_alert,
                          size: 48, color: Colors.red.shade300),
                      const SizedBox(height: 16),
                      Padding(
                        padding: const EdgeInsets.symmetric(horizontal: 32),
                        child: Text(
                          _errorMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.red.shade700),
                        ),
                      ),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _fetchHomework,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : _homeworkList.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.book_open,
                              size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            'No homework assignments found',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    )
                  : RefreshIndicator(
                      onRefresh: _fetchHomework,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _homeworkList.length,
                        itemBuilder: (context, index) {
                          final item = _homeworkList[index];
                          final isLatest = index == 0;
                          return _buildHomeworkCard(
                              item, isLatest, isTeacher, isSchoolAdmin);
                        },
                      ),
                    ),
    );
  }

  Widget _buildHomeworkCard(
      dynamic item, bool isLatest, bool isTeacher, bool isSchoolAdmin) {
    final title = item['title']?.toString() ?? 'Untitled';
    final description = item['description']?.toString() ?? 'No description';
    final subjectName = item['subject_name']?.toString() ?? '';
    final className = item['class_name']?.toString() ?? '';
    final teacherName = item['teacher_name']?.toString() ?? '';
    final createdAt = _formatDate(item['created_at']);

    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      elevation: isLatest ? 3 : 1,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: isLatest
            ? BorderSide(color: Colors.indigo.shade300, width: 2)
            : BorderSide.none,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Header with highlight for latest
          if (isLatest)
            Container(
              width: double.infinity,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 6),
              decoration: BoxDecoration(
                color: Colors.indigo.shade50,
                borderRadius: const BorderRadius.only(
                  topLeft: Radius.circular(12),
                  topRight: Radius.circular(12),
                ),
              ),
              child: Row(
                children: [
                  Icon(LucideIcons.star, size: 14, color: Colors.indigo.shade600),
                  const SizedBox(width: 6),
                  Text(
                    'Latest',
                    style: TextStyle(
                      color: Colors.indigo.shade600,
                      fontSize: 12,
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ],
              ),
            ),

          // Main content as expansion tile
          ExpansionTile(
            tilePadding: const EdgeInsets.symmetric(horizontal: 16),
            childrenPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
            title: Text(
              title,
              style: const TextStyle(
                fontWeight: FontWeight.w600,
                fontSize: 15,
              ),
            ),
            subtitle: Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Wrap(
                spacing: 8,
                children: [
                  if (subjectName.isNotEmpty)
                    _buildTag(subjectName, Colors.blue),
                  if (className.isNotEmpty)
                    _buildTag('Class $className', Colors.teal),
                  _buildTag(createdAt, Colors.grey),
                ],
              ),
            ),
            initiallyExpanded: isLatest,
            children: [
              const Divider(),
              const SizedBox(height: 8),
              // Description
              Text(
                description,
                style: const TextStyle(fontSize: 14, height: 1.5),
              ),
              const SizedBox(height: 12),
              // Teacher info
              if (teacherName.isNotEmpty)
                Row(
                  children: [
                    Icon(LucideIcons.user, size: 14, color: Colors.grey.shade500),
                    const SizedBox(width: 6),
                    Text(
                      'Assigned by: $teacherName',
                      style: TextStyle(
                        fontStyle: FontStyle.italic,
                        color: Colors.grey.shade600,
                        fontSize: 13,
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTag(String text, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.shade200),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w500,
          color: color.shade700,
        ),
      ),
    );
  }

  void _showCreateHomeworkDialog() {
    final titleController = TextEditingController();
    final descController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Create Homework'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                  controller: titleController,
                  decoration: const InputDecoration(labelText: 'Title')),
              TextField(
                  controller: descController,
                  decoration: const InputDecoration(labelText: 'Description'),
                  maxLines: 3),
            ],
          ),
        ),
        actions: [
          TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (titleController.text.isEmpty || widget.classId == null) return;
              final auth =
                  Provider.of<AuthProvider>(context, listen: false);
              final result = await _homeworkService.createHomework(
                auth.token!,
                widget.classId!,
                1, // Subject ID - should come from selection
                titleController.text,
                descController.text,
                DateTime.now().toString().split(' ')[0],
              );
              if (mounted) {
                Navigator.pop(context);
                ScaffoldMessenger.of(context).showSnackBar(
                    SnackBar(content: Text(result['message'])));
                _fetchHomework();
              }
            },
            child: const Text('Create'),
          ),
        ],
      ),
    );
  }
}
