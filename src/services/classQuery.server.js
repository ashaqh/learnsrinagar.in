import { query } from "@/lib/db"

let classesSupportsSchoolIdPromise

export async function classesTableSupportsSchoolId() {
  if (!classesSupportsSchoolIdPromise) {
    classesSupportsSchoolIdPromise = query(
      "SHOW COLUMNS FROM classes LIKE 'school_id'"
    ).then((rows) => rows.length > 0)
  }

  return classesSupportsSchoolIdPromise
}

export async function getClassesForSchool(schoolId = null) {
  const supportsSchoolId = await classesTableSupportsSchoolId()

  if (schoolId && supportsSchoolId) {
    return query(
      'SELECT id, name FROM classes WHERE school_id = ? ORDER BY name',
      [schoolId]
    )
  }

  return query('SELECT id, name FROM classes ORDER BY name')
}
