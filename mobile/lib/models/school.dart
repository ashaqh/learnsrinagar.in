class School {
  final int id;
  final String name;
  final String? address;
  final int? usersId;
  final String? adminName;
  final String? adminEmail;
  final String? createdAt;

  School({
    required this.id,
    required this.name,
    this.address,
    this.usersId,
    this.adminName,
    this.adminEmail,
    this.createdAt,
  });

  factory School.fromJson(Map<String, dynamic> json) {
    return School(
      id: json['id'],
      name: json['name'],
      address: json['address'],
      usersId: json['users_id'],
      adminName: json['admin_name'],
      adminEmail: json['admin_email'],
      createdAt: json['created_at'],
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'name': name,
      'address': address,
      'users_id': usersId,
      'admin_name': adminName,
      'admin_email': adminEmail,
      'created_at': createdAt,
    };
  }
}
