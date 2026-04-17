import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/dashboard_service.dart';

class FeedbackAdminScreen extends StatefulWidget {
  const FeedbackAdminScreen({super.key});

  @override
  State<FeedbackAdminScreen> createState() => _FeedbackAdminScreenState();
}

class _FeedbackAdminScreenState extends State<FeedbackAdminScreen> {
  final DashboardService _dashboardService = DashboardService();
  bool _isLoading = true;
  String? _errorMessage;
  
  Map<String, dynamic> _stats = {};
  List<dynamic> _recentFeedback = [];
  List<dynamic> _schools = [];
  List<dynamic> _classes = [];
  
  int? _selectedSchoolId;
  int? _selectedClassId;

  @override
  void initState() {
    super.initState();
    _fetchFeedbackData();
  }

  Future<void> _fetchFeedbackData() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    setState(() => _isLoading = true);
    
    final result = await _dashboardService.getDashboardData(
      token,
      schoolId: _selectedSchoolId,
      classId: _selectedClassId,
    );

    if (mounted) {
      setState(() {
        if (result['success']) {
          final data = result['data'];
          _stats = data['feedback'] ?? {};
          _recentFeedback = data['recentFeedback'] ?? [];
          _schools = data['schoolsList'] ?? [];
          _classes = data['classesList'] ?? [];
          _errorMessage = null;
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.grey[50],
      appBar: AppBar(
        title: const Text('Feedback Analysis', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.rotate_cw),
            onPressed: _fetchFeedbackData,
            tooltip: 'Refresh',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))
              : SingleChildScrollView(
                  padding: const EdgeInsets.all(16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _buildFilters(),
                      const SizedBox(height: 24),
                      _buildSummaryCards(),
                      const SizedBox(height: 32),
                      const Text(
                        'Recent Submissions',
                        style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.black87),
                      ),
                      const SizedBox(height: 16),
                      _buildRecentFeedbackList(),
                    ],
                  ),
                ),
    );
  }

  Widget _buildFilters() {
    return Card(
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(12),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(12),
        child: Column(
          children: [
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _selectedSchoolId,
                    decoration: const InputDecoration(
                      labelText: 'School',
                      prefixIcon: Icon(LucideIcons.school, size: 18),
                      border: InputBorder.none,
                    ),
                    items: [
                      const DropdownMenuItem<int>(value: null, child: Text('All Schools')),
                      ..._schools.map((s) => DropdownMenuItem<int>(value: s['id'], child: Text(s['name']))),
                    ],
                    onChanged: (val) {
                      setState(() {
                        _selectedSchoolId = val;
                        _selectedClassId = null; // Reset class filter
                      });
                      _fetchFeedbackData();
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<int>(
                    initialValue: _selectedClassId,
                    decoration: const InputDecoration(
                      labelText: 'Class',
                      prefixIcon: Icon(LucideIcons.book_open, size: 18),
                      border: InputBorder.none,
                    ),
                    items: [
                      const DropdownMenuItem<int>(value: null, child: Text('All Classes')),
                      ..._classes.map((c) => DropdownMenuItem<int>(value: c['id'], child: Text('Class ${c['name']}'))),
                    ],
                    onChanged: (val) {
                      setState(() => _selectedClassId = val);
                      _fetchFeedbackData();
                    },
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildSummaryCards() {
    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _buildStatCard(
                'Academic',
                _stats['academic']?.toString() ?? '0.0',
                LucideIcons.graduation_cap,
                Colors.blue,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildStatCard(
                'Behavioral',
                _stats['behavioral']?.toString() ?? '0.0',
                LucideIcons.smile,
                Colors.green,
              ),
            ),
          ],
        ),
        const SizedBox(height: 12),
        _buildStatCard(
          'Overall Satisfaction',
          '${_stats['satisfaction']?.toString() ?? '0'}%',
          LucideIcons.heart,
          Colors.purple,
          fullWidth: true,
        ),
      ],
    );
  }

  Widget _buildStatCard(String label, String value, IconData icon, Color color, {bool fullWidth = false}) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.grey[200]!),
      ),
      child: Column(
        crossAxisAlignment: fullWidth ? CrossAxisAlignment.center : CrossAxisAlignment.start,
        children: [
          Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: color.withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icon, size: 20, color: color),
              ),
              if (fullWidth) const SizedBox(width: 12),
              if (!fullWidth) const Spacer(),
              if (!fullWidth) const SizedBox(height: 4),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            value,
            style: const TextStyle(fontSize: 24, fontWeight: FontWeight.bold, color: Colors.black87),
          ),
          Text(
            label,
            style: TextStyle(fontSize: 13, color: Colors.grey[600], fontWeight: FontWeight.w500),
          ),
        ],
      ),
    );
  }

  Widget _buildRecentFeedbackList() {
    if (_recentFeedback.isEmpty) {
      return Container(
        padding: const EdgeInsets.all(32),
        width: double.infinity,
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey[200]!),
        ),
        child: const Column(
          children: [
            Icon(LucideIcons.message_square, size: 48, color: Colors.grey),
            SizedBox(height: 16),
            Text('No recent feedback submissions found.', style: TextStyle(color: Colors.grey)),
          ],
        ),
      );
    }

    return ListView.builder(
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      itemCount: _recentFeedback.length,
      itemBuilder: (context, index) {
        final submission = _recentFeedback[index];
        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          elevation: 0,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(12),
            side: BorderSide(color: Colors.grey[200]!),
          ),
          child: ExpansionTile(
            leading: CircleAvatar(
              backgroundColor: Colors.indigo[50],
              child: Text(
                submission['parent_name']?.substring(0, 1).toUpperCase() ?? 'P',
                style: TextStyle(color: Colors.indigo[600], fontWeight: FontWeight.bold),
              ),
            ),
            title: Text(
              submission['parent_name'] ?? 'Unknown Parent',
              style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 15),
            ),
            subtitle: Text(
              'For student: ${submission['student_name']} • ${submission['created_at']?.split('T')[0]}',
              style: TextStyle(color: Colors.grey[500], fontSize: 12),
            ),
            childrenPadding: const EdgeInsets.all(16),
            expandedCrossAxisAlignment: CrossAxisAlignment.start,
            children: [
              const Divider(),
              ...((submission['items'] as List?)?.map((item) => Padding(
                padding: const EdgeInsets.only(bottom: 16.0),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: _getSectionColor(item['section']).withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item['section']?.toUpperCase() ?? '',
                            style: TextStyle(
                              color: _getSectionColor(item['section']),
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                            ),
                          ),
                        ),
                        const Spacer(),
                        Row(
                          children: List.generate(5, (i) => Icon(
                            LucideIcons.star,
                            size: 14,
                            color: i < (item['rating'] ?? 0) ? Colors.orange : Colors.grey[300],
                          )),
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      item['question'] ?? '',
                      style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13),
                    ),
                    if (item['comment'] != null && item['comment'].toString().isNotEmpty)
                      Padding(
                        padding: const EdgeInsets.only(top: 8.0),
                        child: Text(
                          '"${item['comment']}"',
                          style: TextStyle(color: Colors.grey[600], fontStyle: FontStyle.italic, fontSize: 13),
                        ),
                      ),
                  ],
                ),
              )).toList() ?? []),
            ],
          ),
        );
      },
    );
  }

  Color _getSectionColor(String? section) {
    switch (section) {
      case 'academic': return Colors.blue;
      case 'behavioral': return Colors.green;
      case 'satisfaction': return Colors.purple;
      default: return Colors.grey;
    }
  }
}
