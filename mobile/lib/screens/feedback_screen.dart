import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_lucide/flutter_lucide.dart';
import 'package:http/http.dart' as http;
import 'package:intl/intl.dart';
import 'package:provider/provider.dart';
import '../config/app_config.dart';
import '../providers/auth_provider.dart';
import '../services/feedback_service.dart';

// ─── Same statements as the web portal ──────────────────────────────────────
const Map<String, List<String>> _feedbackStatements = {
  'academic': [
    'My child has shown noticeable improvement in academic performance.',
    'The hybrid system has helped my child stay focused and organized.',
    'My child is completing assignments and homework more consistently.',
    'Teachers provide timely and effective academic support.',
    'The curriculum is well-balanced between in-person and online learning.',
  ],
  'behavioral': [
    'My child has become more self-disciplined and responsible.',
    "There has been a positive change in my child's attitude toward learning.",
    'My child actively participates in both online and in-person sessions.',
    "The hybrid model supports my child's emotional and social development.",
    'My child is balancing screen time and physical activity effectively.',
  ],
  'satisfaction': [
    'I am satisfied with the hybrid learning experience overall.',
    'Communication between the school and parents is clear and consistent.',
    'I would recommend this hybrid model to other parents.',
  ],
};

const Map<int, String> _ratingLabels = {
  1: 'Strongly Disagree',
  2: 'Disagree',
  3: 'Neutral',
  4: 'Agree',
  5: 'Strongly Agree',
};

// ─── Screen ──────────────────────────────────────────────────────────────────

class FeedbackScreen extends StatefulWidget {
  const FeedbackScreen({super.key});

  @override
  State<FeedbackScreen> createState() => _FeedbackScreenState();
}

