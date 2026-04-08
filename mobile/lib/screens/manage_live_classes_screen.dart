import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/live_class_service.dart';
import 'manage_live_class_form_screen.dart';

class ManageLiveClassesScreen extends StatefulWidget {
  const ManageLiveClassesScreen({super.key});

  @override
  State<ManageLiveClassesScreen> createState() => _ManageLiveClassesScreenState();
}

class _ManageLiveClassesScreenState extends State<ManageLiveClassesScreen> {
  final LiveClassService _liveClassService = LiveClassService();
  List<dynamic> _liveClasses = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchLiveClasses();
  }

  Future<void> _fetchLiveClasses() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    final result = await _liveClassService.getAdminLiveClasses(token);
    if (mounted) {
      setState(() {
        if (result['success']) {
          _liveClasses = result['data']['liveClasses'] ?? [];
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _deleteClass(int id) async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    final confirm = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Live Class'),
        content: const Text('Are you sure you want to delete this live class session?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(onPressed: () => Navigator.pop(context, true), child: const Text('Delete', style: TextStyle(color: Colors.red))),
        ],
      ),
    );

    if (confirm == true) {
      final result = await _liveClassService.deleteLiveClass(token, id);
      if (mounted) {
        if (result['success']) {
          _fetchLiveClasses();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Failed to delete')));
        }
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Manage Live Classes')),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : RefreshIndicator(
                  onRefresh: _fetchLiveClasses,
                  child: ListView.builder(
                    padding: const EdgeInsets.all(16),
                    itemCount: _liveClasses.length,
                    itemBuilder: (context, index) {
                      final lc = _liveClasses[index];
                      return Card(
                        margin: const EdgeInsets.only(bottom: 12),
                        child: ListTile(
                          title: Text(lc['title'] ?? 'Untitled', style: const TextStyle(fontWeight: FontWeight.bold)),
                          subtitle: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text('${lc['class_name']} • ${lc['subject_name'] ?? 'General'}'),
                              Text('Start: ${lc['start_time']?.toString().split('T')[0]} ${lc['start_time']?.toString().split('T')[1].substring(0, 5)}', style: const TextStyle(fontSize: 11)),
                            ],
                          ),
                          trailing: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              IconButton(
                                icon: const Icon(Icons.edit, color: Colors.blue),
                                onPressed: () async {
                                  final updated = await Navigator.push(
                                    context,
                                    MaterialPageRoute(builder: (_) => ManageLiveClassFormScreen(liveClass: lc)),
                                  );
                                  if (updated == true) _fetchLiveClasses();
                                },
                              ),
                              IconButton(
                                icon: const Icon(Icons.delete, color: Colors.red),
                                onPressed: () => _deleteClass(lc['id']),
                              ),
                            ],
                          ),
                        ),
                      );
                    },
                  ),
                ),
      floatingActionButton: FloatingActionButton(
        onPressed: () async {
          final created = await Navigator.push(
            context,
            MaterialPageRoute(builder: (_) => const ManageLiveClassFormScreen()),
          );
          if (created == true) _fetchLiveClasses();
        },
        child: const Icon(Icons.add),
      ),
    );
  }
}
