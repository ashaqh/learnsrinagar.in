import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import '../services/live_class_service.dart';
import '../utils/live_class_datetime.dart';

class LiveClassScreen extends StatefulWidget {
  final int? classId;
  const LiveClassScreen({super.key, this.classId});

  @override
  State<LiveClassScreen> createState() => _LiveClassScreenState();
}

class _LiveClassScreenState extends State<LiveClassScreen> {
  final _liveClassService = LiveClassService();
  List<dynamic> _liveClasses = [];
  List<dynamic> _subjects = [];
  String? _schoolName;
  bool _isLoading = true;
  String? _errorMessage;

  // Filters
  String _searchQuery = '';
  String _selectedSubject = 'all';
  String _selectedStatus = 'all';

  @override
  void initState() {
    super.initState();
    _fetchClasses();
  }

  Future<void> _fetchClasses() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    final result = await _liveClassService.getLiveClasses(auth.token!, classId: widget.classId);

    if (mounted) {
      setState(() {
        if (result['success']) {
          _liveClasses = result['data']['liveClasses'] ?? [];
          _subjects = result['data']['subjects'] ?? [];
          _schoolName = result['data']['schoolName'] ?? 'LearnSrinagar';
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  Future<void> _launchUrl(String url) async {
    if (!await launchUrl(Uri.parse(url))) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Could not launch link')),
        );
      }
    }
  }

  String? _extractYouTubeVideoId(String url) {
    RegExp regExp = RegExp(
      r'(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?|live)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})',
      caseSensitive: false,
      multiLine: false,
    );
    final match = regExp.firstMatch(url);
    if (match != null && match.groupCount >= 1) {
      return match.group(1);
    }
    return null;
  }

  String _getYouTubeThumbnail(String url) {
    final videoId = _extractYouTubeVideoId(url);
    if (videoId != null) {
      return 'https://img.youtube.com/vi/$videoId/hqdefault.jpg';
    }
    return ''; // Return empty to use placeholder
  }

  // Generate updated live classes dynamically based on current time
  List<dynamic> get _updatedLiveClasses {
    return _liveClasses.map((lc) {
      if (lc['start_time'] == null) return lc;

      return {
        ...lc,
        'computed_status': calculateLiveClassStatus(
          lc['start_time'],
          lc['end_time'],
        ),
      };
    }).toList();
  }

  List<dynamic> get _filteredLiveClasses {
    return _updatedLiveClasses.where((lc) {
      final matchesSearch = _searchQuery.isEmpty ||
          (lc['title']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false) ||
          (lc['topic_name']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false) ||
          (lc['teacher_name']?.toString().toLowerCase().contains(_searchQuery.toLowerCase()) ?? false);
          
      final matchesSubject = _selectedSubject == 'all' || 
          lc['subject_id']?.toString() == _selectedSubject;
          
      final matchesStatus = _selectedStatus == 'all' || 
          lc['computed_status'] == _selectedStatus ||
          (_selectedStatus == 'upcoming' && lc['computed_status'] == 'scheduled');

      return matchesSearch && matchesSubject && matchesStatus;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;
    final canSchedule =
        user?.roleName == 'school_admin' || user?.roleName == 'class_admin';

    final filtered = _filteredLiveClasses;
    final liveSessions = filtered.where((lc) => lc['computed_status'] == 'live').toList();
    final upcomingSessions = filtered.where((lc) => lc['computed_status'] == 'upcoming' || lc['computed_status'] == 'scheduled').toList();
    final completedSessions = filtered.where((lc) => lc['computed_status'] == 'completed').toList();

    return Scaffold(
      backgroundColor: Colors.grey[100],
      appBar: AppBar(
        title: const Text('Live Classes'),
        backgroundColor: Colors.white,
        foregroundColor: Colors.black,
        elevation: 0,
        actions: [
          if (canSchedule)
            IconButton(
              icon: const Icon(LucideIcons.plus),
              onPressed: () => _showScheduleDialog(),
            ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator())
          : _errorMessage != null
              ? Center(child: Text(_errorMessage!))
              : RefreshIndicator(
                  onRefresh: _fetchClasses,
                  child: CustomScrollView(
                    slivers: [
                      SliverToBoxAdapter(
                        child: _buildHeader(),
                      ),
                      SliverToBoxAdapter(
                        child: _buildFilters(),
                      ),
                      if (liveSessions.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _buildSection(
                            title: 'Live Now',
                            icon: LucideIcons.play,
                            color: Colors.red,
                            items: liveSessions,
                          ),
                        ),
                      if (upcomingSessions.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _buildSection(
                            title: 'Upcoming Sessions',
                            icon: LucideIcons.clock,
                            color: Colors.blue,
                            items: upcomingSessions,
                          ),
                        ),
                      if (completedSessions.isNotEmpty)
                        SliverToBoxAdapter(
                          child: _buildSection(
                            title: 'Completed Sessions',
                            icon: Icons.check_circle,
                            color: Colors.green,
                            items: completedSessions,
                          ),
                        ),
                      if (filtered.isEmpty && _liveClasses.isNotEmpty)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Padding(
                              padding: EdgeInsets.all(24.0),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(Icons.filter_list, size: 48, color: Colors.grey),
                                  SizedBox(height: 16),
                                  Text(
                                    'No Classes Match Filters',
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                      if (_liveClasses.isEmpty)
                        const SliverFillRemaining(
                          hasScrollBody: false,
                          child: Center(
                            child: Padding(
                              padding: EdgeInsets.all(24.0),
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  Icon(LucideIcons.calendar, size: 48, color: Colors.grey),
                                  SizedBox(height: 16),
                                  Text(
                                    'No Live Classes Available',
                                    style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
    );
  }

  Widget _buildHeader() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 16.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            _schoolName ?? 'LearnSrinagar',
            style: TextStyle(fontSize: 14, color: Colors.grey[700]),
          ),
          const SizedBox(height: 4),
          const Text(
            'Watch live lectures and access recorded sessions',
            style: TextStyle(fontSize: 13, color: Colors.grey),
          ),
        ],
      ),
    );
  }

  Widget _buildFilters() {
    return Card(
      margin: const EdgeInsets.all(16),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 0,
      color: Colors.white,
      child: Padding(
        padding: const EdgeInsets.all(16.0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Row(
              children: [
                Icon(Icons.filter_list, size: 18),
                SizedBox(width: 8),
                Text('Filter Classes', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
              ],
            ),
            const SizedBox(height: 16),
            TextField(
              decoration: InputDecoration(
                hintText: 'Search lectures...',
                prefixIcon: const Icon(LucideIcons.search, size: 18),
                contentPadding: const EdgeInsets.symmetric(horizontal: 16),
                border: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
                enabledBorder: OutlineInputBorder(
                  borderRadius: BorderRadius.circular(8),
                  borderSide: BorderSide(color: Colors.grey[300]!),
                ),
                filled: true,
                fillColor: Colors.grey[50],
              ),
              onChanged: (val) {
                setState(() {
                  _searchQuery = val;
                });
              },
            ),
            const SizedBox(height: 12),
            Row(
              children: [
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      filled: true,
                      fillColor: Colors.grey[50],
                    ),
                    initialValue: _selectedSubject,
                    isExpanded: true,
                    items: [
                      const DropdownMenuItem(value: 'all', child: Text('All Subjects', style: TextStyle(fontSize: 14))),
                      ..._subjects.map((sub) => DropdownMenuItem(
                            value: sub['id'].toString(),
                            child: Text(sub['name'], style: const TextStyle(fontSize: 14)),
                          )),
                    ],
                    onChanged: (val) {
                      setState(() {
                        _selectedSubject = val ?? 'all';
                      });
                    },
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: DropdownButtonFormField<String>(
                    decoration: InputDecoration(
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                      border: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      enabledBorder: OutlineInputBorder(
                        borderRadius: BorderRadius.circular(8),
                        borderSide: BorderSide(color: Colors.grey[300]!),
                      ),
                      filled: true,
                      fillColor: Colors.grey[50],
                    ),
                    initialValue: _selectedStatus,
                    items: const [
                      DropdownMenuItem(value: 'all', child: Text('All Status', style: TextStyle(fontSize: 14))),
                      DropdownMenuItem(value: 'live', child: Text('Live Now', style: TextStyle(fontSize: 14))),
                      DropdownMenuItem(value: 'upcoming', child: Text('Upcoming', style: TextStyle(fontSize: 14))),
                      DropdownMenuItem(value: 'completed', child: Text('Completed', style: TextStyle(fontSize: 14))),
                    ],
                    onChanged: (val) {
                      setState(() {
                        _selectedStatus = val ?? 'all';
                      });
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

  Widget _buildSection({required String title, required IconData icon, required Color color, required List<dynamic> items}) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 16.0, vertical: 8.0),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Icon(icon, color: color, size: 24),
              const SizedBox(width: 8),
              Text(
                title,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: color == Colors.red ? color : Colors.black87,
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          ListView.builder(
            shrinkWrap: true,
            physics: const NeverScrollableScrollPhysics(),
            itemCount: items.length,
            itemBuilder: (context, index) {
              return _buildCard(items[index]);
            },
          ),
        ],
      ),
    );
  }

  Widget _buildCard(dynamic item) {
    final String status = item['computed_status'];
    final String? zoomLink = item['zoom_link'];
    final String? youtubeLink = item['youtube_live_link'];
    final String thumbUrl = youtubeLink != null ? _getYouTubeThumbnail(youtubeLink) : '';

    Color badgeBgColor;
    Color badgeTextColor;
    IconData badgeIcon;
    String badgeText;

    if (status == 'live') {
      badgeBgColor = Colors.red[100]!;
      badgeTextColor = Colors.red[800]!;
      badgeIcon = LucideIcons.play;
      badgeText = 'Live Now';
    } else if (status == 'completed') {
      badgeBgColor = Colors.green[100]!;
      badgeTextColor = Colors.green[800]!;
      badgeIcon = Icons.check_circle;
      badgeText = 'Completed';
    } else {
      badgeBgColor = Colors.blue[100]!;
      badgeTextColor = Colors.blue[800]!;
      badgeIcon = LucideIcons.clock;
      badgeText = 'Upcoming';
    }

    return Card(
      margin: const EdgeInsets.only(bottom: 16),
      elevation: 3,
      shadowColor: Colors.black12,
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      clipBehavior: Clip.antiAlias,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Image / Thumbnail Header
          AspectRatio(
            aspectRatio: 16 / 9,
            child: Stack(
              fit: StackFit.expand,
              children: [
                if (thumbUrl.isNotEmpty)
                  Image.network(
                    thumbUrl,
                    fit: BoxFit.cover,
                    errorBuilder: (context, error, stackTrace) => Container(
                      color: Colors.grey[200],
                      child: const Center(child: Icon(LucideIcons.video, size: 48, color: Colors.grey)),
                    ),
                  )
                else
                  Container(
                    color: Colors.grey[200],
                    child: const Center(child: Icon(LucideIcons.video, size: 48, color: Colors.grey)),
                  ),
                // Gradient overlay
                Container(
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Colors.black54, Colors.transparent],
                      begin: Alignment.bottomCenter,
                      end: Alignment.topCenter,
                    ),
                  ),
                ),
                // Badge
                Positioned(
                  top: 12,
                  right: 12,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                    decoration: BoxDecoration(
                      color: badgeBgColor,
                      borderRadius: BorderRadius.circular(16),
                    ),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(badgeIcon, size: 12, color: badgeTextColor),
                        const SizedBox(width: 4),
                        Text(
                          badgeText,
                          style: TextStyle(
                            color: badgeTextColor,
                            fontSize: 12,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),
          // Content 
          Padding(
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item['title'] ?? 'Live Class',
                  style: const TextStyle(fontSize: 18, fontWeight: FontWeight.bold),
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                ),
                if (item['topic_name'] != null) ...[
                  const SizedBox(height: 4),
                  Text(
                    item['topic_name'],
                    style: TextStyle(fontSize: 14, color: Colors.grey[600]),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
                const SizedBox(height: 12),
                Row(
                  children: [
                    Text('Teacher: ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.grey[800])),
                    Expanded(
                      child: Text(item['teacher_name'] ?? 'Unknown', style: TextStyle(fontSize: 14, color: Colors.grey[700]), overflow: TextOverflow.ellipsis),
                    ),
                  ],
                ),
                const SizedBox(height: 4),
                if (item['subject_name'] != null)
                  Row(
                    children: [
                      Text('Subject: ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.grey[800])),
                      Expanded(
                        child: Text(item['subject_name'], style: TextStyle(fontSize: 14, color: Colors.grey[700]), overflow: TextOverflow.ellipsis),
                      ),
                    ],
                  ),
                if (item['start_time'] != null) ...[
                  const SizedBox(height: 4),
                  Row(
                    children: [
                      Text('Starts: ', style: TextStyle(fontSize: 14, fontWeight: FontWeight.w500, color: Colors.grey[800])),
                      Expanded(
                        child: Text(
                          formatLiveClassDateTimeForText(
                            item['start_time'],
                            pattern: 'MMM dd, yyyy - hh:mm a',
                          ),
                          style: TextStyle(fontSize: 14, color: Colors.blue[700], fontWeight: FontWeight.w500), 
                          overflow: TextOverflow.ellipsis
                        ),
                      ),
                    ],
                  ),
                ],
                const SizedBox(height: 16),
                // Action Buttons
                _buildActionButtons(status, zoomLink, youtubeLink),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildActionButtons(String status, String? zoomLink, String? youtubeLink) {
    if (status == 'completed') {
      return SizedBox(
        width: double.infinity,
        child: OutlinedButton.icon(
          onPressed: () {
            if (youtubeLink != null && youtubeLink.isNotEmpty) {
              _launchUrl(youtubeLink);
            }
          },
          icon: const Icon(LucideIcons.play, size: 18),
          label: const Text('Watch on YouTube'),
          style: OutlinedButton.styleFrom(
            foregroundColor: Colors.green[700],
            side: BorderSide(color: Colors.green[200]!),
            padding: const EdgeInsets.symmetric(vertical: 12),
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
          ),
        ),
      );
    } 

    if (zoomLink != null && zoomLink.isNotEmpty) {
      return Column(
        children: [
          SizedBox(
            width: double.infinity,
            child: ElevatedButton.icon(
              onPressed: () => _launchUrl(zoomLink),
              icon: const Icon(LucideIcons.external_link, size: 18),
              label: Text(status == 'live' ? 'Join Zoom Class' : 'Join Zoom (Starts Soon)'),
              style: ElevatedButton.styleFrom(
                backgroundColor: Colors.blue[600],
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
              ),
            ),
          ),
          if (youtubeLink != null && youtubeLink.isNotEmpty) ...[
            const SizedBox(height: 8),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: () => _launchUrl(youtubeLink),
                icon: const Icon(LucideIcons.play, size: 18),
                label: const Text('Watch on YouTube'),
                style: TextButton.styleFrom(
                  foregroundColor: Colors.red[600],
                  padding: const EdgeInsets.symmetric(vertical: 12),
                ),
              ),
            ),
          ]
        ],
      );
    }

    if (youtubeLink != null && youtubeLink.isNotEmpty) {
      if (status == 'live') {
        return SizedBox(
          width: double.infinity,
          child: ElevatedButton.icon(
            onPressed: () => _launchUrl(youtubeLink),
            icon: const Icon(LucideIcons.play, size: 18),
            label: const Text('Join Live Session'),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red[600],
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        );
      } else {
        return SizedBox(
          width: double.infinity,
          child: OutlinedButton.icon(
            onPressed: () => _launchUrl(youtubeLink),
            icon: const Icon(LucideIcons.clock, size: 18),
            label: const Text('Preview Session'),
            style: OutlinedButton.styleFrom(
              foregroundColor: Colors.blue[700],
              side: BorderSide(color: Colors.blue[200]!),
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
          ),
        );
      }
    }

    return const SizedBox.shrink();
  }

  void _showScheduleDialog() {
    ScaffoldMessenger.of(context).showSnackBar(
      const SnackBar(content: Text('Scheduling coming soon')),
    );
  }
}
