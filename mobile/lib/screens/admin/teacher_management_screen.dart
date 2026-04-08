import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/admin_service.dart';
import '../../models/user.dart';
import '../../models/class_model.dart';
import '../../models/subject.dart';
import '../../models/teacher_assignment.dart';

class TeacherManagementScreen extends StatefulWidget {
  const TeacherManagementScreen({super.key});

  @override
  State<TeacherManagementScreen> createState() => _TeacherManagementScreenState();
}

class _TeacherManagementScreenState extends State<TeacherManagementScreen> {
  late AdminService _adminService;
  List<User> _teachers = [];
  List<ClassModel> _classes = [];
  List<Subject> _subjects = [];
  List<TeacherAssignment> _assignments = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _adminService = AdminService(token: token);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await _adminService.getTeachersData();
    if (mounted) {
      setState(() {
        _teachers = data['teachers'] ?? [];
        _classes = data['classes'] ?? [];
        _subjects = data['subjects'] ?? [];
        _assignments = data['assignments'] ?? [];
        _isLoading = false;
      });
    }
  }

  void _showTeacherDialog({User? teacher}) {
    final nameController = TextEditingController(text: teacher?.name);
    final emailController = TextEditingController(text: teacher?.email);
    final passwordController = TextEditingController();

    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(teacher == null ? 'Add Teacher' : 'Edit Teacher', style: const TextStyle(fontWeight: FontWeight.bold)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: nameController,
                decoration: const InputDecoration(labelText: 'Full Name', prefixIcon: Icon(LucideIcons.user, size: 20)),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: emailController,
                decoration: const InputDecoration(labelText: 'Email', prefixIcon: Icon(LucideIcons.mail, size: 20)),
                keyboardType: TextInputType.emailAddress,
              ),
              const SizedBox(height: 12),
              TextField(
                controller: passwordController,
                decoration: InputDecoration(
                  labelText: teacher == null ? 'Password' : 'New Password (optional)',
                  prefixIcon: const Icon(LucideIcons.lock, size: 20),
                ),
                obscureText: true,
              ),
            ],
          ),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty || emailController.text.isEmpty || (teacher == null && passwordController.text.isEmpty)) {
                ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all required fields')));
                return;
              }

              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              bool success;
              if (teacher == null) {
                final result = await _adminService.createTeacher(nameController.text, emailController.text, passwordController.text);
                success = result['success'] == true;
              } else {
                final result = await _adminService.updateTeacher(teacher.id, nameController.text, emailController.text, passwordController.text);
                success = result['success'] == true;
              }

              if (success) {
                _loadData();
                navigator.pop();
                messenger.showSnackBar(SnackBar(content: Text(teacher == null ? 'Teacher created' : 'Teacher updated')));
              } else {
                messenger.showSnackBar(const SnackBar(content: Text('Operation failed')));
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
            child: Text(teacher == null ? 'Create' : 'Update'),
          ),
        ],
      ),
    );
  }

  void _showAssignDialog(User teacher) {
    int? selectedClassId;
    int? selectedSubjectId;
    List<Subject> filteredSubjects = [];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text('Assign Subject to ${teacher.name}', style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 18)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              DropdownButtonFormField<int>(
                value: selectedClassId,
                decoration: const InputDecoration(labelText: 'Select Class'),
                items: _classes.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                onChanged: (val) {
                  setDialogState(() {
                    selectedClassId = val;
                    selectedSubjectId = null;
                    filteredSubjects = _subjects.where((s) => s.classId == val).toList();
                  });
                },
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                value: selectedSubjectId,
                decoration: const InputDecoration(labelText: 'Select Subject'),
                items: filteredSubjects.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                onChanged: selectedClassId == null ? null : (val) => setDialogState(() => selectedSubjectId = val),
              ),
            ],
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: selectedSubjectId == null
                  ? null
                  : () async {
                      final messenger = ScaffoldMessenger.of(context);
                      final navigator = Navigator.of(context);
                      final result = await _adminService.assignSubject(teacher.id, selectedSubjectId!, selectedClassId!);
                      if (result['success'] == true) {
                        _loadData();
                        navigator.pop();
                        messenger.showSnackBar(const SnackBar(content: Text('Subject assigned')));
                      } else {
                        messenger.showSnackBar(SnackBar(content: Text(result['message'] ?? 'Assignment failed')));
                      }
                    },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              child: const Text('Assign'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Manage Teachers', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _teachers.length,
                itemBuilder: (context, index) {
                  final teacher = _teachers[index];
                  final teacherAssignments = _assignments.where((a) => a.teacherId == teacher.id).toList();

                  return Card(
                    elevation: 2,
                    margin: const EdgeInsets.only(bottom: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: Padding(
                      padding: const EdgeInsets.all(16),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(teacher.name, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold)),
                                    Text(teacher.email, style: TextStyle(color: Colors.grey[600], fontSize: 14)),
                                  ],
                                ),
                              ),
                              Row(
                                children: [
                                  IconButton(icon: const Icon(LucideIcons.pencil, size: 20), onPressed: () => _showTeacherDialog(teacher: teacher)),
                                  IconButton(
                                    icon: const Icon(LucideIcons.trash_2, size: 20, color: Colors.red),
                                    onPressed: () => _confirmDelete(teacher),
                                  ),
                                ],
                              ),
                            ],
                          ),
                          const Divider(),
                          const Text('Assigned Subjects:', style: TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
                          const SizedBox(height: 8),
                          Wrap(
                            spacing: 8,
                            runSpacing: 4,
                            children: [
                              ...teacherAssignments.map((a) => Chip(
                                    label: Text('${a.subjectName} (${a.className})', style: const TextStyle(fontSize: 11)),
                                    backgroundColor: Colors.indigo[50],
                                    onDeleted: () async {
                                      final result = await _adminService.removeAssignment(a.id);
                                      if (result['success'] == true) _loadData();
                                    },
                                    deleteIcon: const Icon(LucideIcons.x, size: 14, color: Colors.red),
                                    padding: EdgeInsets.zero,
                                    visualDensity: VisualDensity.compact,
                                  )),
                              ActionChip(
                                avatar: const Icon(LucideIcons.plus, size: 14, color: Colors.white),
                                label: const Text('Assign', style: TextStyle(fontSize: 11, color: Colors.white)),
                                backgroundColor: Colors.indigo,
                                onPressed: () => _showAssignDialog(teacher),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showTeacherDialog(),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        child: const Icon(LucideIcons.plus),
      ),
    );
  }

  void _confirmDelete(User teacher) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Teacher'),
        content: Text('Are you sure you want to delete ${teacher.name}? This will also remove all their assignments.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              final result = await _adminService.deleteTeacher(teacher.id);
              if (result['success'] == true) {
                _loadData();
                navigator.pop();
                messenger.showSnackBar(const SnackBar(content: Text('Teacher deleted')));
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
