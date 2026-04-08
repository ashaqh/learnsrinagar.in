import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import 'package:intl/intl.dart';
import '../providers/auth_provider.dart';
import '../services/dashboard_service.dart';
import '../widgets/main_drawer.dart';
import './notifications_screen.dart';

class DashboardScreen extends StatefulWidget {
  const DashboardScreen({super.key});

  @override
  State<DashboardScreen> createState() => _DashboardScreenState();
}

class _DashboardScreenState extends State<DashboardScreen>
    with TickerProviderStateMixin {
  final _dashboardService = DashboardService();
  Map<String, dynamic>? _dashboardData;
  bool _isLoading = true;
  String? _errorMessage;
  late TabController _tabController;

  // Filters — only used for admin/super_admin roles
  int? _selectedSchoolId;
  int? _selectedClassId;
  int? _selectedParentStudentId;
  DateTimeRange? _selectedDateRange;
  List<dynamic> _schools = [];
  List<dynamic> _classes = [];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    _fetchData();
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  Future<void> _fetchData() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    final result = await _dashboardService.getDashboardData(
      auth.token!,
      schoolId: _selectedSchoolId,
      classId: _selectedClassId,
      studentId: _selectedParentStudentId,
      fromDate: _selectedDateRange?.start != null
          ? DateFormat('yyyy-MM-dd').format(_selectedDateRange!.start)
          : null,
      toDate: _selectedDateRange?.end != null
          ? DateFormat('yyyy-MM-dd').format(_selectedDateRange!.end)
          : null,
    );

    if (mounted) {
      setState(() {
        if (result['success']) {
          _dashboardData = result['data'];
          _schools = _dashboardData?['schoolsList'] ?? [];
          _classes = _dashboardData?['classesList'] ?? [];
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final role = Provider.of<AuthProvider>(
      context,
      listen: false,
    ).user?.roleName;

    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: _buildBreadcrumbs(),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.bell),
            onPressed: () {
              Navigator.push(
                context,
                MaterialPageRoute(
                  builder: (context) => const NotificationsScreen(),
                ),
              );
            },
          ),
          const SizedBox(width: 8),
        ],
      ),
      drawer: const MainDrawer(),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
          ? Center(
              child: Padding(
                padding: const EdgeInsets.all(24.0),
                child: Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Icon(
                      LucideIcons.wifi_off,
                      size: 48,
                      color: Colors.indigo.shade200,
                    ),
                    const SizedBox(height: 16),
                    Text(
                      'Connection Error',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _errorMessage!,
                      textAlign: TextAlign.center,
                      style: const TextStyle(color: Colors.grey),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () {
                        setState(() {
                          _isLoading = true;
                          _errorMessage = null;
                        });
                        _fetchData();
                      },
                      icon: const Icon(LucideIcons.refresh_cw, size: 18),
                      label: const Text('Try Again'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.blue,
                        foregroundColor: Colors.white,
                      ),
                    ),
                  ],
                ),
              ),
            )
          : role == 'parent' || role == 'student'
          ? _buildLearnerDashboard(role ?? '')
          : _buildAdminDashboard(),
    );
  }

  Widget _buildAdminDashboard() {
    return RefreshIndicator(
      onRefresh: _fetchData,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16.0),
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                const Text(
                  'Insights',
                  style: TextStyle(
                    fontSize: 28,
                    fontWeight: FontWeight.w900,
                    color: Colors.black,
                  ),
                ),
                Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: 12,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Colors.blue.withValues(alpha: 0.1),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Row(
                    children: [
                      Icon(LucideIcons.calendar, size: 14, color: Colors.blue),
                      const SizedBox(width: 6),
                      Text(
                        _selectedDateRange != null
                            ? '${DateFormat('MMM d').format(_selectedDateRange!.start)} - ${DateFormat('MMM d').format(_selectedDateRange!.end)}'
                            : 'All Dates',
                        style: const TextStyle(
                          fontSize: 12,
                          fontWeight: FontWeight.bold,
                          color: Colors.blue,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 20),
            _buildFiltersCard(),
            const SizedBox(height: 24),
            _buildAnalyticsTabs(),
            const SizedBox(height: 24),
            _buildSelectedTabContent(),
          ],
        ),
      ),
    );
  }

  // ── Parent Dashboard ────────────────────────────────────────────────────────
  Widget _buildLearnerDashboard(String role) {
    final user = Provider.of<AuthProvider>(context, listen: false).user;
    final hour = DateTime.now().hour;
    final greeting = hour < 12
        ? 'Good Morning'
        : hour < 17
        ? 'Good Afternoon'
        : 'Good Evening';

    final studentInfo = _dashboardData?['studentInfo'];
    final studentName = studentInfo?['student_name']?.toString() ?? '';
    final className = studentInfo?['class_name']?.toString() ?? '';

    final attendance = (_dashboardData?['attendance'] as List?) ?? [];
    final timetable = (_dashboardData?['timetable'] as List?) ?? [];
    final homework = (_dashboardData?['homework'] as List?) ?? [];
    final allStudents = (_dashboardData?['allStudents'] as List?) ?? [];
    final activeStudentId = _dashboardData?['activeStudentId'] as int?;

    final presentCount = attendance
        .where((a) => a['status'] == 'present')
        .length;
    final absentCount = attendance.where((a) => a['status'] == 'absent').length;
    final lateCount = attendance.where((a) => a['status'] == 'late').length;
    final total = attendance.length;
    final presentPct = total > 0 ? (presentCount / total * 100).round() : 0;

    final todayStr = DateFormat('yyyy-MM-dd').format(DateTime.now());
    final todayClasses = timetable.where((t) {
      final d = t['class_date']?.toString().split('T')[0] ?? '';
      return d == todayStr;
    }).toList();
    final upcomingClasses = timetable.where((t) {
      final d = t['class_date']?.toString().split('T')[0] ?? '';
      return d != todayStr;
    }).toList();

    return RefreshIndicator(
      onRefresh: _fetchData,
      child: SingleChildScrollView(
        padding: const EdgeInsets.all(16),
        physics: const AlwaysScrollableScrollPhysics(),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // ── Welcome Banner ──
            Container(
              width: double.infinity,
              decoration: BoxDecoration(
                gradient: const LinearGradient(
                  colors: [Color(0xFF4F46E5), Color(0xFF7C3AED)],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(20),
                boxShadow: [
                  BoxShadow(
                    color: const Color(0xFF4F46E5).withValues(alpha: 0.3),
                    blurRadius: 16,
                    offset: const Offset(0, 6),
                  ),
                ],
              ),
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    '$greeting, ${user?.name.split(' ').first ?? ''}',
                    style: const TextStyle(
                      color: Color(0xFFBFB2FF),
                      fontSize: 13,
                    ),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              studentName.isNotEmpty
                                  ? studentName
                                  : role == 'student'
                                  ? 'My Dashboard'
                                  : "Your Child's Dashboard",
                              style: const TextStyle(
                                color: Colors.white,
                                fontSize: 24,
                                fontWeight: FontWeight.bold,
                              ),
                            ),
                            if (className.isNotEmpty)
                              Padding(
                                padding: const EdgeInsets.only(top: 4),
                                child: Text(
                                  'Class $className',
                                  style: TextStyle(
                                    color: Colors.white.withValues(alpha: 0.8),
                                    fontSize: 14,
                                  ),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (role == 'parent' && allStudents.length > 1)
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          decoration: BoxDecoration(
                            color: Colors.white.withValues(alpha: 0.2),
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: DropdownButtonHideUnderline(
                            child: DropdownButton<int>(
                              value:
                                  _selectedParentStudentId ?? activeStudentId,
                              dropdownColor: const Color(0xFF4F46E5),
                              icon: const Icon(
                                LucideIcons.chevron_down,
                                color: Colors.white,
                                size: 16,
                              ),
                              items: allStudents.map<DropdownMenuItem<int>>((
                                s,
                              ) {
                                return DropdownMenuItem<int>(
                                  value: s['user_id'] is int
                                      ? s['user_id']
                                      : int.tryParse(s['user_id'].toString()),
                                  child: Text(
                                    s['name'].toString(),
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontSize: 13,
                                    ),
                                  ),
                                );
                              }).toList(),
                              onChanged: (val) {
                                if (val != null) {
                                  setState(() {
                                    _selectedParentStudentId = val;
                                    _isLoading = true;
                                  });
                                  _fetchData();
                                }
                              },
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ),
            ),
            const SizedBox(height: 24),

            // ── Attendance Card ──
            _buildSectionCard(
              icon: LucideIcons.user_check,
              iconColor: const Color(0xFF059669),
              title: 'Attendance',
              subtitle: 'Last $total recorded days',
              trailing: Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    '$presentPct%',
                    style: TextStyle(
                      fontSize: 22,
                      fontWeight: FontWeight.bold,
                      color: presentPct >= 75
                          ? const Color(0xFF059669)
                          : Colors.red,
                    ),
                  ),
                  const Text(
                    'present',
                    style: TextStyle(fontSize: 11, color: Colors.grey),
                  ),
                ],
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Stat chips
                  Wrap(
                    spacing: 8,
                    runSpacing: 6,
                    children: [
                      _attChip(
                        '$presentCount Present',
                        Colors.green,
                        LucideIcons.circle_check,
                      ),
                      _attChip(
                        '$absentCount Absent',
                        Colors.red,
                        LucideIcons.circle_x,
                      ),
                      if (lateCount > 0)
                        _attChip(
                          '$lateCount Late',
                          Colors.orange,
                          LucideIcons.circle_alert,
                        ),
                    ],
                  ),
                  const SizedBox(height: 16),
                  // Day dots
                  if (attendance.isEmpty)
                    Text(
                      'No attendance records yet.',
                      style: TextStyle(color: Colors.grey[500]),
                    )
                  else
                    Wrap(
                      spacing: 8,
                      runSpacing: 10,
                      children: attendance.reversed.map((a) {
                        final status = a['status']?.toString() ?? '';
                        final rawDate =
                            a['date']?.toString().split('T')[0] ?? '';
                        String label = '';
                        try {
                          label = DateFormat(
                            'MMM d',
                          ).format(DateTime.parse(rawDate));
                        } catch (_) {
                          label = rawDate;
                        }
                        final bg = status == 'present'
                            ? Colors.green
                            : status == 'absent'
                            ? Colors.red
                            : Colors.orange;
                        return Column(
                          children: [
                            Container(
                              width: 36,
                              height: 36,
                              decoration: BoxDecoration(
                                color: bg,
                                shape: BoxShape.circle,
                              ),
                              alignment: Alignment.center,
                              child: Text(
                                status == 'present'
                                    ? 'P'
                                    : status == 'absent'
                                    ? 'A'
                                    : 'L',
                                style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 12,
                                  fontWeight: FontWeight.bold,
                                ),
                              ),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              label,
                              style: const TextStyle(
                                fontSize: 9,
                                color: Colors.grey,
                              ),
                            ),
                          ],
                        );
                      }).toList(),
                    ),
                ],
              ),
            ),
            const SizedBox(height: 16),

            // ── Today's Schedule ──
            _buildSectionCard(
              icon: LucideIcons.clock,
              iconColor: const Color(0xFF4F46E5),
              title: "Today's Schedule",
              subtitle: DateFormat('EEEE, MMMM d').format(DateTime.now()),
              child: todayClasses.isEmpty
                  ? Text(
                      'No classes scheduled for today.',
                      style: TextStyle(color: Colors.grey[500]),
                    )
                  : Column(
                      children: todayClasses
                          .map((cls) => _buildClassTile(cls, highlight: true))
                          .toList(),
                    ),
            ),
            if (upcomingClasses.isNotEmpty) ...[
              const SizedBox(height: 16),
              _buildSectionCard(
                icon: LucideIcons.calendar,
                iconColor: Colors.blueGrey,
                title: 'Upcoming This Week',
                subtitle: '${upcomingClasses.length} sessions',
                child: Column(
                  children: upcomingClasses
                      .map((cls) => _buildClassTile(cls))
                      .toList(),
                ),
              ),
            ],
            const SizedBox(height: 16),

            // ── Recent Homework ──
            _buildSectionCard(
              icon: LucideIcons.book_open,
              iconColor: const Color(0xFF7C3AED),
              title: 'Recent Homework',
              subtitle: role == 'student'
                  ? 'Latest assignments for you'
                  : studentName.isNotEmpty
                  ? 'Latest assignments for $studentName'
                  : 'Latest assignments',
              child: homework.isEmpty
                  ? Text(
                      'No homework assignments yet.',
                      style: TextStyle(color: Colors.grey[500]),
                    )
                  : Column(
                      children: homework.asMap().entries.map((entry) {
                        final hw = entry.value;
                        final isLast = entry.key == homework.length - 1;
                        final rawDate =
                            hw['created_at']?.toString().split('T')[0] ?? '';
                        String dateLabel = rawDate;
                        try {
                          dateLabel = DateFormat(
                            'MMM d',
                          ).format(DateTime.parse(rawDate));
                        } catch (_) {}

                        return Column(
                          children: [
                            Padding(
                              padding: const EdgeInsets.symmetric(vertical: 8),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Container(
                                    width: 8,
                                    height: 8,
                                    margin: const EdgeInsets.only(top: 5),
                                    decoration: const BoxDecoration(
                                      color: Color(0xFF7C3AED),
                                      shape: BoxShape.circle,
                                    ),
                                  ),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          hw['title']?.toString() ?? 'Untitled',
                                          style: const TextStyle(
                                            fontWeight: FontWeight.w600,
                                            fontSize: 13,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          '${hw['subject_name'] ?? ''} · ${hw['teacher_name'] ?? ''}',
                                          style: const TextStyle(
                                            fontSize: 11,
                                            color: Colors.grey,
                                          ),
                                        ),
                                        if (hw['description'] != null &&
                                            hw['description']
                                                .toString()
                                                .isNotEmpty) ...[
                                          const SizedBox(height: 4),
                                          Text(
                                            hw['description'].toString(),
                                            maxLines: 2,
                                            overflow: TextOverflow.ellipsis,
                                            style: TextStyle(
                                              fontSize: 12,
                                              color: Colors.grey[600],
                                            ),
                                          ),
                                        ],
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: 8,
                                      vertical: 3,
                                    ),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFFF3E8FF),
                                      borderRadius: BorderRadius.circular(12),
                                    ),
                                    child: Text(
                                      dateLabel,
                                      style: const TextStyle(
                                        fontSize: 10,
                                        color: Color(0xFF7C3AED),
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                            if (!isLast) const Divider(height: 1),
                          ],
                        );
                      }).toList(),
                    ),
            ),
            const SizedBox(height: 24),
          ],
        ),
      ),
    );
  }

  Widget _buildSectionCard({
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required Widget child,
    Widget? trailing,
  }) {
    final trailingWidgets = trailing == null
        ? const <Widget>[]
        : <Widget>[trailing];

    return Container(
      width: double.infinity,
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.05),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: iconColor.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Icon(icon, size: 18, color: iconColor),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    Text(
                      subtitle,
                      style: const TextStyle(fontSize: 11, color: Colors.grey),
                    ),
                  ],
                ),
              ),
              ...trailingWidgets,
            ],
          ),
          const SizedBox(height: 14),
          child,
        ],
      ),
    );
  }

  Widget _attChip(String label, MaterialColor color, IconData icon) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
      decoration: BoxDecoration(
        color: color.shade50,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.shade200),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color.shade700),
          const SizedBox(width: 4),
          Text(
            label,
            style: TextStyle(
              fontSize: 12,
              color: color.shade700,
              fontWeight: FontWeight.w500,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildClassTile(dynamic cls, {bool highlight = false}) {
    final subject = cls['subject_name']?.toString() ?? '';
    final teacher = cls['teacher_name']?.toString() ?? '';
    final startTime = cls['start_time']?.toString() ?? '';
    final endTime = cls['end_time']?.toString() ?? '';
    final zoomLink = cls['zoom_link']?.toString() ?? '';
    final ytLink = cls['youtube_live_link']?.toString() ?? '';
    final dayOfWeek = cls['day_of_week']?.toString() ?? '';
    final hasLink = zoomLink.isNotEmpty || ytLink.isNotEmpty;
    final joinUrl = zoomLink.isNotEmpty ? zoomLink : ytLink;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: highlight ? const Color(0xFFEEF2FF) : Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: highlight ? const Color(0xFFC7D2FE) : Colors.grey.shade200,
        ),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: highlight ? const Color(0xFF4F46E5) : Colors.blueGrey,
              borderRadius: BorderRadius.circular(10),
            ),
            child: const Icon(LucideIcons.video, size: 16, color: Colors.white),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  subject,
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 13,
                  ),
                ),
                Text(
                  '$teacher · $startTime${endTime.isNotEmpty ? ' – $endTime' : ''}${!highlight && dayOfWeek.isNotEmpty ? ' · $dayOfWeek' : ''}',
                  style: const TextStyle(fontSize: 11, color: Colors.grey),
                ),
              ],
            ),
          ),
          if (hasLink)
            GestureDetector(
              onTap: () {
                // Would use url_launcher in production
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('Join: $joinUrl'),
                    duration: const Duration(seconds: 3),
                  ),
                );
              },
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 5,
                ),
                decoration: BoxDecoration(
                  color: const Color(0xFF4F46E5),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Text(
                  'Join',
                  style: TextStyle(
                    color: Colors.white,
                    fontSize: 11,
                    fontWeight: FontWeight.w600,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }

  Widget _buildBreadcrumbs() {
    return Row(
      children: [
        Text(
          'Learn Srinagar',
          style: TextStyle(color: Colors.grey[600], fontSize: 14),
        ),
        Icon(LucideIcons.chevron_right, size: 16, color: Colors.grey[400]),
        const Text(
          'Dashboard',
          style: TextStyle(
            color: Colors.black87,
            fontSize: 14,
            fontWeight: FontWeight.w500,
          ),
        ),
      ],
    );
  }

  Widget _buildFiltersCard() {
    final role =
        Provider.of<AuthProvider>(context, listen: false).user?.roleName;
    String dateLabel = 'All Dates';
    if (_selectedDateRange != null) {
      dateLabel =
          '${DateFormat('MMM d').format(_selectedDateRange!.start)} - ${DateFormat('MMM d').format(_selectedDateRange!.end)}';
    }

    if (role == 'teacher') {
      return Card(
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: BorderSide(color: Colors.grey[200]!),
        ),
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Filters',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: [
                  _buildDateFilterButton(dateLabel, LucideIcons.calendar),
                  if (_selectedDateRange != null)
                    OutlinedButton(
                      onPressed: () {
                        setState(() {
                          _selectedDateRange = null;
                        });
                        _fetchData();
                      },
                      style: OutlinedButton.styleFrom(
                        foregroundColor: Colors.grey[700],
                        side: BorderSide(color: Colors.grey[300]!),
                        shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(8),
                        ),
                        padding: const EdgeInsets.symmetric(
                          horizontal: 12,
                          vertical: 8,
                        ),
                      ),
                      child: const Text('Clear'),
                    ),
                ],
              ),
            ],
          ),
        ),
      );
    }

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'Filters',
              style: TextStyle(
                color: Colors.grey[600],
                fontWeight: FontWeight.w500,
              ),
            ),
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: [
                  _buildDropdownFilter(
                    value: _selectedSchoolId,
                    hint: 'All Schools',
                    icon: LucideIcons.school,
                    items: _schools,
                    onChanged: (val) {
                      setState(() {
                        _selectedSchoolId = val;
                        _fetchData();
                      });
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildDropdownFilter(
                    value: _selectedClassId,
                    hint: 'All Classes',
                    icon: LucideIcons.graduation_cap,
                    items: _classes,
                    onChanged: (val) {
                      setState(() {
                        _selectedClassId = val;
                        _fetchData();
                      });
                    },
                  ),
                  const SizedBox(width: 8),
                  _buildDateFilterButton(dateLabel, LucideIcons.calendar),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildDropdownFilter({
    required int? value,
    required String hint,
    required IconData icon,
    required List<dynamic> items,
    required Function(int?) onChanged,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Colors.grey[300]!),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: Colors.grey[600]),
          const SizedBox(width: 8),
          DropdownButton<int>(
            value: value,
            hint: Text(hint, style: const TextStyle(fontSize: 13)),
            underline: const SizedBox(),
            style: const TextStyle(color: Colors.black87, fontSize: 13),
            items: [
              DropdownMenuItem<int>(value: null, child: Text(hint)),
              ...items.map((item) {
                return DropdownMenuItem<int>(
                  value: item['id'],
                  child: Text(item['name'].toString()),
                );
              }),
            ],
            onChanged: onChanged,
          ),
        ],
      ),
    );
  }

  Widget _buildDateFilterButton(String label, IconData icon) {
    return OutlinedButton.icon(
      onPressed: () async {
        final picked = await showDateRangePicker(
          context: context,
          firstDate: DateTime(2023),
          lastDate: DateTime.now().add(const Duration(days: 30)),
          initialDateRange: _selectedDateRange,
        );
        if (picked != null) {
          setState(() {
            _selectedDateRange = picked;
            _fetchData();
          });
        }
      },
      icon: Icon(icon, size: 16),
      label: Text(label),
      style: OutlinedButton.styleFrom(
        foregroundColor: Colors.black87,
        side: BorderSide(color: Colors.grey[300]!),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      ),
    );
  }

  Widget _buildAnalyticsTabs() {
    final role =
        Provider.of<AuthProvider>(context, listen: false).user?.roleName;
    final isTeacher = role == 'teacher';
    final isSchoolAdminLike =
        role == 'school_admin' || role == 'class_admin';

    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: Colors.grey[200],
        borderRadius: BorderRadius.circular(12),
      ),
      child: TabBar(
        controller: _tabController,
        indicator: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(8),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.05),
              blurRadius: 4,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        labelColor: Colors.black,
        unselectedLabelColor: Colors.grey[600],
        tabs: [
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(LucideIcons.layout_dashboard, size: 16),
                SizedBox(width: 4),
                Text('Overview'),
              ],
            ),
          ),
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isTeacher || isSchoolAdminLike
                      ? LucideIcons.book_open
                      : LucideIcons.message_square,
                  size: 16,
                ),
                SizedBox(width: 4),
                Text(isTeacher || isSchoolAdminLike ? 'Homework' : 'Feedback'),
              ],
            ),
          ),
          Tab(
            child: Row(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Icon(
                  isTeacher ? LucideIcons.calendar_days : LucideIcons.user_check,
                  size: 16,
                ),
                SizedBox(width: 4),
                Text(isTeacher ? 'Timetable' : 'Attendance'),
              ],
            ),
          ),
        ],
        onTap: (index) => setState(() {}),
      ),
    );
  }

  Widget _buildSelectedTabContent() {
    final role =
        Provider.of<AuthProvider>(context, listen: false).user?.roleName;

    if (role == 'teacher') {
      switch (_tabController.index) {
        case 0:
          return _buildOverviewContent();
        case 1:
          return _buildTeacherHomeworkTabContent();
        case 2:
          return _buildTeacherTimetableTabContent();
        default:
          return const SizedBox.shrink();
      }
    }

    if (role == 'school_admin' || role == 'class_admin') {
      switch (_tabController.index) {
        case 0:
          return _buildOverviewContent();
        case 1:
          return _buildSchoolHomeworkTabContent();
        case 2:
          return _buildAttendanceTabContent();
        default:
          return const SizedBox.shrink();
      }
    }

    switch (_tabController.index) {
      case 0:
        return _buildOverviewContent();
      case 1:
        return _buildFeedbackTabContent();
      case 2:
        return _buildAttendanceTabContent();
      default:
        return const SizedBox.shrink();
    }
  }

  Widget _buildOverviewContent() {
    final liveClassSummary =
        (_dashboardData?['liveClassSummary'] as List?) ?? [];
    final isDateFiltered = _selectedDateRange != null;
    final scheduledTotal = liveClassSummary.fold<int>(
      0,
      (sum, item) => sum + _toInt(item['scheduled_count']),
    );
    final completedTotal = liveClassSummary.fold<int>(
      0,
      (sum, item) => sum + _toInt(item['completed_count']),
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Row(
          children: [
            Expanded(
              child: _buildMetricSummaryCard(
                title: 'Scheduled',
                value: '$scheduledTotal',
                color: Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricSummaryCard(
                title: 'Completed',
                value: '$completedTotal',
                color: Colors.green,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        Card(
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey[200]!),
          ),
          child: Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text(
                  'Live Classes By Date',
                  style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
                ),
                const Text(
                  'Future scheduled vs previous completed live classes in descending date order',
                  style: TextStyle(fontSize: 12, color: Colors.grey),
                ),
                const SizedBox(height: 20),
                if (liveClassSummary.isEmpty)
                  Padding(
                    padding: EdgeInsets.symmetric(vertical: 24),
                    child: Center(
                      child: Text(
                        isDateFiltered
                            ? 'No live class summary available for the selected range. Clear the date filter to view all records.'
                            : 'No live class summary available.',
                        textAlign: TextAlign.center,
                      ),
                    ),
                  )
                else
                  ...liveClassSummary.map(
                    (item) => _buildLiveClassSummaryCard(item),
                  ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildFeedbackTabContent() {
    final recentFeedback = _dashboardData?['recentFeedback'] as List? ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _buildSummaryStats(),
        const SizedBox(height: 24),
        const Padding(
          padding: EdgeInsets.zero,
          child: Text(
            'Recent Detailed Feedback',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
          ),
        ),
        const SizedBox(height: 16),
        if (recentFeedback.isEmpty)
          const Center(
            child: Padding(
              padding: EdgeInsets.all(40),
              child: Text('No detailed feedback yet.'),
            ),
          )
        else
          ...recentFeedback.map(
            (f) => _buildFeedbackSubmissionCard(f as Map<String, dynamic>),
          ),
      ],
    );
  }

  Widget _buildAttendanceTabContent() {
    final schoolAttendanceSummary =
        (_dashboardData?['schoolAttendanceSummary'] as List?) ?? [];

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Schoolwise Attendance',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text(
              'No. of students present vs absent across the selected range',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            if (schoolAttendanceSummary.isEmpty)
              const Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(child: Text('No attendance summary available.')),
              )
            else
              ...schoolAttendanceSummary.map(
                (item) => _buildSchoolAttendanceCard(item),
              ),
          ],
        ),
      ),
    );
  }

  Widget _buildTeacherHomeworkTabContent() {
    final teacherHomework = (_dashboardData?['teacherHomework'] as List?) ?? [];
    final isDateFiltered = _selectedDateRange != null;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Assigned Homework',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Homework assigned by you in descending date order',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            if (teacherHomework.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    isDateFiltered
                        ? 'No homework found for the selected range. Clear the date filter to view all records.'
                        : 'No homework found.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              ...teacherHomework.map((item) => _buildTeacherHomeworkCard(item)),
          ],
        ),
      ),
    );
  }

  Widget _buildSchoolHomeworkTabContent() {
    final schoolHomework = (_dashboardData?['schoolHomework'] as List?) ?? [];
    final isDateFiltered = _selectedDateRange != null;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Homework',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Latest 10 homework items from your school in descending date order',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            if (schoolHomework.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    isDateFiltered
                        ? 'No homework found for the selected range. Clear the date filter to view all records.'
                        : 'No homework found.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              ...schoolHomework.map((item) => _buildTeacherHomeworkCard(item)),
          ],
        ),
      ),
    );
  }

  Widget _buildTeacherTimetableTabContent() {
    final teacherTimetable =
        (_dashboardData?['teacherTimetable'] as List?) ?? [];
    final isDateFiltered = _selectedDateRange != null;

    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Timetable',
              style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
            ),
            const Text(
              'Classes in descending date order with scheduled/completed status',
              style: TextStyle(fontSize: 12, color: Colors.grey),
            ),
            const SizedBox(height: 20),
            if (teacherTimetable.isEmpty)
              Padding(
                padding: EdgeInsets.symmetric(vertical: 24),
                child: Center(
                  child: Text(
                    isDateFiltered
                        ? 'No timetable entries found for the selected range. Clear the date filter to view all records.'
                        : 'No timetable entries found.',
                    textAlign: TextAlign.center,
                  ),
                ),
              )
            else
              ...teacherTimetable.map((item) => _buildTeacherTimetableCard(item)),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricSummaryCard({
    required String title,
    required String value,
    required Color color,
  }) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
          const SizedBox(height: 8),
          Text(
            value,
            style: TextStyle(
              fontSize: 24,
              fontWeight: FontWeight.bold,
              color: color,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildLiveClassSummaryCard(dynamic item) {
    final scheduledCount = _toInt(item['scheduled_count']);
    final completedCount = _toInt(item['completed_count']);
    final total = scheduledCount + completedCount;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _formatDashboardDate(item['session_date']),
            style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14),
          ),
          const SizedBox(height: 4),
          Text(
            'Total sessions: $total',
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildCountChip(
                  label: 'Scheduled',
                  value: scheduledCount,
                  background: const Color(0xFFEFF6FF),
                  foreground: const Color(0xFF1D4ED8),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildCountChip(
                  label: 'Completed',
                  value: completedCount,
                  background: const Color(0xFFECFDF5),
                  foreground: const Color(0xFF047857),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTeacherHomeworkCard(dynamic item) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['title']?.toString() ?? 'Untitled Homework',
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item['subject_name'] ?? 'General'} • Class ${item['class_name'] ?? '-'}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                    if ((item['teacher_name']?.toString().trim().isNotEmpty ??
                        false))
                      Padding(
                        padding: const EdgeInsets.only(top: 4),
                        child: Text(
                          'Teacher: ${item['teacher_name']}',
                          style: TextStyle(
                            color: Colors.grey[500],
                            fontSize: 12,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Text(
                _formatDashboardDate(item['created_at']),
                textAlign: TextAlign.right,
                style: TextStyle(color: Colors.grey[600], fontSize: 12),
              ),
            ],
          ),
          if ((item['description']?.toString().trim().isNotEmpty ?? false)) ...[
            const SizedBox(height: 10),
            Text(
              item['description'].toString(),
              style: TextStyle(color: Colors.grey[700], fontSize: 13),
            ),
          ],
        ],
      ),
    );
  }

  Widget _buildTeacherTimetableCard(dynamic item) {
    final status =
        item['dashboard_status']?.toString() == 'completed'
        ? 'completed'
        : 'scheduled';
    final statusBackground = status == 'completed'
        ? const Color(0xFFFEE2E2)
        : const Color(0xFFDCFCE7);
    final statusForeground = status == 'completed'
        ? const Color(0xFFB91C1C)
        : const Color(0xFF166534);

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item['topic_name']?.toString().isNotEmpty == true
                          ? item['topic_name'].toString()
                          : (item['title']?.toString().isNotEmpty == true
                                ? item['title'].toString()
                                : item['subject_name']?.toString() ??
                                      'Untitled Class'),
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 14,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${item['subject_name'] ?? 'General'} • Class ${item['class_name'] ?? '-'}',
                      style: TextStyle(color: Colors.grey[600], fontSize: 12),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                decoration: BoxDecoration(
                  color: statusBackground,
                  borderRadius: BorderRadius.circular(999),
                ),
                child: Text(
                  status == 'completed' ? 'Completed' : 'Scheduled',
                  style: TextStyle(
                    color: statusForeground,
                    fontWeight: FontWeight.w700,
                    fontSize: 12,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            _formatDashboardDate(item['start_time']),
            style: TextStyle(color: Colors.grey[700], fontSize: 13),
          ),
          const SizedBox(height: 4),
          Text(
            _formatTimeRange(item['start_time'], item['end_time']),
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
        ],
      ),
    );
  }

  Widget _buildSchoolAttendanceCard(dynamic item) {
    final presentCount = _toInt(item['present_count']);
    final absentCount = _toInt(item['absent_count']);
    final total = presentCount + absentCount;
    final presentRate = total > 0 ? ((presentCount / total) * 100).round() : 0;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: Colors.grey[50],
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  item['school_name']?.toString() ?? 'Unknown School',
                  style: const TextStyle(
                    fontWeight: FontWeight.w600,
                    fontSize: 14,
                  ),
                ),
              ),
              Text(
                '$presentRate% present',
                style: TextStyle(
                  color: Colors.grey[600],
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Text(
            'Total marked attendance: $total',
            style: TextStyle(color: Colors.grey[600], fontSize: 12),
          ),
          const SizedBox(height: 10),
          Row(
            children: [
              Expanded(
                child: _buildCountChip(
                  label: 'Present',
                  value: presentCount,
                  background: const Color(0xFFECFDF5),
                  foreground: const Color(0xFF047857),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: _buildCountChip(
                  label: 'Absent',
                  value: absentCount,
                  background: const Color(0xFFFEF2F2),
                  foreground: const Color(0xFFB91C1C),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildCountChip({
    required String label,
    required int value,
    required Color background,
    required Color foreground,
  }) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(10),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(label, style: TextStyle(color: foreground, fontSize: 12)),
          const SizedBox(height: 4),
          Text(
            '$value',
            style: TextStyle(
              color: foreground,
              fontSize: 20,
              fontWeight: FontWeight.bold,
            ),
          ),
        ],
      ),
    );
  }

  String _formatDashboardDate(dynamic rawDate) {
    if (rawDate == null) return 'Unknown date';

    try {
      return DateFormat(
        'EEEE, MMM d, yyyy',
      ).format(DateTime.parse(rawDate.toString()));
    } catch (_) {
      return rawDate.toString();
    }
  }

  int _toInt(dynamic value) {
    if (value is int) return value;
    return int.tryParse(value?.toString() ?? '0') ?? 0;
  }

  String _formatTimeRange(dynamic startRaw, dynamic endRaw) {
    try {
      final start = DateTime.parse(startRaw.toString()).toLocal();
      final startText = DateFormat('hh:mm a').format(start);
      if (endRaw == null) return startText;

      final end = DateTime.parse(endRaw.toString()).toLocal();
      return '$startText - ${DateFormat('hh:mm a').format(end)}';
    } catch (_) {
      return '-';
    }
  }

  Widget _buildFeedbackSubmissionCard(Map<String, dynamic> submission) {
    final items = submission['items'] as List? ?? [];
    final date = DateTime.parse(submission['created_at']);
    final formattedDate = DateFormat('MMM d, yyyy').format(date);

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 2,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: Colors.grey[50],
              borderRadius: const BorderRadius.vertical(
                top: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: Colors.blue.withValues(alpha: 0.1),
                  child: Text(
                    submission['parent_name'][0],
                    style: const TextStyle(
                      color: Colors.blue,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        submission['parent_name'],
                        style: const TextStyle(
                          fontWeight: FontWeight.bold,
                          fontSize: 16,
                        ),
                      ),
                      Text(
                        'Parent of ${submission['student_name']}',
                        style: TextStyle(color: Colors.grey[600], fontSize: 13),
                      ),
                    ],
                  ),
                ),
                Text(
                  formattedDate,
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              children: items.map((item) {
                return Padding(
                  padding: const EdgeInsets.only(bottom: 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item['question'],
                        style: const TextStyle(
                          fontWeight: FontWeight.w500,
                          height: 1.4,
                          fontSize: 14,
                        ),
                      ),
                      const SizedBox(height: 8),
                      Row(
                        children: [
                          _buildStarRating(item['rating']),
                          const SizedBox(width: 8),
                          Text(
                            '${item['rating']}/5',
                            style: TextStyle(
                              color: Colors.grey[600],
                              fontSize: 12,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ],
                      ),
                      if (item['comment'] != null &&
                          item['comment'].toString().trim().isNotEmpty) ...[
                        const SizedBox(height: 8),
                        Container(
                          width: double.infinity,
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: Colors.blue.withValues(alpha: 0.05),
                            borderRadius: BorderRadius.circular(8),
                            border: Border.all(
                              color: Colors.blue.withValues(alpha: 0.1),
                            ),
                          ),
                          child: Text(
                            '"${item['comment']}"',
                            style: TextStyle(
                              color: Colors.blue[900],
                              fontStyle: FontStyle.italic,
                              fontSize: 13,
                            ),
                          ),
                        ),
                      ],
                      if (item != items.last) ...[
                        const SizedBox(height: 16),
                        const Divider(height: 1),
                      ],
                    ],
                  ),
                );
              }).toList(),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildStarRating(int rating) {
    return Row(
      children: List.generate(5, (index) {
        return Icon(
          index < rating ? Icons.star : Icons.star_border,
          color: Colors.amber,
          size: 16,
        );
      }),
    );
  }

  Widget _buildSummaryStats() {
    final feedback = _dashboardData?['feedback'] ?? {};

    return Column(
      children: [
        _buildSummaryCard(
          'Academic Feedback',
          '${feedback['academic'] ?? '0.0'}/5',
          Colors.blue,
        ),
        const SizedBox(height: 12),
        _buildSummaryCard(
          'Behavioral Feedback',
          '${feedback['behavioral'] ?? '0.0'}/5',
          Colors.green,
        ),
        const SizedBox(height: 12),
        _buildSummaryCard(
          'Overall Satisfaction',
          '${feedback['satisfaction'] ?? '0'}%',
          Colors.orange,
        ),
      ],
    );
  }

  Widget _buildSummaryCard(String title, String value, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Row(
            children: [
              Container(
                width: 4,
                height: 40,
                decoration: BoxDecoration(
                  color: color,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 12),
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(color: Colors.grey[600], fontSize: 13),
                  ),
                  Text(
                    value,
                    style: const TextStyle(
                      fontSize: 18,
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                ],
              ),
            ],
          ),
          Icon(LucideIcons.chevron_right, color: Colors.grey[300]),
        ],
      ),
    );
  }
}
