class TeacherAssignment {
  final int id;
  final int teacherId;
  final int subjectId;
  final int classId;
  final String subjectName;
  final String className;

  TeacherAssignment({
    required this.id,
    required this.teacherId,
    required this.subjectId,
    required this.classId,
    required this.subjectName,
    required this.className,
  });

  factory TeacherAssignment.fromJson(Map<String, dynamic> json) {
    return TeacherAssignment(
      id: json['id'],
      teacherId: json['teacher_id'],
      subjectId: json['subject_id'],
      classId: json['class_id'],
      subjectName: json['subject_name'],
      className: json['class_name'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'teacher_id': teacherId,
      'subject_id': subjectId,
      'class_id': classId,
      'subject_name': subjectName,
      'class_name': className,
    };
  }
}
