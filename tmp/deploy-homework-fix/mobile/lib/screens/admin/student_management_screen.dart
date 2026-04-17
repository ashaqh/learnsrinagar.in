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
  List<Map<String, dynamic>> _parents = [];
  Map<int, List<Map<String, dynamic>>> _studentParentLinks = {};
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
      final studentData = await _studentService.getStudents();

      if (mounted) {
        final rawLinks =
            Map<String, dynamic>.from(studentData['studentParentLinks'] ?? {});

        final parentLinks = <int, List<Map<String, dynamic>>>{};
        rawLinks.forEach((key, value) {
          final studentId = int.tryParse(key.toString());
          if (studentId == null) return;

          parentLinks[studentId] = (value as List)
              .map((item) => Map<String, dynamic>.from(item as Map))
              .toList();
        });

        setState(() {
          _classes = classes;
          _parents = (studentData['parents'] as List? ?? [])
              .map((parent) => Map<String, dynamic>.from(parent as Map))
              .toList();
          _studentParentLinks = parentLinks;

          if (studentData['success'] == true && studentData['students'] != null) {
            _students = (studentData['students'] as List)
                .map((student) => StudentProfile.fromJson(student as Map<String, dynamic>))
                .toList();
          } else {
            _students = [];
          }

          _isLoading = false;
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error loading students: $e')),
        );
      }
    }
  }

  List<Map<String, dynamic>> _linkedParentsForStudent(int studentId) {
    return _studentParentLinks[studentId] ?? const [];
  }

  void _showStudentDialog({StudentProfile? student}) {
    final nameController = TextEditingController(text: student?.name);
    final emailController = TextEditingController(text: student?.email);
    final passwordController = TextEditingController();
    final enrollController = TextEditingController(text: student?.enrollmentNo);
    final dobController = TextEditingController(text: student?.dateOfBirth);
    final parentNameController = TextEditingController();
    final parentEmailController = TextEditingController();
    final parentPasswordController = TextEditingController();

    int? selectedClassId = student?.classId;
    bool addParent = false;
    bool useExistingParent = false;
    String? selectedExistingParentId;
    final linkedParents =
        student != null ? _linkedParentsForStudent(student.id) : const <Map<String, dynamic>>[];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(
            student == null ? 'Add Student' : 'Edit Student',
            style: const TextStyle(fontWeight: FontWeight.bold),
          ),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(
                    labelText: 'Full Name',
                    prefixIcon: Icon(LucideIcons.user, size: 20),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(LucideIcons.mail, size: 20),
                  ),
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
                  decoration: const InputDecoration(
                    labelText: 'Enrollment No',
                    prefixIcon: Icon(LucideIcons.hash, size: 20),
                  ),
                ),
                const SizedBox(height: 12),
                TextField(
                  controller: dobController,
                  decoration: const InputDecoration(
                    labelText: 'Date of Birth (YYYY-MM-DD)',
                    prefixIcon: Icon(LucideIcons.calendar, size: 20),
                  ),
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
                  initialValue: selectedClassId,
                  decoration: const InputDecoration(
                    labelText: 'Class',
                    prefixIcon: Icon(LucideIcons.graduation_cap, size: 20),
                  ),
                  items: _classes
                      .map((classItem) => DropdownMenuItem(
                            value: classItem.id,
                            child: Text(classItem.name),
                          ))
                      .toList(),
                  onChanged: (value) => setDialogState(() => selectedClassId = value),
                ),
                const SizedBox(height: 20),
                const Divider(),
                if (linkedParents.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(
                    'Linked Parents',
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w600,
                        ),
                  ),
                  const SizedBox(height: 8),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: linkedParents
                        .map(
                          (parent) => Chip(
                            label: Text(
                              '${parent['parent_name']} (${parent['parent_email']})',
                            ),
                          ),
                        )
                        .toList(),
                  ),
                  const SizedBox(height: 8),
                ],
                CheckboxListTile(
                  value: addParent,
                  contentPadding: EdgeInsets.zero,
                  title: const Text('Add parent information'),
                  onChanged: (value) {
                    setDialogState(() {
                      addParent = value ?? false;
                      if (!addParent) {
                        useExistingParent = false;
                        selectedExistingParentId = null;
                        parentNameController.clear();
                        parentEmailController.clear();
                        parentPasswordController.clear();
                      }
                    });
                  },
                ),
                if (addParent) ...[
                  CheckboxListTile(
                    value: useExistingParent,
                    contentPadding: EdgeInsets.zero,
                    title: const Text('Use existing parent'),
                    onChanged: (value) {
                      setDialogState(() {
                        useExistingParent = value ?? false;
                        selectedExistingParentId = null;
                      });
                    },
                  ),
                  if (useExistingParent) ...[
                    const SizedBox(height: 8),
                    DropdownButtonFormField<String>(
                      initialValue: selectedExistingParentId,
                      decoration: const InputDecoration(
                        labelText: 'Select Parent',
                        prefixIcon: Icon(LucideIcons.users, size: 20),
                      ),
                      items: _parents
                          .map(
                            (parent) => DropdownMenuItem(
                              value: parent['id'].toString(),
                              child: Text('${parent['name']} (${parent['email']})'),
                            ),
                          )
                          .toList(),
                      onChanged: (value) =>
                          setDialogState(() => selectedExistingParentId = value),
                    ),
                  ] else ...[
                    const SizedBox(height: 8),
                    TextField(
                      controller: parentNameController,
                      decoration: const InputDecoration(
                        labelText: 'Parent Name',
                        prefixIcon: Icon(LucideIcons.user, size: 20),
                      ),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: parentEmailController,
                      decoration: const InputDecoration(
                        labelText: 'Parent Email',
                        prefixIcon: Icon(LucideIcons.mail, size: 20),
                      ),
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      controller: parentPasswordController,
                      decoration: InputDecoration(
                        labelText:
                            student == null ? 'Parent Password' : 'Parent Password (optional)',
                        prefixIcon: const Icon(LucideIcons.lock, size: 20),
                      ),
                      obscureText: true,
                    ),
                  ],
                ],
              ],
            ),
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(context),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty ||
                    emailController.text.isEmpty ||
                    enrollController.text.isEmpty ||
                    dobController.text.isEmpty ||
                    selectedClassId == null ||
                    (student == null && passwordController.text.isEmpty)) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please fill all required fields')),
                  );
                  return;
                }

                if (addParent && useExistingParent && selectedExistingParentId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please select an existing parent')),
                  );
                  return;
                }

                if (addParent &&
                    !useExistingParent &&
                    (parentNameController.text.isEmpty ||
                        parentEmailController.text.isEmpty ||
                        (student == null && parentPasswordController.text.isEmpty))) {
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('Please complete the parent details')),
                  );
                  return;
                }

                final data = <String, dynamic>{
                  if (student != null) 'id': student.id,
                  if (student != null) 'profile_id': student.profileId,
                  'name': nameController.text,
                  'email': emailController.text,
                  if (passwordController.text.isNotEmpty) 'password': passwordController.text,
                  'enrollment_no': enrollController.text,
                  'date_of_birth': dobController.text,
                  'class_id': selectedClassId,
                  'add_parent': addParent,
                  if (addParent && useExistingParent && selectedExistingParentId != null)
                    'existing_parent_id': int.tryParse(selectedExistingParentId!),
                  if (addParent && !useExistingParent) 'parent_name': parentNameController.text,
                  if (addParent && !useExistingParent) 'parent_email': parentEmailController.text,
                  if (addParent && !useExistingParent && parentPasswordController.text.isNotEmpty)
                    'parent_password': parentPasswordController.text,
                };

                final messenger = ScaffoldMessenger.of(context);
                final navigator = Navigator.of(context);
                final result = student == null
                    ? await _studentService.createStudent(data)
                    : await _studentService.updateStudent(data);

                if (result['success'] == true) {
                  await _loadData();
                  if (!mounted) return;
                  navigator.pop();
                  messenger.showSnackBar(
                    SnackBar(
                      content: Text(student == null ? 'Student created' : 'Student updated'),
                    ),
                  );
                } else {
                  messenger.showSnackBar(
                    SnackBar(content: Text(result['message'] ?? 'Operation failed')),
                  );
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.indigo,
                foregroundColor: Colors.white,
              ),
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
        content: Text(
          'Are you sure you want to delete ${student.name}? This will also remove parent links and attendance records.',
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(context),
            child: const Text('Cancel'),
          ),
          TextButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              final result = await _studentService.deleteStudent(student.id);
              if (result['success'] == true) {
                await _loadData();
                if (!mounted) return;
                navigator.pop();
                messenger.showSnackBar(const SnackBar(content: Text('Student deleted')));
              } else {
                messenger.showSnackBar(
                  SnackBar(content: Text(result['message'] ?? 'Delete failed')),
                );
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
        title: const Text(
          'Student Management',
          style: TextStyle(fontWeight: FontWeight.bold),
        ),
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
                  final linkedParents = _linkedParentsForStudent(student.id);

                  return Card(
                    elevation: 2,
                    margin: const EdgeInsets.only(bottom: 16),
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: ListTile(
                      contentPadding: const EdgeInsets.all(16),
                      leading: CircleAvatar(
                        backgroundColor: Colors.indigo[50],
                        child: Text(
                          student.name[0].toUpperCase(),
                          style: const TextStyle(
                            color: Colors.indigo,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ),
                      title: Text(
                        student.name,
                        style: const TextStyle(fontWeight: FontWeight.bold),
                      ),
                      subtitle: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            student.email,
                            style: TextStyle(color: Colors.grey[600], fontSize: 13),
                          ),
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: Colors.indigo[50],
                                  borderRadius: BorderRadius.circular(4),
                                ),
                                child: Text(
                                  student.className ?? 'No Class',
                                  style: const TextStyle(fontSize: 11, color: Colors.indigo),
                                ),
                              ),
                              const SizedBox(width: 8),
                              Text(
                                'Roll: ${student.enrollmentNo ?? 'N/A'}',
                                style: const TextStyle(fontSize: 11),
                              ),
                            ],
                          ),
                          if (linkedParents.isNotEmpty) ...[
                            const SizedBox(height: 6),
                            Text(
                              'Parents: ${linkedParents.map((parent) => parent['parent_name']).join(', ')}',
                              style: const TextStyle(fontSize: 11),
                            ),
                          ],
                        ],
                      ),
                      trailing: Row(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          IconButton(
                            icon: const Icon(LucideIcons.pencil, size: 20),
                            onPressed: () => _showStudentDialog(student: student),
                          ),
                          IconButton(
                            icon: const Icon(
                              LucideIcons.trash_2,
                              size: 20,
                              color: Colors.red,
                            ),
                            onPressed: () => _confirmDelete(student),
                          ),
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
