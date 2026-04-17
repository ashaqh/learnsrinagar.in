import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../services/attendance_service.dart';
import '../services/admin_service.dart';
import '../models/class_model.dart';

class AttendanceScreen extends StatefulWidget {
  final int? classId; // For teachers/admins to go directly to marking
  const AttendanceScreen({super.key, this.classId});

  @override
  State<AttendanceScreen> createState() => _AttendanceScreenState();
}

class _AttendanceScreenState extends State<AttendanceScreen> {
  final _attendanceService = AttendanceService();
  late AdminService _adminService;

  List<dynamic> _students = [];
  Map<int, String> _statusMap = {}; // userId -> status
  List<dynamic> _attendanceHistory = [];
  List<ClassModel> _classes = [];
  int? _selectedClassId;
  DateTime _selectedDate = DateTime.now();

  bool _isLoading = true;
  bool _isLoadingStudents = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    _adminService = AdminService(token: token);
    _loadInitialData();
  }

  Future<void> _loadInitialData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    setState(() => _isLoading = true);

    final isStaff = ['super_admin', 'school_admin', 'teacher', 'class_admin']
        .contains(auth.user?.roleName);

    if (isStaff) {
      try {
        final classes = await _adminService.getClasses();
        if (mounted) {
          setState(() {
            if (['teacher', 'class_admin'].contains(auth.user?.roleName) &&
                auth.user?.classIds.isNotEmpty == true) {
              _classes = classes
                  .where((c) => auth.user!.classIds.contains(c.id))
                  .toList();
            } else {
              _classes = classes;
            }
            // Set initial selected class
            if (widget.classId != null) {
              _selectedClassId = widget.classId;
            } else if (_classes.isNotEmpty) {
              _selectedClassId = _classes.first.id;
            }
            _isLoading = false;
          });
          // Load students for the selected class
          if (_selectedClassId != null) {
            _loadStudentsForClass();
          }
        }
      } catch (e) {
        if (mounted) {
          setState(() {
            _errorMessage = 'Error loading classes: $e';
            _isLoading = false;
          });
        }
      }
    } else {
      // Student/Parent view: Fetch history
      int? targetStudentId;
      if (auth.user?.roleName == 'parent' && auth.user?.studentIds.isNotEmpty == true) {
        targetStudentId = auth.user!.studentIds.first;
      }
      
      final result = await _attendanceService.getStudentAttendance(
        auth.token!,
        studentId: targetStudentId,
      );
      
      if (mounted) {
        setState(() {
          if (result['success']) {
            _attendanceHistory = result['attendance'] ?? [];
          } else {
            _errorMessage = result['message'];
          }
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _loadStudentsForClass() async {
    if (_selectedClassId == null) return;
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    setState(() => _isLoadingStudents = true);

    try {
      final result =
          await _attendanceService.getStudents(auth.token!, _selectedClassId!);
      if (mounted) {
        setState(() {
          if (result['success']) {
            _students = result['students'] ?? [];
            // Initialize status map - default to present for marking
            _statusMap = {};
            for (var s in _students) {
              _statusMap[s['id']] = 'not_marked';
            }
          } else {
            _students = [];
            _errorMessage = result['message'];
          }
          _isLoadingStudents = false;
        });
        // Now load attendance records for this class and date
        _loadAttendanceForDate();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoadingStudents = false;
          _errorMessage = 'Error loading students: $e';
        });
      }
    }
  }

  Future<void> _loadAttendanceForDate() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null || _selectedClassId == null) return;

    // Fetch attendance for this class/date via the attendance history endpoint
    try {
      final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
      final result = await _attendanceService.getAttendanceForClass(
        auth.token!,
        _selectedClassId!,
        dateStr,
      );
      if (mounted && result['success']) {
        final records = result['attendance'] as List? ?? [];
        setState(() {
          // Reset all to not_marked first
          for (var s in _students) {
            _statusMap[s['id']] = 'not_marked';
          }
          // Apply existing records
          for (var record in records) {
            final studentId = record['student_id'];
            final status = record['status']?.toString() ?? 'not_marked';
            if (_statusMap.containsKey(studentId)) {
              _statusMap[studentId] = status;
            }
          }
        });
      }
    } catch (e) {
      // Error loading attendance records silently handled
    }
  }

  Future<void> _submitAttendance() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null || _selectedClassId == null) return;

    setState(() => _isLoadingStudents = true);

    final records = _statusMap.entries
        .where((e) => e.value != 'not_marked')
        .map((e) => {
              'studentId': e.key,
              'status': e.value,
            })
        .toList();

    if (records.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please mark at least one student')),
      );
      setState(() => _isLoadingStudents = false);
      return;
    }

    final dateStr = DateFormat('yyyy-MM-dd').format(_selectedDate);
    final result = await _attendanceService.postAttendance(
      auth.token!,
      _selectedClassId!,
      dateStr,
      records,
    );

    if (mounted) {
      setState(() => _isLoadingStudents = false);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content:
              Text(result['message'] ?? result['error'] ?? 'Result unknown'),
          backgroundColor: result['success'] ? Colors.green : Colors.red,
        ),
      );
      if (result['success']) {
        _loadAttendanceForDate();
      }
    }
  }

  Future<void> _pickDate() async {
    final picked = await showDatePicker(
      context: context,
      initialDate: _selectedDate,
      firstDate: DateTime(2000),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (picked != null && picked != _selectedDate) {
      setState(() => _selectedDate = picked);
      _loadAttendanceForDate();
    }
  }

  bool get _canMarkAttendance {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    return ['class_admin', 'teacher'].contains(auth.user?.roleName);
  }

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final isStaff = ['super_admin', 'school_admin', 'teacher', 'class_admin']
        .contains(auth.user?.roleName);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Attendance'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
        actions: [
          if (isStaff && _canMarkAttendance)
            IconButton(
              icon: const Icon(LucideIcons.save),
              tooltip: 'Save Attendance',
              onPressed: _isLoadingStudents ? null : _submitAttendance,
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null && _students.isEmpty && _classes.isEmpty
              ? Center(
                  child: Column(
                    mainAxisAlignment: MainAxisAlignment.center,
                    children: [
                      Icon(LucideIcons.circle_alert,
                          size: 48, color: Colors.red.shade300),
                      const SizedBox(height: 16),
                      Text(_errorMessage!,
                          textAlign: TextAlign.center,
                          style: TextStyle(color: Colors.red.shade700)),
                      const SizedBox(height: 16),
                      ElevatedButton(
                        onPressed: _loadInitialData,
                        child: const Text('Retry'),
                      ),
                    ],
                  ),
                )
              : isStaff
                  ? _buildStaffView()
                  : _buildStudentHistoryView(),
    );
  }

  Widget _buildStaffView() {
    return Column(
      children: [
        // Class selector + date picker row
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: Colors.white,
            boxShadow: [
              BoxShadow(
                color: Colors.grey.shade200,
                blurRadius: 4,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Row(
            children: [
              // Class Dropdown
              Expanded(
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: DropdownButtonHideUnderline(
                    child: DropdownButton<int>(
                      isExpanded: true,
                      value: _selectedClassId,
                      hint: const Text('Select Class'),
                      icon: const Icon(LucideIcons.chevron_down, size: 18),
                      items: _classes.map((cls) {
                        return DropdownMenuItem<int>(
                          value: cls.id,
                          child: Text(
                            cls.name,
                            style: const TextStyle(
                              fontSize: 14,
                              fontWeight: FontWeight.w500,
                            ),
                          ),
                        );
                      }).toList(),
                      onChanged: (value) {
                        setState(() => _selectedClassId = value);
                        _loadStudentsForClass();
                      },
                    ),
                  ),
                ),
              ),
              const SizedBox(width: 12),
              // Date Picker
              InkWell(
                onTap: _pickDate,
                borderRadius: BorderRadius.circular(8),
                child: Container(
                  padding:
                      const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                  decoration: BoxDecoration(
                    border: Border.all(color: Colors.grey.shade300),
                    borderRadius: BorderRadius.circular(8),
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(LucideIcons.calendar,
                          size: 16, color: Colors.grey.shade600),
                      const SizedBox(width: 8),
                      Text(
                        DateFormat('MMM dd, yyyy').format(_selectedDate),
                        style: const TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
        ),

        // Students list
        Expanded(
          child: _isLoadingStudents
              ? const Center(child: CircularProgressIndicator())
              : _students.isEmpty
                  ? Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Icon(LucideIcons.users,
                              size: 48, color: Colors.grey.shade400),
                          const SizedBox(height: 16),
                          Text(
                            _selectedClassId != null
                                ? 'No students found in this class'
                                : 'Please select a class',
                            style: TextStyle(
                              color: Colors.grey.shade600,
                              fontSize: 16,
                            ),
                          ),
                        ],
                      ),
                    )
                  : _buildStudentTable(),
        ),
      ],
    );
  }

  Widget _buildStudentTable() {
    return Column(
      children: [
        // Summary bar
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          color: Colors.grey.shade50,
          child: Row(
            children: [
              Text(
                '${_students.length} student${_students.length != 1 ? 's' : ''}',
                style: TextStyle(
                  color: Colors.grey.shade600,
                  fontSize: 13,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const Spacer(),
              _buildSummaryChip(
                  'P',
                  _statusMap.values.where((s) => s == 'present').length,
                  Colors.green),
              const SizedBox(width: 8),
              _buildSummaryChip(
                  'A',
                  _statusMap.values.where((s) => s == 'absent').length,
                  Colors.red),
              const SizedBox(width: 8),
              _buildSummaryChip(
                  'L',
                  _statusMap.values.where((s) => s == 'late').length,
                  Colors.orange),
            ],
          ),
        ),

        // Table header
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.indigo.shade50,
            border: Border(
              bottom: BorderSide(color: Colors.indigo.shade100),
            ),
          ),
          child: Row(
            children: [
              const Expanded(
                flex: 3,
                child: Text(
                  'Student',
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: Colors.indigo,
                  ),
                ),
              ),
              const Expanded(
                flex: 2,
                child: Text(
                  'Status',
                  textAlign: TextAlign.center,
                  style: TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                    color: Colors.indigo,
                  ),
                ),
              ),
              if (_canMarkAttendance)
                const Expanded(
                  flex: 3,
                  child: Text(
                    'Mark',
                    textAlign: TextAlign.center,
                    style: TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                      color: Colors.indigo,
                    ),
                  ),
                ),
            ],
          ),
        ),

        // Table rows
        Expanded(
          child: ListView.builder(
            itemCount: _students.length,
            itemBuilder: (context, index) {
              final student = _students[index];
              final userId = student['id'];
              final name = student['name']?.toString() ?? 'N/A';
              final status = _statusMap[userId] ?? 'not_marked';

              return Container(
                padding:
                    const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  color: index.isEven ? Colors.white : Colors.grey.shade50,
                  border: Border(
                    bottom: BorderSide(color: Colors.grey.shade200),
                  ),
                ),
                child: Row(
                  children: [
                    // Student name
                    Expanded(
                      flex: 3,
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            name,
                            style: const TextStyle(
                              fontWeight: FontWeight.w500,
                              fontSize: 14,
                            ),
                          ),
                          if (student['enrollment_no'] != null ||
                              student['enrollment_number'] != null)
                            Text(
                              'ID: ${student['enrollment_no'] ?? student['enrollment_number']}',
                              style: TextStyle(
                                fontSize: 11,
                                color: Colors.grey.shade500,
                              ),
                            ),
                        ],
                      ),
                    ),
                    // Status badge
                    Expanded(
                      flex: 2,
                      child: Center(
                        child: _buildStatusBadge(status),
                      ),
                    ),
                    // Mark buttons (only for class_admin/teacher)
                    if (_canMarkAttendance)
                      Expanded(
                        flex: 3,
                        child: Row(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            _buildMarkButton(
                              userId,
                              'present',
                              'P',
                              Colors.green,
                              status == 'present',
                            ),
                            const SizedBox(width: 4),
                            _buildMarkButton(
                              userId,
                              'absent',
                              'A',
                              Colors.red,
                              status == 'absent',
                            ),
                            const SizedBox(width: 4),
                            _buildMarkButton(
                              userId,
                              'late',
                              'L',
                              Colors.orange,
                              status == 'late',
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  Widget _buildSummaryChip(String label, int count, MaterialColor color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: color.shade200),
      ),
      child: Text(
        '$label: $count',
        style: TextStyle(
          fontSize: 12,
          fontWeight: FontWeight.w600,
          color: color.shade700,
        ),
      ),
    );
  }

  Widget _buildStatusBadge(String status) {
    Color bgColor;
    Color textColor;
    String label;
    IconData icon;

    switch (status) {
      case 'present':
        bgColor = Colors.green.shade50;
        textColor = Colors.green.shade700;
        label = 'Present';
        icon = LucideIcons.check;
        break;
      case 'absent':
        bgColor = Colors.red.shade50;
        textColor = Colors.red.shade700;
        label = 'Absent';
        icon = LucideIcons.x;
        break;
      case 'late':
        bgColor = Colors.orange.shade50;
        textColor = Colors.orange.shade700;
        label = 'Late';
        icon = LucideIcons.clock;
        break;
      default:
        bgColor = Colors.grey.shade100;
        textColor = Colors.grey.shade600;
        label = 'Not marked';
        icon = LucideIcons.minus;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: textColor),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 11,
              fontWeight: FontWeight.w600,
              color: textColor,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMarkButton(
      int userId, String status, String label, Color color, bool isActive) {
    return GestureDetector(
      onTap: () {
        setState(() {
          _statusMap[userId] = status;
        });
      },
      child: Container(
        width: 32,
        height: 32,
        decoration: BoxDecoration(
          color: isActive ? color : Colors.transparent,
          border: Border.all(color: color, width: 1.5),
          borderRadius: BorderRadius.circular(6),
        ),
        child: Center(
          child: Text(
            label,
            style: TextStyle(
              fontSize: 13,
              fontWeight: FontWeight.bold,
              color: isActive ? Colors.white : color,
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStudentHistoryView() {
    if (_attendanceHistory.isEmpty) {
      return Center(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(LucideIcons.calendar_x, size: 48, color: Colors.grey.shade400),
            const SizedBox(height: 16),
            Text(
              'No attendance records found',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
            ),
          ],
        ),
      );
    }
    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: _attendanceHistory.length,
      itemBuilder: (context, index) {
        final record = _attendanceHistory[index];
        final status = record['status']?.toString().toLowerCase() ?? 'unknown';
        Color statusColor;
        IconData statusIcon;

        switch (status) {
          case 'present':
            statusColor = Colors.green;
            statusIcon = LucideIcons.check;
            break;
          case 'absent':
            statusColor = Colors.red;
            statusIcon = LucideIcons.x;
            break;
          case 'late':
            statusColor = Colors.orange;
            statusIcon = LucideIcons.clock;
            break;
          default:
            statusColor = Colors.grey;
            statusIcon = LucideIcons.info;
        }

        return Card(
          margin: const EdgeInsets.only(bottom: 8),
          elevation: 1,
          child: ListTile(
            leading: CircleAvatar(
              backgroundColor: statusColor.withValues(alpha: 0.1),
              child: Icon(statusIcon, color: statusColor),
            ),
            title: Text(
              record['date']?.toString().split('T')[0] ?? 'N/A',
              style: const TextStyle(fontWeight: FontWeight.bold),
            ),
            subtitle: Text(record['class_name'] ?? 'Class Record'),
            trailing: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 4),
              decoration: BoxDecoration(
                color: statusColor,
                borderRadius: BorderRadius.circular(12),
              ),
              child: Text(
                status.toUpperCase(),
                style: const TextStyle(
                  color: Colors.white,
                  fontSize: 10,
                  fontWeight: FontWeight.bold,
                ),
              ),
            ),
          ),
        );
      },
    );
  }
}
