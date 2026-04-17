-- Blog System for Learn Srinagar LMS
-- Compatible with existing database structure
-- Execute this file to add blog functionality

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;

--
-- Table structure for table `blog_categories`
--

DROP TABLE IF EXISTS `blog_categories`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blog_categories` (
  `id` int NOT NULL AUTO_INCREMENT,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blog_categories`
--

LOCK TABLES `blog_categories` WRITE;
/*!40000 ALTER TABLE `blog_categories` DISABLE KEYS */;
INSERT INTO `blog_categories` VALUES 
(1,'Announcements','Official school updates like exam dates, holidays, results, etc.','2025-01-15 12:00:00'),
(2,'Class Updates','Blogs or notices specific to classes (Class 6, 7, 8, etc.)','2025-01-15 12:00:00'),
(3,'Achievements','Student or staff achievements, competitions, or awards','2025-01-15 12:00:00'),
(4,'Events & Activities','Photos and write-ups about cultural events, sports day, etc.','2025-01-15 12:00:00'),
(5,'Educational Articles','Informative blogs by teachers or experts on academic topics','2025-01-15 12:00:00'),
(6,'Student Corner','Student-written blogs, stories, poems, etc.','2025-01-15 12:00:00'),
(7,'Teacher Desk','Teacher reflections, tips, or classroom updates','2025-01-15 12:00:00'),
(8,'Parent Information','Circulars, parenting tips, and important info for parents','2025-01-15 12:00:00'),
(9,'Workshops & Seminars','Updates on training sessions or academic meets','2025-01-15 12:00:00');
/*!40000 ALTER TABLE `blog_categories` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `blogs`
--

DROP TABLE IF EXISTS `blogs`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `blogs` (
  `id` int NOT NULL AUTO_INCREMENT,
  `title` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `category_id` int NOT NULL,
  `author_id` int NOT NULL,
  `thumbnail_image` longblob DEFAULT NULL,
  `cover_image` longblob DEFAULT NULL,
  `short_desc` text CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci,
  `content` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci NOT NULL,
  `attachments` json DEFAULT NULL,
  `publish_date` date NOT NULL,
  `created_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` timestamp NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `category_id` (`category_id`),
  KEY `author_id` (`author_id`),
  KEY `publish_date` (`publish_date`),
  CONSTRAINT `blogs_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `blog_categories` (`id`),
  CONSTRAINT `blogs_ibfk_2` FOREIGN KEY (`author_id`) REFERENCES `users` (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `blogs`
--

LOCK TABLES `blogs` WRITE;
/*!40000 ALTER TABLE `blogs` DISABLE KEYS */;
INSERT INTO `blogs` VALUES 
(1,'Welcome to Learn Srinagar Blog',1,1,NULL,NULL,'Introducing our new blog platform for sharing updates, achievements, and educational content across our school network.','<h2>Welcome to Learn Srinagar Blog</h2><p>We are excited to launch our comprehensive blog platform where we will share important updates, student achievements, educational articles, and much more from across our network of 12 schools.</p><h3>What You Can Expect</h3><ul><li>Regular updates from all partner schools</li><li>Student achievement highlights</li><li>Educational resources and articles</li><li>Event coverage and photo galleries</li><li>Teacher insights and classroom updates</li></ul><p>Stay tuned for regular updates that will keep our entire Learn Srinagar community connected and informed.</p>',NULL,'2025-01-15','2025-01-15 12:00:00','2025-01-15 12:00:00'),
(2,'Annual Sports Day 2025 - A Grand Celebration',4,1,NULL,NULL,'Our schools celebrated Annual Sports Day with great enthusiasm and participation from students across all 12 partner schools.','<h2>Annual Sports Day 2025</h2><p>Learn Srinagar schools organized a spectacular Annual Sports Day event with participation from all 12 partner schools, showcasing the athletic talents of our students.</p><h3>Event Highlights</h3><ul><li>Inter-school athletic competitions</li><li>Individual track and field events</li><li>Team sports tournaments</li><li>Cultural performances during breaks</li><li>Prize distribution ceremony</li><li>Parent and community participation</li></ul><h3>Winners and Achievements</h3><p>Students from various schools excelled in different categories, demonstrating the high level of athletic talent across our network.</p><p>Congratulations to all participants, winners, and organizing teams for making this event a grand success!</p>',NULL,'2025-01-15','2025-01-15 12:00:00','2025-01-15 12:00:00'),
(3,'Advanced Mathematics Workshop for Class 8 Students',9,1,NULL,NULL,'Special mathematics workshop conducted for Class 8 students focusing on advanced problem-solving techniques and exam preparation.','<h2>Mathematics Excellence Workshop</h2><p>A comprehensive mathematics workshop was conducted for Class 8 students across our network, focusing on advanced mathematical concepts and problem-solving strategies.</p><h3>Workshop Curriculum</h3><ul><li>Advanced algebraic problem-solving techniques</li><li>Geometric reasoning and proofs</li><li>Practical applications of mathematics in daily life</li><li>Interactive learning methods and group activities</li><li>Preparation strategies for competitive exams</li><li>Mental math techniques and shortcuts</li></ul><h3>Student Feedback</h3><p>The workshop received excellent feedback from both students and teachers, with participants showing significant improvement in their mathematical reasoning abilities.</p><p>We plan to conduct similar workshops for other subjects and grade levels in the coming months.</p>',NULL,'2025-01-15','2025-01-15 12:00:00','2025-01-15 12:00:00');
/*!40000 ALTER TABLE `blogs` ENABLE KEYS */;
UNLOCK TABLES;



/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;
/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

-- Blog system installation completed successfully!