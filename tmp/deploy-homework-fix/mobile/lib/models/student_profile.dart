class StudentProfile {
  final int id; // user id
  final int? profileId;
  final String name;
  final String email;
  final String? enrollmentNo;
  final String? dateOfBirth;
  final int? classId;
  final int? schoolId;
  final String? className;
  final String? schoolName;

  StudentProfile({
    required this.id,
    this.profileId,
    required this.name,
    required this.email,
    this.enrollmentNo,
    this.dateOfBirth,
    this.classId,
    this.schoolId,
    this.className,
    this.schoolName,
  });

  factory StudentProfile.fromJson(Map<String, dynamic> json) {
    return StudentProfile(
      id: json['id'] is int ? json['id'] : int.parse(json['id'].toString()),
      profileId: json['profile_id'] is int ? json['profile_id'] : (json['profile_id'] != null ? int.tryParse(json['profile_id'].toString()) : null),
      name: json['name']?.toString() ?? '',
      email: json['email']?.toString() ?? '',
      enrollmentNo: json['enrollment_no']?.toString(),
      dateOfBirth: json['date_of_birth']?.toString(),
      classId: json['class_id'] is int ? json['class_id'] : (json['class_id'] != null ? int.tryParse(json['class_id'].toString()) : null),
      schoolId: json['schools_id'] is int ? json['schools_id'] : (json['schools_id'] != null ? int.tryParse(json['schools_id'].toString()) : null),
      className: json['class_name']?.toString(),
      schoolName: json['school_name']?.toString(),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'profile_id': profileId,
      'name': name,
      'email': email,
      'enrollment_no': enrollmentNo,
      'date_of_birth': dateOfBirth,
      'class_id': classId,
      'schools_id': schoolId,
    };
  }
}
