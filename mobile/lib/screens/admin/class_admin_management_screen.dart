import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/class_admin_service.dart';

class ClassAdminManagementScreen extends StatefulWidget {
  const ClassAdminManagementScreen({super.key});

  @override
  State<ClassAdminManagementScreen> createState() => _ClassAdminManagementScreenState();
}

class _ClassAdminManagementScreenState extends State<ClassAdminManagementScreen> {
  late ClassAdminService _classAdminService;
  List<dynamic> _classAdmins = [];
  List<dynamic> _classes = [];
  List<dynamic> _schools = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    _classAdminService = ClassAdminService(token: auth.token);
    _fetchData();
  }

  Future<void> _fetchData() async {
    setState(() => _isLoading = true);
    final result = await _classAdminService.getClassAdminsData();
    if (mounted) {
      setState(() {
        if (result['success']) {
          _classAdmins = result['classAdmins'] ?? [];
          _classes = result['classes'] ?? [];
          _schools = result['schools'] ?? [];
          _errorMessage = null;
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  void _showAddEditDialog({Map<String, dynamic>? classAdmin}) {
    final isEditing = classAdmin != null;
    final nameController = TextEditingController(text: classAdmin?['admin_name']);
    final emailController = TextEditingController(text: classAdmin?['admin_email']);
    final passwordController = TextEditingController();
    int? selectedClassId = classAdmin?['class_id'];
    int? selectedSchoolId = classAdmin?['school_id'];

    final auth = Provider.of<AuthProvider>(context, listen: false);
    final isSchoolAdmin = auth.user?.roleName == 'school_admin';
    if (isSchoolAdmin) {
      selectedSchoolId = auth.user?.schoolId;
    }

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(isEditing ? 'Edit Class Admin' : 'Add Class Admin'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'Full Name'),
                ),
                TextField(
                  controller: emailController,
                  decoration: const InputDecoration(labelText: 'Email'),
                  keyboardType: TextInputType.emailAddress,
                ),
                TextField(
                  controller: passwordController,
                  decoration: InputDecoration(
                    labelText: 'Password',
                    hintText: isEditing ? 'Leave blank to keep current' : null,
                  ),
                  obscureText: true,
                ),
                if (!isSchoolAdmin)
                  DropdownButtonFormField<int>(
                    value: selectedSchoolId,
                    decoration: const InputDecoration(labelText: 'School'),
                    items: _schools.map<DropdownMenuItem<int>>((s) => DropdownMenuItem(value: s['id'], child: Text(s['name']))).toList(),
                    onChanged: (val) => setDialogState(() => selectedSchoolId = val),
                  ),
                DropdownButtonFormField<int>(
                  value: selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class'),
                  items: _classes.map<DropdownMenuItem<int>>((c) => DropdownMenuItem(value: c['id'], child: Text(c['name']))).toList(),
                  onChanged: (val) => setDialogState(() => selectedClassId = val),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty || emailController.text.isEmpty || ( !isEditing && passwordController.text.isEmpty) || selectedClassId == null || selectedSchoolId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill all fields')));
                  return;
                }

                final data = {
                  if (isEditing) 'admin_id': classAdmin['admin_id'],
                  'name': nameController.text,
                  'email': emailController.text,
                  if (passwordController.text.isNotEmpty) 'password': passwordController.text,
                  'class_id': selectedClassId,
                  'school_id': selectedSchoolId,
                };

                final result = await _classAdminService.saveClassAdmin(data, id: classAdmin?['id']);
                if (mounted) {
                  if (result['success']) {
                    Navigator.pop(context);
                    _fetchData();
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'])));
                  } else {
                    ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
                  }
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFF6366F1), foregroundColor: Colors.white),
              child: Text(isEditing ? 'Update' : 'Create'),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmDelete(Map<String, dynamic> ca) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Class Admin'),
        content: Text('Are you sure you want to delete "${ca['admin_name']}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              final result = await _classAdminService.deleteClassAdmin(ca['id'], ca['admin_id']);
              if (mounted) {
                Navigator.pop(context);
                if (result['success']) {
                  _fetchData();
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Deleted successfully')));
                } else {
                  ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
                }
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
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Manage Class Admins', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : _classAdmins.isEmpty
                  ? const Center(child: Text('No class admins found'))
                  : RefreshIndicator(
                      onRefresh: _fetchData,
                      child: ListView.separated(
                        padding: const EdgeInsets.all(16),
                        itemCount: _classAdmins.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, index) {
                          final ca = _classAdmins[index];
                          return Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(color: Colors.grey[200]!),
                              boxShadow: [BoxShadow(color: Colors.black.withOpacity(0.02), blurRadius: 10, offset: const Offset(0, 4))],
                            ),
                            child: Row(
                              children: [
                                CircleAvatar(
                                  backgroundColor: Colors.blue.withOpacity(0.1),
                                  child: Text(ca['admin_name'][0], style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold)),
                                ),
                                const SizedBox(width: 16),
                                Expanded(
                                  child: Column(
                                    crossAxisAlignment: CrossAxisAlignment.start,
                                    children: [
                                      Text(ca['admin_name'], style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                                      Text(ca['admin_email'], style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                                      const SizedBox(height: 4),
                                      Row(
                                        children: [
                                          Icon(LucideIcons.graduation_cap, size: 14, color: Colors.indigo[300]),
                                          const SizedBox(width: 4),
                                          Text(ca['class_name'], style: TextStyle(color: Colors.indigo[400], fontSize: 12, fontWeight: FontWeight.w600)),
                                          const SizedBox(width: 12),
                                          Icon(LucideIcons.school, size: 14, color: Colors.indigo[300]),
                                          const SizedBox(width: 4),
                                          Text(ca['school_name'], style: TextStyle(color: Colors.indigo[400], fontSize: 12, fontWeight: FontWeight.w600)),
                                        ],
                                      ),
                                    ],
                                  ),
                                ),
                                Row(
                                  children: [
                                    IconButton(
                                      icon: const Icon(LucideIcons.pencil, size: 18, color: Colors.blue),
                                      onPressed: () => _showAddEditDialog(classAdmin: ca),
                                    ),
                                    IconButton(
                                      icon: const Icon(LucideIcons.trash_2, size: 18, color: Colors.red),
                                      onPressed: () => _confirmDelete(ca),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          );
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showAddEditDialog(),
        backgroundColor: const Color(0xFF6366F1),
        foregroundColor: Colors.white,
        child: const Icon(LucideIcons.plus),
      ),
    );
  }
}