class _FeedbackScreenState extends State<FeedbackScreen> {
  final _feedbackService = FeedbackService();
  List<dynamic> _feedbackList = [];
  bool _isLoading = true;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    _fetchFeedback();
  }

  Future<void> _fetchFeedback() async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });
    final result = await _feedbackService.getFeedback(auth.token!);
    if (mounted) {
      setState(() {
        if (result['success'] == true) {
          _feedbackList = result['feedback'] ?? [];
        } else {
          _errorMessage = result['message'] ?? 'Failed to load feedback';
        }
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    final user = Provider.of<AuthProvider>(context).user;
    final isParent = user?.roleName == 'parent';

    return Scaffold(
      appBar: AppBar(
        title: const Text('Parent Feedback'),
        backgroundColor: Colors.indigo,
        foregroundColor: Colors.white,
      ),
      floatingActionButton: isParent
          ? FloatingActionButton.extended(
              onPressed: _openSurveyDialog,
              icon: const Icon(LucideIcons.plus),
              label: const Text('Submit Feedback'),
              backgroundColor: Colors.indigo,
              foregroundColor: Colors.white,
            )
          : null,
      body: _buildBody(isParent),
    );
  }

  Widget _buildBody(bool isParent) {
    if (_isLoading) return const Center(child: CircularProgressIndicator());
    if (_errorMessage != null) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(LucideIcons.circle_alert, size: 48, color: Colors.red.shade300),
              const SizedBox(height: 16),
              Text(_errorMessage!, textAlign: TextAlign.center),
              const SizedBox(height: 16),
              ElevatedButton(onPressed: _fetchFeedback, child: const Text('Retry')),
            ],
          ),
        ),
      );
    }
    if (_feedbackList.isEmpty) {
      return Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(LucideIcons.message_square, size: 56, color: Colors.grey.shade300),
            const SizedBox(height: 16),
            Text(
              isParent ? 'No feedback submitted yet.' : 'No feedback found.',
              style: TextStyle(color: Colors.grey.shade600, fontSize: 16),
            ),
            if (isParent) ...[
              const SizedBox(height: 16),
              ElevatedButton.icon(
                onPressed: _openSurveyDialog,
                icon: const Icon(LucideIcons.plus),
                label: const Text('Submit Feedback'),
                style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo, foregroundColor: Colors.white),
              ),
            ],
          ],
        ),
      );
    }
    return RefreshIndicator(
      onRefresh: _fetchFeedback,
      child: ListView.builder(
        padding: const EdgeInsets.all(16),
        itemCount: _feedbackList.length,
        itemBuilder: (context, index) => _buildCard(_feedbackList[index]),
      ),
    );
  }

  Widget _buildCard(dynamic item) {
    return Card(
      margin: const EdgeInsets.only(bottom: 12),
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      elevation: 2,
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Expanded(
                  child: Text(
                    item['title']?.toString() ?? 'Feedback',
                    style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 16),
                  ),
                ),
                Row(children: [
                  IconButton(
                    icon: const Icon(LucideIcons.eye, size: 18, color: Colors.indigo),
                    tooltip: 'View Details',
                    padding: EdgeInsets.zero,
                    constraints: const BoxConstraints(),
                    onPressed: () => _showDetails(item['id']),
                  ),
                  const SizedBox(width: 8),
                  Text(
                    item['created_at']?.toString().split('T')[0] ?? '',
                    style: const TextStyle(color: Colors.grey, fontSize: 12),
                  ),
                ]),
              ],
            ),
            const SizedBox(height: 10),
            Row(children: [
              const Icon(LucideIcons.user, size: 14, color: Colors.blue),
              const SizedBox(width: 6),
              Text('Student: ${item['student_name'] ?? 'N/A'}',
                  style: const TextStyle(fontWeight: FontWeight.w500)),
            ]),
            const SizedBox(height: 4),
            Row(children: [
              const Icon(LucideIcons.users, size: 14, color: Colors.green),
              const SizedBox(width: 6),
              Text('Parent: ${item['parent_name'] ?? 'N/A'}',
                  style: TextStyle(color: Colors.grey.shade600)),
            ]),
          ],
        ),
      ),
    );
  }

  Future<void> _showDetails(dynamic feedbackId) async {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    if (auth.token == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => const Center(child: CircularProgressIndicator()),
    );

    final result = await _feedbackService.getFeedbackDetails(auth.token!, feedbackId as int);
    if (!mounted) return;
    Navigator.pop(context);

    if (result['success'] != true) {
      ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(result['message'] ?? 'Error')));
      return;
    }

    final feedback = result['feedback'];
    final List<dynamic> items = result['items'] ?? [];

    showDialog(
      context: context,
      builder: (_) => _DetailsDialog(feedback: feedback, items: items),
    );
  }

  void _openSurveyDialog() {
    final auth = Provider.of<AuthProvider>(context, listen: false);
    final user = auth.user;
    if (user == null || auth.token == null) return;

    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (_) => _SurveyDialog(
        token: auth.token!,
        linkedStudentIds: user.studentIds,
        feedbackService: _feedbackService,
        onSubmitted: _fetchFeedback,
      ),
    );
  }
}

// ─── Details Dialog ───────────────────────────────────────────────────────────

class _DetailsDialog extends StatelessWidget {
  final dynamic feedback;
  final List<dynamic> items;
  const _DetailsDialog({required this.feedback, required this.items});

