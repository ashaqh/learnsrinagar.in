import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import 'change_password_screen.dart';

class AdminProfileScreen extends StatelessWidget {
  const AdminProfileScreen({super.key});

  @override
  Widget build(BuildContext context) {
    final authProvider = Provider.of<AuthProvider>(context);
    final user = authProvider.user;

    if (user == null) {
      return const Scaffold(body: Center(child: Text('User not found')));
    }

    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin Profile'),
        elevation: 0,
        backgroundColor: Colors.transparent,
        foregroundColor: Colors.black,
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(24.0),
        child: Column(
          children: [
            // Head Section
            CircleAvatar(
              radius: 50,
              backgroundColor: const Color(0xFF6366F1).withAlpha(20),
              child: const Icon(LucideIcons.user, size: 50, color: Color(0xFF6366F1)),
            ),
            const SizedBox(height: 16),
            Text(
              user.name ?? 'Administrator',
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold),
            ),
            Text(
              user.roleName.toUpperCase().replaceAll('_', ' '),
              style: TextStyle(color: Colors.grey[600], fontSize: 14, fontWeight: FontWeight.w500),
            ),
            const SizedBox(height: 32),
            
            // Info Cards
            _buildInfoCard(
              icon: LucideIcons.mail,
              label: 'Email',
              value: user.email ?? 'N/A',
            ),
            const SizedBox(height: 12),
            if (user.schoolId != null)
              _buildInfoCard(
                icon: LucideIcons.school,
                label: 'School ID',
                value: user.schoolId.toString(),
              ),
            const SizedBox(height: 32),
            
            // Actions
            const Divider(),
            const SizedBox(height: 24),
            _buildActionTile(
              icon: LucideIcons.shield_check,
              label: 'Security Settings',
              subtitle: 'Change your password',
              onTap: () => Navigator.push(
                context,
                MaterialPageRoute(builder: (context) => const ChangePasswordScreen()),
              ),
            ),
            const SizedBox(height: 12),
            _buildActionTile(
              icon: LucideIcons.log_out,
              label: 'Logout',
              subtitle: 'Sign out of your account',
              color: Colors.red,
              onTap: () {
                authProvider.logout();
                Navigator.of(context).popUntil((route) => route.isFirst);
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildInfoCard({required IconData icon, required String label, required String value}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Row(
        children: [
          Icon(icon, size: 20, color: Colors.grey[600]),
          const SizedBox(width: 16),
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(label, style: TextStyle(color: Colors.grey[500], fontSize: 12)),
              Text(value, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w600)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildActionTile({
    required IconData icon,
    required String label,
    required String subtitle,
    required VoidCallback onTap,
    Color? color,
  }) {
    final activeColor = color ?? const Color(0xFF6366F1);
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: activeColor.withAlpha(5),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: activeColor.withAlpha(20)),
        ),
        child: Row(
          children: [
            Icon(icon, size: 24, color: activeColor),
            const SizedBox(width: 16),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(label, style: TextStyle(fontSize: 16, fontWeight: FontWeight.bold, color: activeColor)),
                  Text(subtitle, style: TextStyle(color: Colors.grey[600], fontSize: 13)),
                ],
              ),
            ),
            Icon(LucideIcons.chevron_right, size: 20, color: activeColor.withAlpha(100)),
          ],
        ),
      ),
    );
  }
}
