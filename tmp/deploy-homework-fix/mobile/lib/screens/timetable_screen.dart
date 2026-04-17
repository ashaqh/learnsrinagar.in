import 'package:flutter/material.dart';
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import 'package:url_launcher/url_launcher.dart';
import '../providers/auth_provider.dart';
import '../services/timetable_service.dart';
import '../utils/live_class_datetime.dart';

class TimetableScreen extends StatefulWidget {
  final int? classId;
  const TimetableScreen({super.key, this.classId});

  @override
  State<TimetableScreen> createState() => _TimetableScreenState();
}

class _TimetableScreenState extends State<TimetableScreen> {
  final _timetableService = TimetableService();
  Map<String, List<dynamic>> _timetableByDate = {};
  List<String> _sortedDates = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchTimetable();
  }

  Future<void> _fetchTimetable() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    final result = await _timetableService.getTimetable(auth.token!, classId: widget.classId);

    if (mounted) {
      setState(() {
        if (result['success']) {
          final list = result['timetable'] as List;
          _timetableByDate = {};
          final dateSet = <String>{};
          for (var item in list) {
            String date;
            if (item['raw_start_time'] != null) {
              final dateTime = parseLiveClassDateTime(item['raw_start_time']);
              date = dateTime != null
                  ? DateFormat('yyyy-MM-dd').format(dateTime)
                  : item['class_date']?.toString().split('T')[0] ?? 'No Date';
            } else {
              date = item['class_date']?.toString().split('T')[0] ?? 'No Date';
            }
            
            _timetableByDate.putIfAbsent(date, () => []).add(item);
            dateSet.add(date);
          }
          _sortedDates = dateSet.toList()..sort();
        } else {
          _errorMessage = result['message'];
        }
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return DefaultTabController(
      length: _sortedDates.isEmpty ? 1 : _sortedDates.length,
      child: Scaffold(
        appBar: AppBar(
          title: const Text('Timetable'),
          bottom: _sortedDates.isEmpty
              ? null
              : TabBar(
                  isScrollable: true,
                  tabs: _sortedDates.map((date) {
                    try {
                      final dt = DateTime.parse(date);
                      return Tab(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            Text(DateFormat('MMM dd, yyyy').format(dt), style: const TextStyle(fontSize: 12)),
                            Text(DateFormat('EEE').format(dt), style: const TextStyle(fontSize: 10)),
                          ],
                        ),
                      );
                    } catch (e) {
                      return Tab(text: date);
                    }
                  }).toList(),
                ),
        ),
        body: _isLoading
            ? const Center(child: CircularProgressIndicator())
            : _errorMessage != null
                ? Center(child: Text(_errorMessage!))
                : _sortedDates.isEmpty
                    ? const Center(child: Text('No classes scheduled'))
                    : TabBarView(
                        children: _sortedDates.map((date) => _buildDayList(date)).toList(),
                      ),
      ),
    );
  }

  Widget _buildDayList(String dateKey) {
    final periods = _timetableByDate[dateKey] ?? [];
    if (periods.isEmpty) {
      return const Center(child: Text('No classes scheduled'));
    }

    return ListView.builder(
      padding: const EdgeInsets.all(16),
      itemCount: periods.length,
      itemBuilder: (context, index) {
        final item = periods[index];
        final String? zoomLink = item['zoom_link'];
        final String? youtubeLink = item['youtube_live_link'] ?? item['youtube_url'];

        return Card(
          margin: const EdgeInsets.only(bottom: 12),
          child: Padding(
            padding: const EdgeInsets.all(12.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Column(
                      children: [
                        Text(_formatLocalTime(item['raw_start_time']), 
                          style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12)),
                        Text(_formatLocalTime(item['raw_end_time']), 
                          style: const TextStyle(fontSize: 10, color: Colors.grey)),
                      ],
                    ),
                    const SizedBox(width: 16),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(item['subject_name']?.toString() ?? 'N/A', 
                            style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16)),
                          Text('Teacher: ${item['teacher_name'] ?? 'N/A'}', 
                            style: const TextStyle(fontSize: 14)),
                          if (item['class_name'] != null)
                            Text('Class: ${item['class_name']}', 
                              style: const TextStyle(fontSize: 12, color: Colors.blue)),
                        ],
                      ),
                    ),
                  ],
                ),
                if (zoomLink != null || youtubeLink != null) ...[
                  const Divider(height: 24),
                  Row(
                    children: [
                      if (zoomLink != null)
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () => _launchURL(zoomLink),
                            icon: const Icon(Icons.video_call, size: 18),
                            label: const Text('Zoom', style: TextStyle(fontSize: 12)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: Colors.indigo,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                      if (zoomLink != null && youtubeLink != null) const SizedBox(width: 8),
                      if (youtubeLink != null)
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () => _launchURL(youtubeLink),
                            icon: const Icon(Icons.play_circle_fill, size: 18),
                            label: const Text('YouTube', style: TextStyle(fontSize: 12)),
                            style: OutlinedButton.styleFrom(
                              foregroundColor: Colors.red,
                              side: const BorderSide(color: Colors.red),
                              padding: const EdgeInsets.symmetric(vertical: 8),
                            ),
                          ),
                        ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        );
      },
    );
  }

  Future<void> _launchURL(String urlString) async {
    final Uri url = Uri.parse(urlString);
    if (!await launchUrl(url, mode: LaunchMode.externalApplication)) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Could not launch $urlString')),
        );
      }
    }
  }
  String _formatLocalTime(dynamic rawTime) {
    return formatLiveClassDateTimeForText(
      rawTime,
      pattern: 'HH:mm',
      fallback: '--:--',
    );
  }
}