  @override
  Widget build(BuildContext context) {
    final createdAt = feedback['created_at'] != null
        ? DateFormat('M/d/yyyy, h:mm:ss a')
            .format(DateTime.parse(feedback['created_at'].toString()))
        : 'N/A';

    return DefaultTabController(
      length: 3,
      child: AlertDialog(
        title: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            const Row(children: [
              Icon(LucideIcons.message_square, size: 20),
              SizedBox(width: 8),
              Text('Feedback Details', style: TextStyle(fontSize: 16)),
            ]),
            IconButton(
              icon: const Icon(Icons.close),
              onPressed: () => Navigator.pop(context),
              padding: EdgeInsets.zero,
              constraints: const BoxConstraints(),
            ),
          ],
        ),
        content: SizedBox(
          width: double.maxFinite,
          height: MediaQuery.of(context).size.height * 0.65,
          child: Column(children: [
            // Info grid
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: Colors.grey.shade50,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: Colors.grey.shade200),
              ),
              child: Column(children: [
                Row(children: [
                  Expanded(child: _infoField('Title', feedback['title'] ?? 'N/A')),
                  const SizedBox(width: 12),
                  Expanded(child: _infoField('Student', feedback['student_name'] ?? 'N/A')),
                ]),
                const SizedBox(height: 10),
                Row(children: [
                  Expanded(child: _infoField('Parent', feedback['parent_name'] ?? 'N/A')),
                  const SizedBox(width: 12),
                  Expanded(child: _infoField('Date', createdAt)),
                ]),
              ]),
            ),
            const SizedBox(height: 12),
            const TabBar(
              labelColor: Colors.indigo,
              unselectedLabelColor: Colors.grey,
              indicatorColor: Colors.indigo,
              tabs: [Tab(text: 'Academic'), Tab(text: 'Behavioral'), Tab(text: 'Overall')],
            ),
            const SizedBox(height: 8),
            Expanded(
              child: TabBarView(children: [
                _sectionList(items, 'academic'),
                _sectionList(items, 'behavioral'),
                _sectionList(items, 'satisfaction'),
              ]),
            ),
          ]),
        ),
      ),
    );
  }

  static Widget _infoField(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(fontSize: 11, fontWeight: FontWeight.bold)),
        const SizedBox(height: 4),
        Container(
          width: double.infinity,
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
          decoration: BoxDecoration(
            color: Colors.white,
            border: Border.all(color: Colors.grey.shade300),
            borderRadius: BorderRadius.circular(4),
          ),
          child: Text(value, style: const TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis),
        ),
      ],
    );
  }

  static Widget _sectionList(List<dynamic> allItems, String section) {
    final statements = _feedbackStatements[section] ?? [];
    final sectionItems = allItems.where((i) => i['section'] == section).toList();
    if (sectionItems.isEmpty) return const Center(child: Text('No entries for this section.'));
    return ListView.builder(
      itemCount: sectionItems.length,
      itemBuilder: (context, index) {
        final item = sectionItems[index];
        final stmtId = (item['statement_id'] as num).toInt();
        final rating = (item['rating'] as num).toInt();
        final statement = stmtId < statements.length ? statements[stmtId] : 'Unknown';
        return Container(
          margin: const EdgeInsets.only(bottom: 10),
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            border: Border.all(color: Colors.grey.shade200),
            borderRadius: BorderRadius.circular(8),
          ),
          child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
            Text(statement, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
            const SizedBox(height: 8),
            Row(children: [
              const Text('Rating: ', style: TextStyle(fontSize: 12)),
              Row(
                children: List.generate(5, (i) => Icon(
                  Icons.star,
                  size: 16,
                  color: i < rating ? Colors.amber : Colors.grey.shade300,
                )),
              ),
              const SizedBox(width: 6),
              Text('($rating – ${_ratingLabels[rating] ?? ''})',
                  style: TextStyle(fontSize: 11, color: Colors.grey.shade600)),
            ]),
            if (item['comment'] != null && item['comment'].toString().isNotEmpty) ...[
              const SizedBox(height: 6),
              Text('Comment: ${item['comment']}',
                  style: TextStyle(fontSize: 12, color: Colors.grey.shade700)),
            ],
          ]),
        );
      },
    );
  }
}

// ─── Full Survey Dialog ───────────────────────────────────────────────────────

class _SurveyDialog extends StatefulWidget {
  final String token;
  final List<int> linkedStudentIds;
  final FeedbackService feedbackService;
  final VoidCallback onSubmitted;

  const _SurveyDialog({
    required this.token,
    required this.linkedStudentIds,
    required this.feedbackService,
    required this.onSubmitted,
  });

  @override
  State<_SurveyDialog> createState() => _SurveyDialogState();
}

