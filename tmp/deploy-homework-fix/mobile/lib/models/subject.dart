import 'class_model.dart';

class Subject {
  final int id;
  final String name;
  final int? classId;
  final String? className;
  final List<ClassModel> classes;
  final String? classNames;
  final DateTime? createdAt;

  Subject({
    required this.id,
    required this.name,
    this.classes = const [],
    this.classNames,
    this.classId,
    this.className,
    this.createdAt,
  });

  factory Subject.fromJson(Map<String, dynamic> json) {
    return Subject(
      id: json['id'],
      name: json['name'],
      classes: (json['classes'] as List?)
              ?.map((c) => ClassModel.fromJson(c))
              .toList() ??
          [],
      classNames: json['class_names'],
      classId: json['class_id'],
      className: json['class_name'],
      createdAt: json['created_at'] != null
          ? DateTime.parse(json['created_at'])
          : null,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'classes': classes.map((c) => c.toJson()).toList(),
      'class_names': classNames,
      'class_id': classId,
      'class_name': className,
      'created_at': createdAt?.toIso8601String(),
    };
  }
}
