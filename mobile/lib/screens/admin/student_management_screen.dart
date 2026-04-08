import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/student_service.dart';
import '../../services/admin_service.dart';
import '../../models/student_profile.dart';
import '../../models/class_model.dart';

class StudentManagementScreen extends StatefulWidget {
  const StudentManagementScreen({super.key});

  @override
  State<StudentManagementScreen> createState() => _StudentManagementScreenState();
}

class _StudentManagementScreenState extends State<StudentManagementScreen> {
  late StudentService _studentService;
  late AdminService _adminService;
  List<StudentProfile> _students = [];
  List<ClassModel> _classes = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _studentService = StudentService(token: token);
    _adminService = AdminService(token: token);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    try {
      final classes = await _adminService.getClasses();
      print('[StudentMgmt] classes loaded: ${classes.length}');
      final studentData = await _studentService.getStudents();
      print('[StudentMgmt] studentData: $studentData');
      
      if (mounted) {
        setState(() {
          _classes = classes;
          if (studentData['success'] == true && studentData['students'] != null) {
            _students = (studentData['students'] as List)
                .map((s) => StudentProfile.fromJson(s as Map<String, dynamic>))
                .toList();
          }
          _isLoading = false;
        });
      }
    } catch (e) {
      print('[StudentMgmt] Error loading data: $e');
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading students: $e')),
        );
      }
    }
  }

  void _showStudentDialog({StudentProfile? student}) {
    final nameController = TextEditingController(text: student?.name);
    final emailController = TextEditingController(text: student?.email);
    final passwordController = TextEditingController();
    final enrollController = TextEditingController(text: student?.enrollmentNo);
    final dobController = TextEditingController(text: student?.dateOfBirth);
    int? selectedClassId = student?.classId;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(student == null ? 'Add Student' : 'Edit Student', style: const TextStyle(fontWeight: FontWeight.bold)),
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
                    labelText: student == null ? 'Password' : 'New Password (optional)',
                    prefixIcon: const Icon(LucideIcons.lock, size: 20),
                  ),
                  obscureText: true,
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: enrollController,
                  decoration: const InputDecoration(labelText: 'Enrollment No', prefixIcon: Icon(LucideIcons.hash, size: 20)),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: dobController,
                  decoration: const InputDecoration(labelText: 'Date of Birth (YYYY-MM-DD)', prefixIcon: Icon(LucideIcons.calendar, size: 20)),
                  readOnly: true,
                  onTap: () async {
                    final picked = await showDatePicker(
                      context: context,
                      initialDate: DateTime.now().subtract(const Duration(days: 365 * 10)),
                      firstDate: DateTime(1900),
                      lastDate: DateTime.now(),
                    );
                    if (picked != null) {
                      setDialogState(() => dobController.text = picked.toString().split(' ')[0]);
                    }
                  },
                ),
                const SizedBox(height: 12),
                DropdownButtonFormField<int>(
                  value: selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class', prefixIcon: Icon(LucideIcons.graduation_cap, size: 20)),
                  items: _classes.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                  onChanged: (val) => setDialogState(() => selectedClassId = val),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty || emailController.text.isEmpty || selectedClassId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all required fields')));
                  return;
                }

                final data = {
                  if (student != null) 'id': student.id,
                  if (student != null) 'profile_id': student.profileId,
                  'name': nameController.text,
                  'email': emailController.text,
                  if (passwordController.text.isNotEmpty) 'password': passwordController.text,
                  'enrollment_no': enrollController.text,
                  'date_of_birth': dobController.text,
                  'class_id': selectedClassId,
                };

                final messenger = ScaffoldMessenger.of(context);
                final navigator = Navigator.of(context);
                final result = student == null 
                    ? await _studentService.createStudent(data)
                    : await _studentService.updateStudent(data);

                if (result['success'] == true) {
                  _loadData();
                  navigator.pop();
                  messenger.showSnackBar(SnackBar(content: Text(student == null ? 'Student created' : 'Student updated')));
                } else {
                  messenger.showSnackBar(SnackBar(content: Text(result['message'] ?? 'Operation failed')));
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              child: Text(student == null ? 'Create' : 'Update'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(StudentProfile student) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Student'),
        content: Text('Are you sure you want to delete ${student.name}? This will also remove parent links and attendance records.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              final result = await _studentService.deleteStudent(student.id);
              if (result['success'] == true) {
                _loadData();
                navigator.pop();
                messenger.showSnackBar(const SnackBar(content: Text('Student deleted')));
              } else {
                messenger.showSnackBar(SnackBar(content: Text(result['message'] ?? 'Delete failed')));
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Student Management', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _loadData,
              child: ListView.builder(
                padding: const EdgeInsets.all(16),
                itemCount: _students.length,
                itemBuilder: (context, index) {
                  final student = _students[index];
                  return Card(
                    elevation: 2,
                    margin: const EdgeInsets.only(bottom: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(16),
                      leading: CircleAvatar(
                        backgroundColor: Colors.indigo[50],
                        child: Text(student.name[0].toUpperCase(), style: const TextStyle(color: Colors.indigo, fontWeight: FontWeight.bold)),
                      ),
                      title: Text(student.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(student.email, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(color: Colors.indigo[50], borderRadius: BorderRadius.circular(4)),
                                child: Text(student.className ?? 'No Class', style: const TextStyle(fontSize: 11, color: Colors.indigo)),
                              ),
                              const SizedBox(width: 8),
                              Text('Roll: ${student.enrollmentNo ?? 'N/A'}', style: const TextStyle(fontSize: 11)),
                            ],
                          ),
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(icon: const Icon(LucideIcons.pencil, size: 20), onPressed: () => _showStudentDialog(student: student)),
                          IconButton(icon: const Icon(LucideIcons.trash_2, size: 20, color: Colors.red), onPressed: () => _confirmDelete(student)),
                        ],
                      ),
                    ),
                  );
                },
              ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showStudentDialog(),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        child: const Icon(LucideIcons.plus),
      ),
    );
  }
}
