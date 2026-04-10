import 'package:intl/intl.dart';

const _liveClassTimezoneOffset = Duration(hours: 5, minutes: 30);
final _liveClassDateTimePattern = RegExp(
  r'^(\d{4})-(\d{2})-(\d{2})(?:[T\s](\d{2})(?::(\d{2})(?::(\d{2}))?)?)?',
);

DateTime? parseLiveClassDateTime(dynamic value) {
  if (value == null) return null;

  if (value is DateTime) {
    return DateTime(
      value.year,
      value.month,
      value.day,
      value.hour,
      value.minute,
      value.second,
      value.millisecond,
      value.microsecond,
    );
  }

  final rawValue = value.toString().trim();
  if (rawValue.isEmpty) return null;

  final match = _liveClassDateTimePattern.firstMatch(rawValue);
  if (match != null) {
    return DateTime(
      int.parse(match.group(1)!),
      int.parse(match.group(2)!),
      int.parse(match.group(3)!),
      int.parse(match.group(4) ?? '0'),
      int.parse(match.group(5) ?? '0'),
      int.parse(match.group(6) ?? '0'),
    );
  }

  final parsed = DateTime.tryParse(rawValue);
  if (parsed == null) return null;
  return parsed.isUtc ? parsed.toLocal() : parsed;
}

String formatLiveClassDateTimeForApi(DateTime value) {
  return DateFormat("yyyy-MM-dd'T'HH:mm:ss").format(value);
}

String formatLiveClassDateTimeForText(
  dynamic value, {
  String pattern = 'MMM dd, yyyy - hh:mm a',
  String fallback = '--',
}) {
  final dateTime = parseLiveClassDateTime(value);
  if (dateTime == null) return fallback;
  return DateFormat(pattern).format(dateTime);
}

int? liveClassDateTimeComparable(dynamic value) {
  final dateTime = parseLiveClassDateTime(value);
  if (dateTime == null) return null;

  return (dateTime.year * 10000000000) +
      (dateTime.month * 100000000) +
      (dateTime.day * 1000000) +
      (dateTime.hour * 10000) +
      (dateTime.minute * 100) +
      dateTime.second;
}

int currentLiveClassDateTimeComparable() {
  final currentIndiaWallClock = DateTime.now().toUtc().add(
        _liveClassTimezoneOffset,
      );

  return (currentIndiaWallClock.year * 10000000000) +
      (currentIndiaWallClock.month * 100000000) +
      (currentIndiaWallClock.day * 1000000) +
      (currentIndiaWallClock.hour * 10000) +
      (currentIndiaWallClock.minute * 100) +
      currentIndiaWallClock.second;
}

String calculateLiveClassStatus(dynamic startTime, dynamic endTime) {
  final startComparable = liveClassDateTimeComparable(startTime);
  if (startComparable == null) return 'upcoming';

  final endComparable = liveClassDateTimeComparable(endTime);
  final nowComparable = currentLiveClassDateTimeComparable();

  if (nowComparable < startComparable) return 'upcoming';
  if (endComparable != null && nowComparable > endComparable) return 'completed';
  return 'live';
}
