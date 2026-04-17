import path from "path"
import tailwindcss from "@tailwindcss/vite"

import { defineConfig } from "vite";
import { vitePlugin as remix } from "@remix-run/dev";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  plugins: [
    tailwindcss(),
    remix({
      appDirectory: "src",
      future: {
        v3_fetcherPersist: true,
        v3_relativeSplatPath: true,
        v3_throwAbortReason: true,
        v3_singleFetch: true,
        v3_lazyRouteDiscovery: true,
      },
      routes(defineRoutes) {
        return defineRoutes((route) => {
          route("/", "./pages/index.jsx", { index: true });
          route("/login", "./pages/login.jsx");
          route("/api/auth/login", "./pages/api.login.js");
          route("/api/dashboard", "./pages/api.dashboard.js");
          route("/api/attendance", "./pages/api.attendance.js");
          route("/api/homework", "./pages/api.homework.js");
          route("/api/live-classes", "./pages/api.live_classes.js");
          route("/api/feedback", "./pages/api.feedback.js");
          route("/api/timetable", "./pages/api.timetable.js");
          
          // Admin API Routes
          route("/api/admin/schools", "./pages/api.admin.schools.js");
          route("/api/admin/users", "./pages/api.admin.users.js");
          route("/api/admin/classes", "./pages/api.admin.classes.js");
          route("/api/admin/subjects", "./pages/api.admin.subjects.js");
          route("/api/admin/teachers", "./pages/api.admin.teachers.js");
          route("/api/admin/live-classes", "./pages/api.admin.live-classes.js");
          route("/api/admin/blogs", "./pages/api.admin.blogs.js");
          route("/api/admin/blog-categories", "./pages/api.admin.blog-categories.js");
          route("/api/admin/students", "./pages/api.admin.students.js");
          route("/api/admin/class-admins", "./pages/api.admin.class-admins.js");
          route("/api/notifications", "./pages/api.notifications.js");
          route("/api/change-password", "./pages/api.change-password.js");
          route("/api/blog/:id", "./pages/api.blog.$id.js");
          route("/api/blogs-public", "./pages/api.blogs.js");

          route("/blogs", "./pages/blogs.jsx");
          route("/blog/:id", "./pages/blog.$id.jsx");
          route("/.well-known/*", "./pages/.well-known.jsx");
          route("", "./components/layout.jsx", () => {
            return [
              route("/logout", "./pages/logout.jsx"),
              route("dashboard", "./pages/dashboard.jsx"),
              route("/school", "./pages/school.jsx"),
              route("/teacher", "./pages/teacher.jsx"),
              route("/live-class", "./pages/live-class.jsx"),
              route("/manage-live-classes", "./pages/manage-live-classes.jsx"),
              route("/subject", "./pages/subject.jsx"),
              route("/class", "./pages/class.jsx"),
              route("/timetable", "./pages/timetable.jsx"),
              route("/school-admin", "./pages/school-admin.jsx"),
              route("/class-admin", "./pages/class-admin.jsx"),
              route("/attendance", "./pages/attendance.jsx"),
              route("/student", "./pages/student.jsx"),
              route("/parent", "./pages/parent.jsx"),
              route("/homework", "./pages/homework.jsx"),
              route("/feedback", "./pages/feedback.jsx"),
              route("/student-live-classes", "./pages/student-live-classes.jsx"),
              route("/change-password", "./pages/change-password.jsx"),
              route("/manage-blogs", "./pages/manage-blogs.jsx"),
              route("/notifications", "./pages/notifications.jsx"),
            ];
          })
        });
      },
    }),
  ],
});
