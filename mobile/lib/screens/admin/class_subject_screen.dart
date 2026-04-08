import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/admin_service.dart';
import '../../models/class_model.dart';
import '../../models/subject.dart';

class ClassSubjectScreen extends StatefulWidget {
  const ClassSubjectScreen({super.key});

  @override
  State<ClassSubjectScreen> createState() => _ClassSubjectScreenState();
}

class _ClassSubjectScreenState extends State<ClassSubjectScreen> with SingleTickerProviderStateMixin {
  late AdminService _adminService;
  late TabController _tabController;
  List<ClassModel> _classes = [];
  List<Subject> _subjects = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _adminService = AdminService(token: token);
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    final classes = await _adminService.getClasses();
    final subjects = await _adminService.getSubjects();
    if (mounted) {
      setState(() {
        _classes = classes;
        _subjects = subjects;
        _isLoading = false;
      });
    }
  }

  // --- Class Dialog ---
  void _showClassForm([ClassModel? cls]) {
    final nameController = TextEditingController(text: cls?.name);
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: Text(cls == null ? 'Add Class' : 'Edit Class'),
        content: TextField(
          controller: nameController,
          decoration: const InputDecoration(
            labelText: 'Class Name',
            hintText: 'e.g. 1st, 10th, 12th Medical',
          ),
          autofocus: true,
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () async {
              if (nameController.text.isEmpty) return;
              final navigator = Navigator.of(context);
              final scaffoldMessenger = ScaffoldMessenger.of(context);
              final result = cls == null
                  ? await _adminService.createClass(nameController.text)
                  : await _adminService.updateClass(cls.id, nameController.text);
              
              if (result['success']) {
                navigator.pop();
                _fetchData();
              } else if (mounted) {
                scaffoldMessenger.showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
              }
            },
            child: const Text('Save'),
          ),
        ],
      ),
    );
  }

  // --- Subject Dialog ---
  void _showSubjectForm([Subject? subject]) {
    final nameController = TextEditingController(text: subject?.name);
    List<int> selectedClassIds = subject?.classes.map((c) => c.id).toList() ?? [];

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(subject == null ? 'Add Subject' : 'Edit Subject'),
          content: SizedBox(
            width: double.maxFinite,
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  TextField(
                    controller: nameController, 
                    decoration: const InputDecoration(labelText: 'Subject Name'),
                    autofocus: true,
                  ),
                  const SizedBox(height: 16),
                  const Text('Assign to Classes:', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                  const Divider(),
                  if (_classes.isEmpty)
                    const Padding(
                      padding: EdgeInsets.symmetric(vertical: 8.0),
                      child: Text('No classes found. Create a class first.', style: TextStyle(color: Colors.red)),
                    ),
                  ..._classes.map((c) => CheckboxListTile(
                        title: Text('Class ${c.name}'),
                        value: selectedClassIds.contains(c.id),
                        onChanged: (val) {
                          setDialogState(() {
                            if (val == true) {
                              selectedClassIds.add(c.id);
                            } else {
                              selectedClassIds.remove(c.id);
                            }
                          });
                        },
                        dense: true,
                        contentPadding: EdgeInsets.zero,
                      )),
                ],
              ),
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (nameController.text.isEmpty) return;
                final navigator = Navigator.of(context);
                final scaffoldMessenger = ScaffoldMessenger.of(context);
                final result = subject == null
                    ? await _adminService.createSubject(nameController.text, selectedClassIds)
                    : await _adminService.updateSubject(subject.id, nameController.text, selectedClassIds);
                
                if (result['success']) {
                  navigator.pop();
                  _fetchData();
                } else if (mounted) {
                  scaffoldMessenger.showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
                }
              },
              child: const Text('Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteClass(ClassModel cls) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Class'),
        content: Text('Are you sure you want to delete Class ${cls.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      final result = await _adminService.deleteClass(cls.id);
      if (mounted) {
        if (result['success']) {
          _fetchData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
        }
      }
    }
  }

  Future<void> _deleteSubject(Subject sub) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Subject'),
        content: Text('Are you sure you want to delete ${sub.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      final result = await _adminService.deleteSubject(sub.id);
      if (mounted) {
        if (result['success']) {
          _fetchData();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Classes & Subjects'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Classes'),
            Tab(text: 'Subjects'),
          ],
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildClassesTab(),
                _buildSubjectsTab(),
              ],
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () {
          if (_tabController.index == 0) {
            _showClassForm();
          } else {
            _showSubjectForm();
          }
        },
        child: const Icon(Icons.add),
      ),
    );
  }

  Widget _buildClassesTab() {
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: _classes.isEmpty
          ? const Center(child: Text('No classes found'))
          : ListView.separated(
              padding: const EdgeInsets.all(8),
              itemCount: _classes.length,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                final cls = _classes[index];
                return ListTile(
                  leading: const CircleAvatar(child: Icon(Icons.class_, size: 18)),
                  title: Text('Class ${cls.name}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.edit, color: Colors.blue), onPressed: () => _showClassForm(cls)),
                      IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => _deleteClass(cls)),
                    ],
                  ),
                );
              },
            ),
    );
  }

  Widget _buildSubjectsTab() {
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: _subjects.isEmpty
          ? const Center(child: Text('No subjects found'))
          : ListView.separated(
              padding: const EdgeInsets.all(8),
              itemCount: _subjects.length,
              separatorBuilder: (context, index) => const Divider(),
              itemBuilder: (context, index) {
                final sub = _subjects[index];
                return ListTile(
                  leading: const CircleAvatar(backgroundColor: Colors.teal, child: Icon(Icons.book, color: Colors.white, size: 18)),
                  title: Text(sub.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                  subtitle: Text('Assigned to: ${sub.classNames ?? "No classes"}', style: const TextStyle(fontSize: 12)),
                  trailing: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      IconButton(icon: const Icon(Icons.edit, color: Colors.blue), onPressed: () => _showSubjectForm(sub)),
                      IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => _deleteSubject(sub)),
                    ],
                  ),
                );
              },
            ),
    );
  }
}
