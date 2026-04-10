import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/live_class_service.dart';
import '../utils/live_class_datetime.dart';

class ManageLiveClassFormScreen extends StatefulWidget {
  final Map<String, dynamic>? liveClass;
  const ManageLiveClassFormScreen({super.key, this.liveClass});

  @override
  State<ManageLiveClassFormScreen> createState() => _ManageLiveClassFormScreenState();
}

class _ManageLiveClassFormScreenState extends State<ManageLiveClassFormScreen> {
  final _formKey = GlobalKey<FormState>();
  final _liveClassService = LiveClassService();

  late TextEditingController _titleController;
  late TextEditingController _topicController;
  late TextEditingController _linkController;
  late TextEditingController _startController;
  late TextEditingController _endController;

  int? _selectedClassId;
  int? _selectedSubjectId;
  dynamic _selectedSchoolId;
  bool _isAllSchools = false;
  String _sessionType = 'subject_specific';

  List<dynamic> _classes = [];
  List<dynamic> _subjects = [];
  List<dynamic> _schools = [];
  bool _isSaving = false;

  @override
  void initState() {
    super.initState();
    _titleController = TextEditingController(text: widget.liveClass?['title'] ?? '');
    _topicController = TextEditingController(text: widget.liveClass?['topic_name'] ?? '');
    _linkController = TextEditingController(text: widget.liveClass?['youtube_live_link'] ?? '');
    _startController = TextEditingController(
      text: formatLiveClassDateTimeForText(
        widget.liveClass?['start_time'],
        pattern: 'yyyy-MM-dd HH:mm',
        fallback: '',
      ),
    );
    _endController = TextEditingController(
      text: formatLiveClassDateTimeForText(
        widget.liveClass?['end_time'],
        pattern: 'yyyy-MM-dd HH:mm',
        fallback: '',
      ),
    );
    
    _selectedClassId = widget.liveClass?['class_id'];
    _selectedSubjectId = widget.liveClass?['subject_id'];
    _selectedSchoolId = widget.liveClass?['school_id'];
    _isAllSchools = (widget.liveClass?['is_all_schools'] == 1);
    _sessionType = widget.liveClass?['session_type'] ?? 'subject_specific';

    _fetchMetadata();
  }

  Future<void> _fetchMetadata() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;
    final result = await _liveClassService.getAdminLiveClasses(token);
    if (result['success']) {
      setState(() {
        _classes = result['data']['classes'];
        _subjects = result['data']['subjects'];
        _schools = result['data']['schools'];
      });
    }
  }

  Future<void> _save() async {
    if (!_formKey.currentState!.validate()) return;
    setState(() => _isSaving = true);

    final token = Provider.of<AuthProvider>(context, listen: false).token;
    final data = {
      if (widget.liveClass != null) 'id': widget.liveClass!['id'],
      'title': _titleController.text,
      'topic_name': _topicController.text,
      'youtube_live_link': _linkController.text,
      'session_type': _sessionType,
      'class_id': _selectedClassId,
      'subject_id': _selectedSubjectId,
      'school_id': _isAllSchools ? null : _selectedSchoolId,
      'is_all_schools': _isAllSchools,
      'start_time': _startController.text,
      'end_time': _endController.text,
    };

    final result = widget.liveClass == null
        ? await _liveClassService.createLiveClass(token!, data)
        : await _liveClassService.updateLiveClass(token!, data);

    if (mounted) {
      setState(() => _isSaving = false);
      if (result['success']) {
        Navigator.pop(context, true);
      } else {
        ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Error saving')));
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: Text(widget.liveClass == null ? 'Create Live Class' : 'Edit Live Class')),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              TextFormField(controller: _titleController, decoration: const InputDecoration(labelText: 'Lecture Title *'), validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 16),
              TextFormField(controller: _linkController, decoration: const InputDecoration(labelText: 'YouTube Live Link *'), validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 16),
              DropdownButtonFormField<String>(
                initialValue: _sessionType,
                decoration: const InputDecoration(labelText: 'Session Type'),
                items: const [
                  DropdownMenuItem(value: 'subject_specific', child: Text('Subject-Specific')),
                  DropdownMenuItem(value: 'other_topic', child: Text('Other Topic')),
                ],
                onChanged: (v) => setState(() => _sessionType = v!),
              ),
              const SizedBox(height: 16),
              TextFormField(controller: _topicController, decoration: const InputDecoration(labelText: 'Topic Name'), validator: (v) => v!.isEmpty ? 'Required' : null),
              const SizedBox(height: 16),
              if (_sessionType == 'subject_specific')
                DropdownButtonFormField<int>(
                  initialValue: _selectedSubjectId,
                  decoration: const InputDecoration(labelText: 'Subject'),
                  items: _subjects.map((s) => DropdownMenuItem<int>(value: s['id'], child: Text(s['name']))).toList(),
                  onChanged: (v) => setState(() => _selectedSubjectId = v),
                ),
              const SizedBox(height: 16),
              DropdownButtonFormField<int>(
                initialValue: _selectedClassId,
                decoration: const InputDecoration(labelText: 'Class *'),
                items: _classes.map((c) => DropdownMenuItem<int>(value: c['id'], child: Text(c['name']))).toList(),
                onChanged: (v) => setState(() => _selectedClassId = v),
              ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Checkbox(value: _isAllSchools, onChanged: (v) => setState(() => _isAllSchools = v!)),
                  const Text('Available for All Schools'),
                ],
              ),
              if (!_isAllSchools)
                DropdownButtonFormField<dynamic>(
                  initialValue: _selectedSchoolId,
                  decoration: const InputDecoration(labelText: 'School'),
                  items: _schools.map((s) => DropdownMenuItem<dynamic>(value: s['id'], child: Text(s['name']))).toList(),
                  onChanged: (v) => setState(() => _selectedSchoolId = v),
                ),
              const SizedBox(height: 16),
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _startController,
                      decoration: const InputDecoration(labelText: 'Start Time', hintText: 'YYYY-MM-DD HH:MM'),
                      validator: (v) => v!.isEmpty ? 'Required' : null,
                    ),
                  ),
                  const SizedBox(width: 8),
                  Expanded(
                    child: TextFormField(
                      controller: _endController,
                      decoration: const InputDecoration(labelText: 'End Time', hintText: 'YYYY-MM-DD HH:MM'),
                      validator: (v) => v!.isEmpty ? 'Required' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _isSaving ? null : _save,
                style: ElevatedButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 16)),
                child: _isSaving ? const CircularProgressIndicator(color: Colors.white) : const Text('Save Session'),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
