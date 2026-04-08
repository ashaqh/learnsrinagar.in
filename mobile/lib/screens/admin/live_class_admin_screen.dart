import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../../providers/auth_provider.dart';
import '../../services/admin_service.dart';
import '../../models/live_class.dart';
import '../../models/school.dart';
import '../../models/class_model.dart';
import '../../models/subject.dart';
import '../../models/user.dart';

class LiveClassAdminScreen extends StatefulWidget {
  const LiveClassAdminScreen({super.key});

  @override
  State<LiveClassAdminScreen> createState() => _LiveClassAdminScreenState();
}

class _LiveClassAdminScreenState extends State<LiveClassAdminScreen> with SingleTickerProviderStateMixin {
  late AdminService _adminService;
  late TabController _tabController;
  List<LiveClass> _liveClasses = [];
  List<School> _schools = [];
  List<ClassModel> _classes = [];
  List<Subject> _subjects = [];
  List<User> _teachers = [];
  bool _isLoading = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 2, vsync: this);
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _adminService = AdminService(token: token);
    _loadData();
  }

  Future<void> _loadData() async {
    setState(() => _isLoading = true);
    final data = await _adminService.getLiveClassesData();
    if (mounted) {
      setState(() {
        _liveClasses = data['liveClasses'] ?? [];
        _schools = data['schools'] ?? [];
        _classes = data['classes'] ?? [];
        _subjects = data['subjects'] ?? [];
        _teachers = data['teachers'] ?? [];
        _isLoading = false;
      });
    }
  }

  void _showLiveClassDialog({LiveClass? liveClass}) {
    final titleController = TextEditingController(text: liveClass?.title);
    final linkController = TextEditingController(text: liveClass?.youtubeLiveLink);
    final topicController = TextEditingController(text: liveClass?.topicName);
    int? selectedSchoolId = liveClass?.schoolId;
    int? selectedClassId = liveClass?.classId;
    int? selectedSubjectId = liveClass?.subjectId;
    int? selectedTeacherId = liveClass?.teacherId;
    String selectedSessionType = liveClass?.sessionType ?? 'subject_specific';
    bool isAllSchools = liveClass?.isAllSchools ?? false;
    DateTime selectedStartTime = liveClass != null ? DateTime.parse(liveClass.startTime) : DateTime.now();
    DateTime selectedEndTime = liveClass?.endTime != null ? DateTime.parse(liveClass!.endTime!) : selectedStartTime.add(const Duration(hours: 1));

    showDialog(
      context: context,
      builder: (context) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: Text(liveClass == null ? 'Schedule Live Class' : 'Edit Live Class', style: const TextStyle(fontWeight: FontWeight.bold)),
          content: SingleChildScrollView(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TextField(controller: titleController, decoration: const InputDecoration(labelText: 'Title')),
                TextField(controller: linkController, decoration: const InputDecoration(labelText: 'YouTube Live Link')),
                TextField(controller: topicController, decoration: const InputDecoration(labelText: 'Topic Name')),
                const SizedBox(height: 12),
                DropdownButtonFormField<String>(
                  value: ['scheduled', 'live', 'recorded'].contains(selectedSessionType) ? 'subject_specific' : selectedSessionType,
                  decoration: const InputDecoration(labelText: 'Session Type'),
                  items: [
                    {'value': 'subject_specific', 'label': 'Subject-Specific'},
                    {'value': 'other_topic', 'label': 'Other Topic'},
                  ].map((t) => DropdownMenuItem(value: t['value'] as String, child: Text(t['label'] as String))).toList(),
                  onChanged: (val) => setDialogState(() {
                    selectedSessionType = val!;
                    if (selectedSessionType == 'other_topic') {
                      selectedSubjectId = null;
                    }
                  }),
                ),
                SwitchListTile(
                  title: const Text('All Schools', style: TextStyle(fontSize: 14)),
                  value: isAllSchools,
                  onChanged: (val) => setDialogState(() => isAllSchools = val),
                  contentPadding: EdgeInsets.zero,
                ),
                if (!isAllSchools)
                  DropdownButtonFormField<int>(
                    value: selectedSchoolId,
                    decoration: const InputDecoration(labelText: 'School'),
                    items: _schools.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                    onChanged: (val) => setDialogState(() => selectedSchoolId = val),
                  ),
                DropdownButtonFormField<int>(
                  value: selectedClassId,
                  decoration: const InputDecoration(labelText: 'Class'),
                  items: _classes.map((c) => DropdownMenuItem(value: c.id, child: Text(c.name))).toList(),
                  onChanged: (val) => setDialogState(() => selectedClassId = val),
                ),
                if (selectedSessionType == 'subject_specific')
                  DropdownButtonFormField<int>(
                    value: selectedSubjectId,
                    decoration: const InputDecoration(labelText: 'Subject'),
                    items: _subjects.map((s) => DropdownMenuItem(value: s.id, child: Text(s.name))).toList(),
                    onChanged: (val) => setDialogState(() => selectedSubjectId = val),
                  ),
                DropdownButtonFormField<int>(
                  value: selectedTeacherId,
                  decoration: const InputDecoration(labelText: 'Teacher'),
                  items: _teachers.map((t) => DropdownMenuItem(value: t.id, child: Text(t.name))).toList(),
                  onChanged: (val) => setDialogState(() => selectedTeacherId = val),
                ),
                const SizedBox(height: 12),
                ListTile(
                  title: const Text('Start Time', style: TextStyle(fontSize: 14)),
                  subtitle: Text(DateFormat('yyyy-MM-dd HH:mm').format(selectedStartTime)),
                  trailing: const Icon(LucideIcons.calendar),
                  contentPadding: EdgeInsets.zero,
                  onTap: () async {
                    final date = await showDatePicker(context: context, initialDate: selectedStartTime, firstDate: DateTime.now().subtract(const Duration(days: 30)), lastDate: DateTime.now().add(const Duration(days: 30)));
                    if (date != null) {
                      final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(selectedStartTime));
                      if (time != null) {
                        setDialogState(() {
                          final oldStart = selectedStartTime;
                          selectedStartTime = DateTime(date.year, date.month, date.day, time.hour, time.minute);
                          // Shift end time accordingly if it was defaulted
                          if (selectedEndTime.isBefore(selectedStartTime) || selectedEndTime == oldStart.add(const Duration(hours: 1))) {
                             selectedEndTime = selectedStartTime.add(const Duration(hours: 1));
                          }
                        });
                      }
                    }
                  },
                ),
                ListTile(
                  title: const Text('End Time', style: TextStyle(fontSize: 14)),
                  subtitle: Text(DateFormat('yyyy-MM-dd HH:mm').format(selectedEndTime)),
                  trailing: const Icon(LucideIcons.calendar_check),
                  contentPadding: EdgeInsets.zero,
                  onTap: () async {
                    final date = await showDatePicker(context: context, initialDate: selectedEndTime, firstDate: selectedStartTime, lastDate: DateTime.now().add(const Duration(days: 60)));
                    if (date != null) {
                      final time = await showTimePicker(context: context, initialTime: TimeOfDay.fromDateTime(selectedEndTime));
                      if (time != null) {
                        setDialogState(() => selectedEndTime = DateTime(date.year, date.month, date.day, time.hour, time.minute));
                      }
                    }
                  },
                ),
              ],
            ),
          ),
          actions: [
            TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
            ElevatedButton(
              onPressed: () async {
                if (titleController.text.isEmpty || linkController.text.isEmpty || selectedClassId == null || selectedTeacherId == null) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Please fill required fields')));
                  return;
                }

                final classData = {
                  'title': titleController.text,
                  'youtube_live_link': linkController.text,
                  'session_type': selectedSessionType,
                  'topic_name': topicController.text,
                  'class_id': selectedClassId,
                  'subject_id': selectedSubjectId,
                  'teacher_id': selectedTeacherId,
                  'school_id': isAllSchools ? null : selectedSchoolId,
                  'is_all_schools': isAllSchools,
                  'start_time': selectedStartTime.toIso8601String(),
                  'end_time': selectedEndTime.toIso8601String(),
                };

                final messenger = ScaffoldMessenger.of(context);
                final navigator = Navigator.of(context);
                final result = await _adminService.saveLiveClass(classData, id: liveClass?.id);

                if (!mounted) return;
                if (result['success'] == true) {
                  _loadData();
                  navigator.pop();
                  messenger.showSnackBar(SnackBar(content: Text(liveClass == null ? 'Class scheduled' : 'Class updated')));
                } else {
                  messenger.showSnackBar(const SnackBar(content: Text('Failed to save class')));
                }
              },
              style: ElevatedButton.styleFrom(backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              child: Text(liveClass == null ? 'Schedule' : 'Update'),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final now = DateTime.now();
    final upcoming = _liveClasses.where((l) => DateTime.parse(l.startTime).isAfter(now)).toList();
    final past = _liveClasses.where((l) => DateTime.parse(l.startTime).isBefore(now)).toList();
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final isReadOnly = auth.user?.roleName == 'school_admin' ||
        auth.user?.roleName == 'class_admin' ||
        auth.user?.roleName == 'teacher';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Live Class Admin', style: TextStyle(fontWeight: FontWeight.bold)),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        bottom: TabBar(
          controller: _tabController,
          tabs: const [Tab(text: 'Upcoming'), Tab(text: 'Past')],
          labelColor: Colors.white,
          unselectedLabelColor: Colors.white70,
          indicatorColor: Colors.white,
        ),
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : TabBarView(
              controller: _tabController,
              children: [
                _buildClassList(upcoming),
                _buildClassList(past),
              ],
            ),
      floatingActionButton: isReadOnly
          ? null
          : FloatingActionButton(
              onPressed: () => _showLiveClassDialog(),
              backgroundColor: Colors.indigo,
              foregroundColor: Colors.white,
              child: const Icon(LucideIcons.plus),
            ),
    );
  }

  Widget _buildClassList(List<LiveClass> classes) {
    if (classes.isEmpty) {
      return Center(child: Text('No classes found', style: TextStyle(color: Colors.grey[600])));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: classes.length,
      itemBuilder: (context, index) {
        final lc = classes[index];
        final startTime = DateTime.parse(lc.startTime);

        return Card(
          margin: const EdgeInsets.only(bottom: 16),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
          child: Column(
            children: [
              ListTile(
                title: Text(lc.title, style: const TextStyle(fontWeight: FontWeight.bold)),
                subtitle: Text('${lc.subjectName ?? 'No Subject'} - Class ${lc.className}'),
                trailing: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                  decoration: BoxDecoration(color: Colors.indigo[50], borderRadius: BorderRadius.circular(4)),
                  child: Text(lc.sessionType.toUpperCase(), style: const TextStyle(color: Colors.indigo, fontSize: 10, fontWeight: FontWeight.bold)),
                ),
              ),
              Padding(
                padding: const EdgeInsets.symmetric(horizontal: 16),
                child: Row(
                  children: [
                    const Icon(LucideIcons.user, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(lc.teacherName, style: const TextStyle(fontSize: 12, color: Colors.grey)),
                    const SizedBox(width: 16),
                    const Icon(LucideIcons.calendar, size: 14, color: Colors.grey),
                    const SizedBox(width: 4),
                    Text(DateFormat('MMM dd, HH:mm').format(startTime), style: const TextStyle(fontSize: 12, color: Colors.grey)),
                  ],
                ),
              ),
              const SizedBox(height: 8),
              if (lc.isAllSchools)
                const Padding(
                  padding: EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      Icon(LucideIcons.globe, size: 14, color: Colors.green),
                      SizedBox(width: 4),
                      Text('Broadcasting to all schools', style: TextStyle(fontSize: 11, color: Colors.green, fontWeight: FontWeight.w600)),
                    ],
                  ),
                )
              else
                Padding(
                  padding: const EdgeInsets.symmetric(horizontal: 16),
                  child: Row(
                    children: [
                      const Icon(LucideIcons.school, size: 14, color: Colors.blue),
                      const SizedBox(width: 4),
                      Text('School: ${lc.schoolName ?? 'Unknown'}', style: const TextStyle(fontSize: 11, color: Colors.blue)),
                    ],
                  ),
                ),
              if (!['school_admin', 'class_admin', 'teacher']
                  .contains(Provider.of<AuthProvider>(context, listen: false).user?.roleName))
                OverflowBar(
                  alignment: MainAxisAlignment.end,
                  overflowAlignment: OverflowBarAlignment.end,
                  children: [
                    if (lc.sessionType == 'scheduled')
                      ElevatedButton.icon(
                        icon: const Icon(LucideIcons.play, size: 16),
                        label: const Text('Start'),
                        onPressed: () => _updateSessionStatus(lc, 'live'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.green, foregroundColor: Colors.white),
                      ),
                    if (lc.sessionType == 'live')
                      ElevatedButton.icon(
                        icon: const Icon(Icons.stop_circle, size: 16),
                        label: const Text('End'),
                        onPressed: () => _updateSessionStatus(lc, 'recorded'),
                        style: ElevatedButton.styleFrom(backgroundColor: Colors.red, foregroundColor: Colors.white),
                      ),
                    TextButton.icon(icon: const Icon(LucideIcons.pencil, size: 16), label: const Text('Edit'), onPressed: () => _showLiveClassDialog(liveClass: lc)),
                    IconButton(
                      icon: const Icon(LucideIcons.trash_2, size: 16, color: Colors.red),
                      onPressed: () => _confirmDeleteLiveClass(lc),
                    ),
                  ],
                ),
            ],
          ),
        );
      },
    );
  }

  Future<void> _updateSessionStatus(LiveClass lc, String newStatus) async {
    final messenger = ScaffoldMessenger.of(context);
    final classData = {
      'title': lc.title,
      'youtube_live_link': lc.youtubeLiveLink,
      'session_type': newStatus,
      'topic_name': lc.topicName,
      'class_id': lc.classId,
      'subject_id': lc.subjectId,
      'teacher_id': lc.teacherId,
      'school_id': lc.schoolId,
      'is_all_schools': lc.isAllSchools,
      'start_time': lc.startTime,
      if (newStatus == 'recorded') 'end_time': DateTime.now().toIso8601String(),
    };

    final result = await _adminService.saveLiveClass(classData, id: lc.id);
    if (!mounted) return;
    if (result['success'] == true) {
      _loadData();
      messenger.showSnackBar(SnackBar(content: Text('Session ${newStatus == 'live' ? 'started' : 'ended'}')));
    }
  }

  void _confirmDeleteLiveClass(LiveClass lc) {
    showDialog(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Session'),
        content: Text('Are you sure you want to delete "${lc.title}"?'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context), child: const Text('Cancel')),
          TextButton(
            onPressed: () async {
              final messenger = ScaffoldMessenger.of(context);
              final navigator = Navigator.of(context);
              final result = await _adminService.deleteLiveClass(lc.id);
              if (!mounted) return;
              if (result['success'] == true) {
                _loadData();
                navigator.pop();
                messenger.showSnackBar(const SnackBar(content: Text('Session deleted')));
              }
            },
            child: const Text('Delete', style: TextStyle(color: Colors.red)),
          ),
        ],
      ),
    );
  }
}
