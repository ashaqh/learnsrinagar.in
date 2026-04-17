import { query } from "@/lib/db";
import { format } from "date-fns";
import { createLiveClassDate } from "@/lib/liveClassDateTime";

/**
 * Generates a human-like notification message for a new live class.
 * @param {Object} data - Live class data
 * @param {string} data.topic_name - Topic of the class
 * @param {number|string} data.class_id - Targeted class ID
 * @param {number|string} data.teacher_id - Teacher's user ID
 * @param {string|Date} data.start_time - Scheduled start time
 * @returns {Promise<string>} The generated message
 */
export async function getLiveClassNotification({ topic_name, class_id, teacher_id, start_time }) {
  try {
    // 1. Fetch Class Name
    let className = "your class";
    if (class_id && class_id !== 'all') {
      const classResult = await query('SELECT name FROM classes WHERE id = ?', [class_id]);
      if (classResult.length > 0) {
        className = classResult[0].name;
      }
    } else {
      className = "all classes";
    }

    // 2. Fetch Teacher Name
    let teacherName = "Your teacher";
    if (teacher_id) {
      const teacherResult = await query('SELECT name FROM users WHERE id = ?', [teacher_id]);
      if (teacherResult.length > 0) {
        teacherName = teacherResult[0].name;
      }
    }

    // 3. Format Date and Time using date-fns
    const dateObj = createLiveClassDate(start_time);
    if (!dateObj) {
      throw new Error('Invalid live class start time');
    }
    // User requested format: ____(date) at (time)
    // We'll use a friendly format: "31st March" and "09:00 PM"
    const dateStr = format(dateObj, "do MMMM (EEEE)"); // e.g. 31st March (Tuesday)
    const timeStr = format(dateObj, "hh:mm a"); // e.g. 09:00 PM

    // 4. Message Templates (Human-like variations)
    const templates = [
      `A new lesson for ${topic_name} has been scheduled for class ${className}. ${teacherName} will conduct the class on ${dateStr} at ${timeStr}. Have a nice day ahead.`,
      `Hi students! ${teacherName} has scheduled a live session on ${topic_name} for class ${className}. Join us on ${dateStr} at ${timeStr}. See you there! Have a great day.`,
      `Upcoming Live Class: ${topic_name} for ${className} by ${teacherName}. Mark your calendars for ${dateStr} at ${timeStr}. Don't miss out! Have a wonderful day.`,
      `New learning opportunity! ${teacherName} will be teaching ${topic_name} live for class ${className} on ${dateStr} at ${timeStr}. Wishing you a productive day ahead.`
    ];

    // Randomly select a template
    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  } catch (error) {
    console.error('Error generating notification message:', error);
    // Fallback message
    return `A new live class for ${topic_name} has been scheduled.`;
  }
}

/**
 * Generates a personalized message for a new blog post
 * @param {string} title Blog title
 * @param {number} category_id Category ID
 * @param {number} author_id Author ID
 * @returns {Promise<string>} The generated message
 */
export async function getBlogNotification(title, category_id, author_id) {
  try {
    // 1. Fetch Category Name
    let categoryName = "Latest Updates";
    if (category_id) {
      const categoryResult = await query('SELECT name FROM blog_categories WHERE id = ?', [category_id]);
      if (categoryResult.length > 0) {
        categoryName = categoryResult[0].name;
      }
    }

    // 2. Fetch Author Name
    let authorName = "Team Learn Srinagar";
    if (author_id) {
      const authorResult = await query('SELECT name FROM users WHERE id = ?', [author_id]);
      if (authorResult.length > 0) {
        authorName = authorResult[0].name;
      }
    }

    // 3. Message Templates
    const templates = [
      `A new story on "${title}" has just been published by ${authorName} in ${categoryName}. Happy reading!`,
      `Don't miss our latest blog post: "${title}". Written by ${authorName}, it's now live in the ${categoryName} section.`,
      `Fresh content alert! ${authorName} just shared some insights on "${title}". Find it under ${categoryName}.`,
      `Hi everyone! We've just posted a new blog titled "${title}" in ${categoryName}. Check it out now!`,
      `New blog post: "${title}". Curated for you by ${authorName} in ${categoryName}. Read more inside.`
    ];

    const randomIndex = Math.floor(Math.random() * templates.length);
    return templates[randomIndex];
  } catch (error) {
    console.error('Error generating blog notification:', error);
    return `New blog posted: ${title}. Check it out!`;
  }
}

