import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import 'package:firebase_core/firebase_core.dart';
import 'providers/auth_provider.dart';
import 'screens/login_screen.dart';
import 'screens/splash_screen.dart';
import 'screens/dashboard_screen.dart';
import 'services/notification_service.dart';
import 'screens/notifications_screen.dart';

final GlobalKey<NavigatorState> navigatorKey = GlobalKey<NavigatorState>();

void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  
  try {
    await Firebase.initializeApp();
    // Initialize notifications early so token is available for AuthProvider
    await NotificationService.initialize();
  } catch (e) {
    debugPrint('Error initializing Firebase/Notifications: $e');
  }

  runApp(
    MultiProvider(
      providers: [
        ChangeNotifierProvider(create: (_) => AuthProvider()),
      ],
      child: const LearnSrinagarApp(),
    ),
  );
}

class LearnSrinagarApp extends StatefulWidget {
  const LearnSrinagarApp({super.key});

  @override
  State<LearnSrinagarApp> createState() => _LearnSrinagarAppState();
}

class _LearnSrinagarAppState extends State<LearnSrinagarApp> {
  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      navigatorKey: navigatorKey,
      title: 'Learn Srinagar',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(
          seedColor: Colors.blue,
          primary: Colors.blue,
        ),
        useMaterial3: true,
        fontFamily: 'Inter',
      ),
      home: Consumer<AuthProvider>(
        builder: (context, auth, _) {
          if (auth.isInitializing) {
            return const SplashScreen();
          }
          if (auth.isAuthenticated) {
            return const DashboardScreen();
          } else {
            return const LoginScreen();
          }
        },
      ),
      routes: {
        '/notifications': (context) => const NotificationsScreen(),
      },
    );
  }
}
