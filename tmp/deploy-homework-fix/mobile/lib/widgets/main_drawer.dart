import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../providers/auth_provider.dart';
import '../screens/dashboard_screen.dart';
import '../screens/manage_blogs_screen.dart';
import '../screens/attendance_screen.dart';
import '../screens/feedback_screen.dart';
import '../screens/timetable_screen.dart';
import '../screens/homework_screen.dart';
import '../screens/admin/school_admin_screen.dart';
import '../screens/admin/school_management_screen.dart';
import '../screens/admin/class_subject_screen.dart';
import '../screens/admin/teacher_management_screen.dart';
import '../screens/admin/live_class_admin_screen.dart';
import '../screens/live_class_screen.dart';
import '../screens/admin/profile_screen.dart';
import '../screens/admin/change_password_screen.dart';
import '../screens/admin/student_management_screen.dart';
import '../screens/notifications_screen.dart';
import '../screens/admin/class_admin_management_screen.dart';

class MainDrawer extends StatelessWidget {
  const MainDrawer({super.key});

  @override
  Widget build(BuildContext context) {
    final auth = Provider.of<AuthProvider>(context);
    final user = auth.user;
    final role = user?.roleName;

    return Drawer(
      child: Column(
        children: [
          _buildHeader(user?.name ?? 'User', user?.email ?? ''),
          Expanded(
            child: ListView(
              padding: EdgeInsets.zero,
              children: [
                _buildMenuItem(
                  context,
                  icon: LucideIcons.layout_dashboard,
                  label: 'Dashboard',
                  onTap: () => _navigate(context, const DashboardScreen()),
                ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.shield_check,
                    label: 'School Admin',
                    onTap: () => _navigate(context, const SchoolAdminScreen()),
                  ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.school,
                    label: 'School',
                    onTap: () => _navigate(context, const SchoolManagementScreen()),
                  ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.graduation_cap,
                    label: 'Class',
                    onTap: () => _navigate(context, const ClassSubjectScreen()),
                  ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.book,
                    label: 'Subject',
                    onTap: () => _navigate(context, const ClassSubjectScreen()),
                  ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.users,
                    label: 'Teacher',
                    onTap: () => _navigate(context, const TeacherManagementScreen()),
                  ),
                if (role == 'super_admin' || role == 'school_admin' || role == 'teacher' || role == 'class_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.video,
                    label: 'Live Class',
                    onTap: () => _navigate(context, const LiveClassAdminScreen()),
                  ),
                if (role == 'student')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.video,
                    label: 'Live Class',
                    onTap: () => _navigate(context, const LiveClassScreen()),
                  ),
                if (role == 'super_admin' || role == 'school_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.user_plus,
                    label: 'Student',
                    onTap: () => _navigate(context, const StudentManagementScreen()),
                  ),
                if (role == 'school_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.shield_user,
                    label: 'Class Admins',
                    onTap: () => _navigate(context, const ClassAdminManagementScreen()),
                  ),
                if (role != 'teacher')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.user_check,
                    label: 'Attendance',
                    onTap: () => _navigate(context, const AttendanceScreen()),
                  ),
                if (role == 'school_admin' || role == 'teacher' || role == 'student' || role == 'parent')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.clipboard_list,
                    label: 'Homework',
                    onTap: () => _navigate(context, const HomeworkScreen()),
                  ),
                _buildMenuItem(
                  context,
                  icon: LucideIcons.calendar,
                  label: 'Timetable',
                  onTap: () => _navigate(context, const TimetableScreen()),
                ),
                if (role != 'school_admin' &&
                    role != 'class_admin' &&
                    role != 'student' &&
                    role != 'teacher')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.message_square,
                    label: 'Feedback',
                    onTap: () => _navigate(context, const FeedbackScreen()),
                  ),
                if (role == 'super_admin')
                  _buildMenuItem(
                    context,
                    icon: LucideIcons.file_text,
                    label: 'Manage Blogs',
                    onTap: () => _navigate(context, const ManageBlogsScreen()),
                  ),

                const Divider(),
                _buildMenuItem(
                  context,
                  icon: LucideIcons.user,
                  label: 'My Profile',
                  onTap: () => _navigate(context, const AdminProfileScreen()),
                ),
                _buildMenuItem(
                  context,
                  icon: LucideIcons.lock,
                  label: 'Change Password',
                  onTap: () => _navigate(context, const ChangePasswordScreen()),
                ),
                const Divider(),
                _buildMenuItem(
                  context,
                  icon: LucideIcons.bell,
                  label: 'Notifications',
                  onTap: () => _navigate(context, const NotificationsScreen()),
                ),
                const Divider(),
                _buildMenuItem(
                  context,
                  icon: LucideIcons.log_out,
                  label: 'Logout',
                  onTap: () {
                    Navigator.pop(context); // Close drawer
                    auth.logout();
                  },
                  textColor: Colors.red,
                  iconColor: Colors.red,
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Text(
              'v0.1.0',
              style: TextStyle(color: Colors.grey[400], fontSize: 12),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildHeader(String name, String email) {
    return DrawerHeader(
      decoration: const BoxDecoration(
        color: Color(0xFF6366F1), // Matching web dashboard brand color
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          const CircleAvatar(
            backgroundColor: Colors.white24,
            radius: 30,
            child: Icon(LucideIcons.user, color: Colors.white, size: 30),
          ),
          const SizedBox(height: 12),
          Text(
            name,
            style: const TextStyle(color: Colors.white, fontSize: 18, fontWeight: FontWeight.bold),
          ),
          Text(
            email,
            style: const TextStyle(color: Colors.white70, fontSize: 14),
          ),
        ],
      ),
    );
  }

  Widget _buildMenuItem(
    BuildContext context, {
    required IconData icon,
    required String label,
    required VoidCallback onTap,
    Color? textColor,
    Color? iconColor,
  }) {
    return ListTile(
      leading: Icon(icon, color: iconColor ?? Colors.black87),
      title: Text(
        label,
        style: TextStyle(color: textColor ?? Colors.black87, fontWeight: FontWeight.w500),
      ),
      onTap: onTap,
      dense: true,
      visualDensity: VisualDensity.compact,
    );
  }

  void _navigate(BuildContext context, Widget screen) {
    Navigator.pop(context); // Close drawer
    // If we are already on the dashboard and want to stay, don't push
    if (screen is DashboardScreen && ModalRoute.of(context)?.settings.name == '/') {
      return;
    }
    Navigator.push(context, MaterialPageRoute(builder: (_) => screen));
  }
}
