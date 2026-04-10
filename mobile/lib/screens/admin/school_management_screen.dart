import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/admin_service.dart';
import '../../models/school.dart';
import '../../models/user.dart';

class SchoolManagementScreen extends StatefulWidget {
  const SchoolManagementScreen({super.key});

  @override
  State<SchoolManagementScreen> createState() => _SchoolManagementScreenState();
}

class _SchoolManagementScreenState extends State<SchoolManagementScreen> {
  late AdminService _adminService;
  List<School> _schools = [];
  List<User> _availableAdmins = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _adminService = AdminService(token: token);
    _fetchData();
  }

  Future<void> _fetchData() async {
    if (!mounted) return;
    setState(() => _isLoading = true);
    
    final schools = await _adminService.getSchools();
    final admins = await _adminService.getUsers(roleId: 2); // School Admins
    
    if (mounted) {
      setState(() {
        _schools = schools;
        _availableAdmins = admins;
        _isLoading = false;
      });
    }
  }

  void _showSchoolForm([School? school]) {
    final nameController = TextEditingController(text: school?.name);
    final addressController = TextEditingController(text: school?.address);
    int? selectedAdminId = school?.usersId;

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(school == null ? 'Add School' : 'Edit School'),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(
                  controller: nameController,
                  decoration: const InputDecoration(labelText: 'School Name'),
                ),
                TextField(
                  controller: addressController,
                  decoration: const InputDecoration(labelText: 'Address'),
                ),
                const SizedBox(height: 16),
                DropdownButtonFormField<int?>(
                  initialValue: selectedAdminId,
                  decoration: const InputDecoration(labelText: 'Assigned Admin'),
                  hint: const Text('Select an Admin'),
                  items: [
                    const DropdownMenuItem<int?>(value: null, child: Text('No Admin assigned')),
                    ..._availableAdmins.map((u) => DropdownMenuItem<int?>(
                          value: u.id,
                          child: Text(u.name),
                        )),
                  ],
                  onChanged: (value) => setDialogState(() => selectedAdminId = value),
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                final navigator = Navigator.of(context);
                final messenger = ScaffoldMessenger.of(context);
                if (nameController.text.isEmpty) {
                  messenger.showSnackBar(const SnackBar(content: Text('Name is required')));
                  return;
                }
                
                final result = school == null
                    ? await _adminService.createSchool(nameController.text, addressController.text, selectedAdminId)
                    : await _adminService.updateSchool(school.id, nameController.text, addressController.text, selectedAdminId);
                
                if (!mounted) {
                  return;
                }

                if (result['success']) {
                  navigator.pop();
                  _fetchData();
                  messenger.showSnackBar(SnackBar(content: Text(result['message'])));
                } else {
                  messenger.showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
                }
              },
              child: Text(school == null ? 'Create' : 'Save'),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _deleteSchool(School school) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete School'),
        content: Text('Are you sure you want to delete ${school.name}?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      final messenger = ScaffoldMessenger.of(context);
      final result = await _adminService.deleteSchool(school.id);
      if (!mounted) {
        return;
      }

      if (result['success']) {
        _fetchData();
        messenger.showSnackBar(SnackBar(content: Text(result['message'])));
      } else {
        messenger.showSnackBar(SnackBar(content: Text(result['message']), backgroundColor: Colors.red));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Schools')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : RefreshIndicator(
              onRefresh: _fetchData,
              child: _schools.isEmpty
                ? const Center(child: Text('No schools found'))
                : ListView.builder(
                    padding: const EdgeInsets.all(8),
                    itemCount: _schools.length,
                    itemBuilder: (context, index) {
                      final school = _schools[index];
                      return Card(
                        child: ListTile(
                          leading: const CircleAvatar(child: Icon(Icons.school, color: Colors.indigo)),
                          title: Text(school.name, style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (school.address != null && school.address!.isNotEmpty) Text(school.address!),
                              Text('Admin: ${school.adminName ?? 'Unassigned'}', style: TextStyle(color: Colors.indigo[800], fontSize: 12)),
                            ],
                          ),
                          isThreeLine: school.address != null && school.address!.isNotEmpty,
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(icon: const Icon(Icons.edit, color: Colors.blue), onPressed: () => _showSchoolForm(school)),
                              IconButton(icon: const Icon(Icons.delete, color: Colors.red), onPressed: () => _deleteSchool(school)),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
            ),
      floatingActionButton: FloatingActionButton(
        onPressed: () => _showSchoolForm(),
        child: const Icon(Icons.add),
      ),
    );
  }
}