export async function getHomeworkNotification({
  title,
  classId,
  subjectId,
  teacherId,
}) {
  try {
    const [classResult, subjectResult, teacherResult] = await Promise.all([
      classId ? query('SELECT name FROM classes WHERE id = ?', [classId]) : [],
      subjectId ? query('SELECT name FROM subjects WHERE id = ?', [subjectId]) : [],
      teacherId ? query('SELECT name FROM users WHERE id = ?', [teacherId]) : [],
    ])

    const className = classResult?.[0]?.name || 'the selected class'
    const subjectName = subjectResult?.[0]?.name || 'the selected subject'
    const teacherName = teacherResult?.[0]?.name || 'Your teacher'

    const templates = [
      `${teacherName} has assigned new homework for ${className} in ${subjectName}: "${title}". Please check the homework section for details.`,
      `New homework added for ${className}. ${teacherName} posted "${title}" in ${subjectName}. Open the app to review the assignment.`,
      `Homework update: ${teacherName} shared a new ${subjectName} task for ${className} titled "${title}". Please take a look.`,
      `A new homework assignment, "${title}", is now available for ${className} in ${subjectName}. Added by ${teacherName}.`,
    ]

    const randomIndex = Math.floor(Math.random() * templates.length)
    return templates[randomIndex]
  } catch (error) {
    console.error('Error generating homework notification:', error)
    return `New homework added: ${title}. Please check the homework section for details.`
  }
}

export async function getSchoolLifecycleNotification({
  action,
  schoolName,
  associatedUserId = null,
  associatedUserName = null,
}) {
  try {
    let linkedUserName = associatedUserName || null

    if (!linkedUserName && associatedUserId) {
      const userResult = await query('SELECT name FROM users WHERE id = ?', [associatedUserId])
      if (userResult.length > 0) {
        linkedUserName = userResult[0].name
      }
    }

    if (action === 'created') {
      return linkedUserName
        ? `A new school, ${schoolName}, has been added to Learn Srinagar and linked with ${linkedUserName}.`
        : `A new school, ${schoolName}, has been added to Learn Srinagar.`
    }

    if (action === 'deleted') {
      return `The school ${schoolName} has been removed from Learn Srinagar. Please contact the administration for any follow-up.`
    }

    return `There is an update for the school ${schoolName}.`
  } catch (error) {
    console.error('Error generating school notification:', error)
    return action === 'deleted'
      ? `The school ${schoolName} has been removed.`
      : `A new school, ${schoolName}, has been added.`
  }
}

export async function getClassAdminLifecycleNotification({
  action,
  adminName,
  classId,
  schoolId,
}) {
  try {
    const [classResult, schoolResult] = await Promise.all([
      classId ? query('SELECT name FROM classes WHERE id = ?', [classId]) : [],
      schoolId ? query('SELECT name FROM schools WHERE id = ?', [schoolId]) : [],
    ])

    const className = classResult?.[0]?.name || 'the selected class'
    const schoolName = schoolResult?.[0]?.name || 'the selected school'

    if (action === 'created') {
      return `${adminName} has been assigned as the class admin for class ${className} at ${schoolName}.`
    }

    if (action === 'deleted') {
      return `${adminName} is no longer assigned as the class admin for class ${className} at ${schoolName}.`
    }

    return `There is an update to the class admin assignment for ${adminName}.`
  } catch (error) {
    console.error('Error generating class admin notification:', error)
    return action === 'deleted'
      ? `${adminName} is no longer assigned as a class admin.`
      : `${adminName} has been assigned as a class admin.`
  }
}
