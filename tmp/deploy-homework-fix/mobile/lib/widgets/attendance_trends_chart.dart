import 'package:flutter/material.dart';
import 'package:fl_chart/fl_chart.dart';

class AttendanceTrendsChart extends StatelessWidget {
  final List<dynamic>? data;
  
  const AttendanceTrendsChart({super.key, this.data});

  @override
  Widget build(BuildContext context) {
    if (data == null || data!.isEmpty) {
      return Container(
        height: 200,
        decoration: BoxDecoration(
          border: Border.all(color: Colors.grey[200]!),
          borderRadius: BorderRadius.circular(8),
        ),
        child: const Center(
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Text(
                'No attendance data available for the selected criteria.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
              Text(
                'Please adjust your filters.',
                style: TextStyle(color: Colors.grey, fontSize: 13),
              ),
            ],
          ),
        ),
      );
    }

    return SizedBox(
      height: 250,
      child: LineChart(
        LineChartData(
          gridData: FlGridData(
            show: true, 
            drawVerticalLine: false,
            getDrawingHorizontalLine: (value) => FlLine(
              color: Colors.grey[200]!,
              strokeWidth: 1,
            ),
          ),
          titlesData: FlTitlesData(
            show: true,
            rightTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            topTitles: const AxisTitles(sideTitles: SideTitles(showTitles: false)),
            bottomTitles: AxisTitles(
              sideTitles: SideTitles(
                showTitles: true,
                getTitlesWidget: (value, meta) {
                  if (value.toInt() < 0 || value.toInt() >= data!.length) return const SizedBox();
                  final date = data![value.toInt()]['date'].toString().substring(5, 10); // MM-DD
                  return Padding(
                    padding: const EdgeInsets.only(top: 8.0),
                    child: Text(date, style: const TextStyle(fontSize: 10, color: Colors.grey)),
                  );
                },
                reservedSize: 30,
              ),
            ),
          ),
          borderData: FlBorderData(show: false),
          lineBarsData: [
            LineChartBarData(
              spots: data!.asMap().entries.map((e) => FlSpot(e.key.toDouble(), double.parse(e.value['present'].toString()))).toList(),
              isCurved: true,
              color: Colors.teal,
              barWidth: 3,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: true),
              belowBarData: BarAreaData(
                show: true,
                color: Colors.teal.withValues(alpha: 0.1),
              ),
            ),
            LineChartBarData(
              spots: data!.asMap().entries.map((e) => FlSpot(e.key.toDouble(), double.parse(e.value['absent'].toString()))).toList(),
              isCurved: true,
              color: Colors.red,
              barWidth: 2,
              isStrokeCapRound: true,
              dotData: const FlDotData(show: false),
            ),
          ],
        ),
      ),
    );
  }
}
