import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import '../../providers/auth_provider.dart';
import '../../services/blogs_service.dart';
import '../manage_blog_form_screen.dart';

class BroadcastScreen extends StatefulWidget {
  const BroadcastScreen({super.key});

  @override
  State<BroadcastScreen> createState() => _BroadcastScreenState();
}

class _BroadcastScreenState extends State<BroadcastScreen> {
  final BlogsService _blogsService = BlogsService();
  bool _isLoading = true;
  List<dynamic> _broadcasts = [];
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchBroadcasts();
  }

  Future<void> _fetchBroadcasts() async {
    final token = Provider.of<AuthProvider>(context, listen: false).token;
    if (token == null) return;

    setState(() => _isLoading = true);
    
    // Fetch blogs and filter for 'Announcements' (Category ID 1)
    final result = await _blogsService.getAdminBlogs(token);

    if (mounted) {
      setState(() {
        if (result['success']) {
          // Filter for category_id 1 (Announcements)
          _broadcasts = (result['blogs'] as List)
              .where((blog) => blog['category_id'] == 1)
              .toList();
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
        title: const Text('Broadcasts', style: TextStyle(color: Colors.black87, fontWeight: FontWeight.bold)),
        backgroundColor: Colors.white,
        elevation: 0,
        iconTheme: const IconThemeData(color: Colors.black87),
        actions: [
          IconButton(
            icon: const Icon(LucideIcons.rotate_cw),
            onPressed: _fetchBroadcasts,
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!, style: const TextStyle(color: Colors.red)))
              : _broadcasts.isEmpty
                  ? _buildEmptyState()
                  : RefreshIndicator(
                      onRefresh: _fetchBroadcasts,
                      child: ListView.builder(
                        padding: const EdgeInsets.all(16),
                        itemCount: _broadcasts.length,
                        itemBuilder: (context, index) {
                          final broadcast = _broadcasts[index];
                          return _buildBroadcastCard(broadcast);
                        },
                      ),
                    ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () async {
          final result = await Navigator.push(
            context,
            MaterialPageRoute(
              builder: (_) => const ManageBlogFormScreen(initialCategoryId: 1),
            ),
          );
          if (result == true) _fetchBroadcasts();
        },
        backgroundColor: const Color(0xFF6366F1),
        icon: const Icon(LucideIcons.megaphone, color: Colors.white),
        label: const Text('Send Broadcast', style: TextStyle(color: Colors.white, fontWeight: FontWeight.bold)),
      ),
    );
  }

  Widget _buildEmptyState() {
    return Center(
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Icon(LucideIcons.megaphone, size: 64, color: Colors.grey[300]),
          const SizedBox(height: 16),
          Text(
            'No broadcasts sent yet',
            style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.grey[600]),
          ),
          const SizedBox(height: 8),
          Text(
            'Keep your school community informed with instant updates.',
            style: TextStyle(color: Colors.grey[500]),
          ),
        ],
      ),
    );
  }

  Widget _buildBroadcastCard(Map<String, dynamic> broadcast) {
    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(16),
        side: BorderSide(color: Colors.grey[200]!),
      ),
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: Colors.indigo[50],
                    borderRadius: BorderRadius.circular(20),
                  ),
                  child: Text(
                    'SCHOOL-WIDE',
                    style: TextStyle(color: Colors.indigo[700], fontSize: 10, fontWeight: FontWeight.bold),
                  ),
                ),
                const Spacer(),
                Text(
                  broadcast['publish_date']?.split('T')[0] ?? '',
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
              ],
            ),
            const SizedBox(height: 12),
            Text(
              broadcast['title'] ?? 'No Title',
              style: const TextStyle(fontSize: 17, fontWeight: FontWeight.bold, color: Colors.black87),
            ),
            const SizedBox(height: 8),
            Text(
              broadcast['short_desc'] ?? 'No description provided.',
              style: TextStyle(color: Colors.grey[600], fontSize: 14, height: 1.4),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                const Icon(LucideIcons.eye, size: 14, color: Colors.grey),
                const SizedBox(width: 4),
                Text(
                  '${broadcast['views_count'] ?? 0} views',
                  style: TextStyle(color: Colors.grey[500], fontSize: 12),
                ),
                const Spacer(),
                TextButton(
                  onPressed: () async {
                    final result = await Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => ManageBlogFormScreen(blog: broadcast),
                      ),
                    );
                    if (result == true) _fetchBroadcasts();
                  },
                  child: const Text('Edit'),
                ),
                TextButton(
                  onPressed: () => _confirmDelete(broadcast),
                  style: TextButton.styleFrom(foregroundColor: Colors.red),
                  child: const Text('Delete'),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _confirmDelete(Map<String, dynamic> broadcast) async {
    final confirmed = await showDialog<bool>(
      context: context,
      builder: (context) => AlertDialog(
        title: const Text('Delete Broadcast?'),
        content: const Text('This action cannot be undone. The announcement will be removed from all user feeds.'),
        actions: [
          TextButton(onPressed: () => Navigator.pop(context, false), child: const Text('Cancel')),
          TextButton(
            onPressed: () => Navigator.pop(context, true),
            style: TextButton.styleFrom(foregroundColor: Colors.red),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirmed == true) {
      final token = Provider.of<AuthProvider>(context, listen: false).token;
      final result = await _blogsService.deleteBlog(token!, broadcast['id']);
      if (mounted) {
        if (result['success']) {
          _fetchBroadcasts();
        } else {
          ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'])));
        }
      }
    }
  }
}
