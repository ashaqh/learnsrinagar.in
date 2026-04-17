class LiveClass {
  final int id;
  final String title;
  final String youtubeLiveLink;
  final String? zoomLink;
  final String sessionType;
  final String? topicName;
  final int? subjectId;
  final int classId;
  final int teacherId;
  final int? schoolId;
  final bool isAllSchools;
  final String startTime;
  final String? endTime;
  final String? subjectName;
  final String className;
  final String teacherName;
  final String? schoolName;

  LiveClass({
    required this.id,
    required this.title,
    required this.youtubeLiveLink,
    this.zoomLink,
    required this.sessionType,
    this.topicName,
    this.subjectId,
    required this.classId,
    required this.teacherId,
    this.schoolId,
    required this.isAllSchools,
    required this.startTime,
    this.endTime,
    this.subjectName,
    required this.className,
    required this.teacherName,
    this.schoolName,
  });

  factory LiveClass.fromJson(Map<String, dynamic> json) {
    return LiveClass(
      id: json['id'],
      title: json['title'],
      youtubeLiveLink: json['youtube_live_link'],
      zoomLink: json['zoom_link'],
      sessionType: json['session_type'],
      topicName: json['topic_name'],
      subjectId: json['subject_id'],
      classId: json['class_id'],
      teacherId: json['teacher_id'],
      schoolId: json['school_id'],
      isAllSchools: json['is_all_schools'] == 1 || json['is_all_schools'] == true,
      startTime: json['start_time'],
      endTime: json['end_time'],
      subjectName: json['subject_name'],
      className: json['class_name'],
      teacherName: json['teacher_name'],
      schoolName: json['school_name'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'title': title,
      'youtube_live_link': youtubeLiveLink,
      'zoom_link': zoomLink,
      'session_type': sessionType,
      'topic_name': topicName,
      'subject_id': subjectId,
      'class_id': classId,
      'teacher_id': teacherId,
      'school_id': schoolId,
      'is_all_schools': isAllSchools ? 1 : 0,
      'start_time': startTime,
      'end_time': endTime,
    };
  }
}
