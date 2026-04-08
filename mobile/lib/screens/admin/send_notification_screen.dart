import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../services/notification_service.dart';
import '../../services/admin_service.dart';
import '../../providers/auth_provider.dart';

class SendNotificationScreen extends StatefulWidget {
  const SendNotificationScreen({super.key});

  @override
  State<SendNotificationScreen> createState() => _SendNotificationScreenState();
}

class _SendNotificationScreenState extends State<SendNotificationScreen> {
  final _formKey = GlobalKey<FormState>();
  final _titleController = TextEditingController();
  final _messageController = TextEditingController();
  String _targetType = 'all';
  String? _targetId;
  bool _isLoading = false;
  List<dynamic> _classes = [];
  bool _isLoadingClasses = false;

  final Map<String, String> _targetOptions = {
    'all': 'Everyone (All Users)',
    'role': 'By Role (e.g. parents, teachers)',
    'group': 'By Class',
  };

  @override
  void dispose() {
    _titleController.dispose();
    _messageController.dispose();
    super.dispose();
  }

  Future<void> _loadClasses() async {
    setState(() => _isLoadingClasses = true);
    try {
      final auth = Provider.of<AuthProvider>(context, listen: false);
      final adminService = AdminService(token: auth.token);
      final classes = await adminService.getClasses();
      setState(() {
        _classes = classes;
        _isLoadingClasses = false;
      });
    } catch (e) {
      if (mounted) {
        setState(() => _isLoadingClasses = false);
      }
    }
  }

  Future<void> _send() async {
    if (!_formKey.currentState!.validate()) return;

    setState(() => _isLoading = true);

    final result = await NotificationService.sendManualNotification(
      title: _titleController.text,
      message: _messageController.text,
      targetType: _targetType,
      targetId: _targetId,
    );

    if (mounted) {
      setState(() => _isLoading = false);
      final message = result['message'] ?? result['error'] ?? 'Unknown error';
      if (result['success'] == true) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(message), backgroundColor: Colors.green),
        );
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error: $message'), backgroundColor: Colors.red),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Send Notification'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Text(
                'Create Broadcast',
                style: TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
              ),
              const SizedBox(height: 8),
              Text(
                'Send a push and in-app notification to your selected audience.',
                style: TextStyle(color: Colors.grey[600]),
              ),
              const SizedBox(height: 24),
              TextFormField(
                controller: _titleController,
                decoration: const InputDecoration(
                  labelText: 'Title',
                  hintText: 'e.g. School Holiday Announcement',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(LucideIcons.type),
                ),
                validator: (value) => value == null || value.isEmpty ? 'Title is required' : null,
              ),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                value: _targetType,
                decoration: const InputDecoration(
                  labelText: 'Target Audience',
                  border: OutlineInputBorder(),
                  prefixIcon: Icon(LucideIcons.users),
                ),
                items: _targetOptions.entries.map((entry) {
                  return DropdownMenuItem(
                    value: entry.key,
                    child: Text(entry.value),
                  );
                }).toList(),
                onChanged: (value) {
                  setState(() {
                    _targetType = value!;
                    _targetId = null; // Reset target ID when type changes
                  });
                  if (_targetType == 'group' && _classes.isEmpty) {
                    _loadClasses();
                  }
                },
              ),
              if (_targetType == 'role') ...[
                const SizedBox(height: 16),
                DropdownButtonFormField<String>(
                  decoration: const InputDecoration(
                    labelText: 'Select Role',
                    border: OutlineInputBorder(),
                  ),
                  items: const [
                    DropdownMenuItem(value: 'student', child: Text('Students')),
                    DropdownMenuItem(value: 'teacher', child: Text('Teachers')),
                    DropdownMenuItem(value: 'parent', child: Text('Parents')),
                    DropdownMenuItem(value: 'school_admin', child: Text('Admins')),
                  ],
                  onChanged: (value) => setState(() => _targetId = value),
                  validator: (value) => _targetType == 'role' && value == null ? 'Please select a role' : null,
                ),
              ],
              if (_targetType == 'group') ...[
                const SizedBox(height: 16),
                _isLoadingClasses 
                  ? const Center(child: CircularProgressIndicator())
                  : DropdownButtonFormField<String>(
                      decoration: const InputDecoration(
                        labelText: 'Select Class',
                        border: OutlineInputBorder(),
                      ),
                      items: _classes.map((c) {
                        return DropdownMenuItem(
                          value: c.id.toString(),
                          child: Text(c.name),
                        );
                      }).toList(),
                      onChanged: (value) => setState(() => _targetId = value),
                      validator: (value) => _targetType == 'group' && value == null ? 'Please select a class' : null,
                    ),
              ],
              const SizedBox(height: 16),
              TextFormField(
                controller: _messageController,
                maxLines: 4,
                decoration: const InputDecoration(
                  labelText: 'Message',
                  hintText: 'Enter your message here...',
                  border: OutlineInputBorder(),
                  alignLabelWithHint: true,
                ),
                validator: (value) => value == null || value.isEmpty ? 'Message is required' : null,
              ),
              const SizedBox(height: 24),
              SizedBox(
                width: double.infinity,
                height: 50,
                child: ElevatorButton(
                  onPressed: _isLoading ? null : _send,
                  child: _isLoading 
                    ? const CircularProgressIndicator(color: Colors.white)
                    : const Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.send, size: 18),
                          SizedBox(width: 8),
                          Text('Send Now', style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
                        ],
                      ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

// Simple wrapper for a styled button if ElevatorButton is not available or custom
class ElevatorButton extends StatelessWidget {
  final VoidCallback? onPressed;
  final Widget child;
  const ElevatorButton({super.key, this.onPressed, required this.child});

  @override
  Widget build(BuildContext context) {
    return ElevatedButton(
      onPressed: onPressed,
      style: ElevatedButton.styleFrom(
        backgroundColor: const Color(0xFF6366F1),
        foregroundColor: Colors.white,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        elevation: 0,
      ),
      child: child,
    );
  }
}
