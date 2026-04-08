class User {
  final int id;
  final String name;
  final String email;
  final String roleName;
  final int? schoolId;
  final List<int> classIds;
  final List<int> studentIds;
  final List<int> subjectIds;

  User({
    required this.id,
    required this.name,
    required this.email,
    required this.roleName,
    this.schoolId,
    this.classIds = const [],
    this.studentIds = const [],
    this.subjectIds = const [],
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'],
      name: json['name'],
      email: json['email'],
      roleName: json['role_name'],
      schoolId: json['school_id'],
      classIds: List<int>.from(json['class_ids'] ?? []),
      studentIds: List<int>.from(json['student_ids'] ?? []),
      subjectIds: List<int>.from(json['subject_ids'] ?? []),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'email': email,
      'role_name': roleName,
      'school_id': schoolId,
      'class_ids': classIds,
      'student_ids': studentIds,
      'subject_ids': subjectIds,
    };
  }
}