class _SurveyDialogState extends State<_SurveyDialog>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;
  final _titleController = TextEditingController();
  int? _selectedStudentId;
  bool _isSubmitting = false;
  String? _titleError;
  String? _studentError;

  // ratings[section][statementIndex] = 1..5
  final Map<String, Map<int, int>> _ratings = {
    'academic': {},
    'behavioral': {},
    'satisfaction': {},
  };
  // comments[section][statementIndex] = text
  final Map<String, Map<int, String>> _comments = {
    'academic': {},
    'behavioral': {},
    'satisfaction': {},
  };

  // Resolved student names
  Map<int, String> _studentNames = {};
  bool _loadingNames = true;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
    if (widget.linkedStudentIds.isNotEmpty) {
      _selectedStudentId = widget.linkedStudentIds.first;
    }
    _resolveStudentNames();
  }

  Future<void> _resolveStudentNames() async {
    final Map<int, String> names = {
      for (final id in widget.linkedStudentIds) id: 'Student #$id'
    };
    try {
      final resp = await http.get(
        Uri.parse('${AppConfig.apiBaseUrl}/admin/students'),
        headers: {'Authorization': 'Bearer ${widget.token}'},
      );
      if (resp.statusCode == 200) {
        final data = jsonDecode(resp.body);
        final students = (data['students'] as List?) ?? [];
        for (final s in students) {
          final id = s['id'] is int ? s['id'] as int : int.tryParse(s['id'].toString());
          if (id != null && widget.linkedStudentIds.contains(id)) {
            names[id] = s['name']?.toString() ?? 'Student #$id';
          }
        }
      }
    } catch (_) {}
    if (mounted) setState(() { _studentNames = names; _loadingNames = false; });
  }

  @override
  void dispose() {
    _tabController.dispose();
    _titleController.dispose();
    super.dispose();
  }

  bool _validate() {
    setState(() {
      _titleError = _titleController.text.trim().isEmpty ? 'Title is required' : null;
      _studentError = _selectedStudentId == null ? 'Please select a student' : null;
    });
    return _titleError == null && _studentError == null;
  }

  Future<void> _submit() async {
    if (!_validate()) return;

    final List<FeedbackItem> items = [];
    for (final section in ['academic', 'behavioral', 'satisfaction']) {
      final stmts = _feedbackStatements[section]!;
      for (int i = 0; i < stmts.length; i++) {
        final rating = _ratings[section]![i];
        if (rating != null) {
          items.add(FeedbackItem(
            section: section,
            statementId: i,
            rating: rating,
            comment: _comments[section]![i],
          ));
        }
      }
    }

    setState(() => _isSubmitting = true);
    final result = await widget.feedbackService.submitSurveyFeedback(
      token: widget.token,
      title: _titleController.text.trim(),
      studentId: _selectedStudentId!,
      items: items,
    );
    if (!mounted) return;
    setState(() => _isSubmitting = false);

    Navigator.pop(context);
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(result['message'] ?? (result['success'] == true ? 'Submitted!' : 'Failed')),
      backgroundColor: result['success'] == true ? Colors.green : Colors.red,
    ));
    if (result['success'] == true) widget.onSubmitted();
  }

  @override
  Widget build(BuildContext context) {
    return Dialog(
      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
      insetPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          // ── Header ──
          Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 12, 16),
            decoration: const BoxDecoration(
              color: Colors.indigo,
              borderRadius: BorderRadius.only(
                topLeft: Radius.circular(16),
                topRight: Radius.circular(16),
              ),
            ),
            child: Row(
              children: [
                const Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text('Submit New Feedback',
                          style: TextStyle(fontSize: 18, fontWeight: FontWeight.bold, color: Colors.white)),
                      SizedBox(height: 2),
                      Text('Fill out the form below to submit new feedback.',
                          style: TextStyle(fontSize: 12, color: Colors.white70)),
                    ],
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close, color: Colors.white),
                  onPressed: () => Navigator.pop(context),
                ),
              ],
            ),
          ),

          // ── Scrollable body ──
          Flexible(
            child: SingleChildScrollView(
              padding: const EdgeInsets.all(20),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Title
                  _label('Title'),
                  TextField(
                    controller: _titleController,
                    decoration: InputDecoration(
                      hintText: 'Enter feedback title',
                      errorText: _titleError,
                      border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                      contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Student
                  _label('Student'),
                  _loadingNames
                      ? const LinearProgressIndicator()
                      : widget.linkedStudentIds.isEmpty
                          ? Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: Colors.orange.shade50,
                                border: Border.all(color: Colors.orange.shade200),
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: const Text('No linked students found.'),
                            )
                          : DropdownButtonFormField<int>(
                              value: _selectedStudentId,
                              isExpanded: true,
                              hint: const Text('Select a student'),
                              decoration: InputDecoration(
                                border: OutlineInputBorder(borderRadius: BorderRadius.circular(8)),
                                contentPadding:
                                    const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                errorText: _studentError,
                              ),
                              items: widget.linkedStudentIds
                                  .map((id) => DropdownMenuItem(
                                        value: id,
                                        child: Text(_studentNames[id] ?? 'Student #$id'),
                                      ))
                                  .toList(),
                              onChanged: (v) => setState(() => _selectedStudentId = v),
                            ),
                  const SizedBox(height: 20),

                  // Survey tabs
                  Container(
                    decoration: BoxDecoration(
                      border: Border.all(color: Colors.grey.shade200),
                      borderRadius: BorderRadius.circular(8),
                    ),
                    child: Column(children: [
                      TabBar(
                        controller: _tabController,
                        labelColor: Colors.indigo,
                        unselectedLabelColor: Colors.grey,
                        indicatorColor: Colors.indigo,
                        tabs: const [
                          Tab(text: 'Academic'),
                          Tab(text: 'Behavioral'),
                          Tab(text: 'Overall'),
                        ],
                      ),
                      SizedBox(
                        height: 420,
                        child: TabBarView(
                          controller: _tabController,
                          children: [
                            _buildSection('academic'),
                            _buildSection('behavioral'),
                            _buildSection('satisfaction'),
                          ],
                        ),
                      ),
                    ]),
                  ),
                ],
              ),
            ),
          ),

          // ── Footer ──
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 12),
            decoration: BoxDecoration(
              color: Colors.grey.shade50,
              border: Border(top: BorderSide(color: Colors.grey.shade200)),
              borderRadius: const BorderRadius.only(
                bottomLeft: Radius.circular(16),
                bottomRight: Radius.circular(16),
              ),
            ),
            child: Row(
              mainAxisAlignment: MainAxisAlignment.end,
              children: [
                TextButton(
                  onPressed: _isSubmitting ? null : () => Navigator.pop(context),
                  child: const Text('Cancel'),
                ),
                const SizedBox(width: 12),
                ElevatedButton(
                  onPressed: _isSubmitting ? null : _submit,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: Colors.indigo,
                    foregroundColor: Colors.white,
                    padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                  ),
                  child: _isSubmitting
                      ? const SizedBox(
                          width: 18,
                          height: 18,
                          child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                        )
                      : const Text('Submit Feedback'),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _label(String text) => Padding(
        padding: const EdgeInsets.only(bottom: 6),
        child: Text(text, style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 14)),
      );

  Widget _buildSection(String section) {
    final statements = _feedbackStatements[section]!;
    final title = section == 'satisfaction'
        ? 'Overall'
        : '${section[0].toUpperCase()}${section.substring(1)}';

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold)),
          const SizedBox(height: 4),
          Text(
            'Please rate each statement from 1-5 (1: Strongly Disagree to 5: Strongly Agree)',
            style: TextStyle(fontSize: 12, color: Colors.grey.shade600),
          ),
          const SizedBox(height: 14),
          ...List.generate(statements.length,
              (i) => _statementRow(section, i, statements[i])),
        ],
      ),
    );
  }

  Widget _statementRow(String section, int index, String statement) {
    final rating = _ratings[section]![index];

    return Container(
      margin: const EdgeInsets.only(bottom: 14),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        border: Border.all(color: Colors.grey.shade200),
        borderRadius: BorderRadius.circular(8),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(statement, style: const TextStyle(fontWeight: FontWeight.w500, fontSize: 13)),
          const SizedBox(height: 10),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Rating
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Rating (1-5)',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    DropdownButtonFormField<int>(
                      value: rating,
                      isExpanded: true,
                      hint: const Text('Select a rating', style: TextStyle(fontSize: 12)),
                      decoration: InputDecoration(
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        isDense: true,
                      ),
                      items: [1, 2, 3, 4, 5]
                          .map((v) => DropdownMenuItem(
                                value: v,
                                child: Text('$v – ${_ratingLabels[v]}',
                                    style: const TextStyle(fontSize: 12)),
                              ))
                          .toList(),
                      onChanged: (v) => setState(() => _ratings[section]![index] = v!),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              // Comment
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Comments (optional)',
                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w500)),
                    const SizedBox(height: 6),
                    TextFormField(
                      maxLines: 3,
                      style: const TextStyle(fontSize: 12),
                      decoration: InputDecoration(
                        hintText: 'Add any additional comments here',
                        hintStyle: const TextStyle(fontSize: 12),
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(6)),
                        contentPadding:
                            const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                        isDense: true,
                      ),
                      onChanged: (v) => _comments[section]![index] = v,
                    ),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
