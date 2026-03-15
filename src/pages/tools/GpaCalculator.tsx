import { useState, useEffect, useCallback, useMemo } from 'react'
import { Trash2, Plus } from 'lucide-react'
import { ToolSEO } from '../../components/SEO'
import { FormToolPage } from '../../components/FormToolPage'
import { getToolBySlug } from '../../lib/tools'

const tool = getToolBySlug('gpa-calculator')!

interface Course {
  name: string
  credits: number
  grade: string
}

type Scale = '4.0' | '5.0'

const GRADES_4: { label: string; value: number }[] = [
  { label: 'A', value: 4.0 },
  { label: 'A-', value: 3.7 },
  { label: 'B+', value: 3.3 },
  { label: 'B', value: 3.0 },
  { label: 'B-', value: 2.7 },
  { label: 'C+', value: 2.3 },
  { label: 'C', value: 2.0 },
  { label: 'C-', value: 1.7 },
  { label: 'D+', value: 1.3 },
  { label: 'D', value: 1.0 },
  { label: 'F', value: 0 },
]

const GRADES_5: { label: string; value: number }[] = [
  { label: 'A+', value: 5.0 },
  ...GRADES_4,
]

const STORAGE_KEY = 'studieskit-gpa-courses'

function getLetterGrade(gpa: number, scale: Scale): string {
  const grades = scale === '5.0' ? GRADES_5 : GRADES_4
  for (const g of grades) {
    if (gpa >= g.value - 0.15) return g.label
  }
  return 'F'
}

function loadCourses(): Course[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    if (saved) {
      const parsed = JSON.parse(saved) as Course[]
      if (Array.isArray(parsed) && parsed.length > 0) return parsed
    }
  } catch {
    // ignore
  }
  return [
    { name: '', credits: 3, grade: 'A' },
    { name: '', credits: 3, grade: 'B+' },
  ]
}

export default function GpaCalculator() {
  const [courses, setCourses] = useState<Course[]>(loadCourses)
  const [scale, setScale] = useState<Scale>('4.0')

  const gradeOptions = scale === '5.0' ? GRADES_5 : GRADES_4

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(courses))
  }, [courses])

  const addCourse = useCallback(() => {
    setCourses(prev => [...prev, { name: '', credits: 3, grade: 'A' }])
  }, [])

  const removeCourse = useCallback((index: number) => {
    setCourses(prev => prev.filter((_, i) => i !== index))
  }, [])

  const updateCourse = useCallback((index: number, field: keyof Course, value: string | number) => {
    setCourses(prev =>
      prev.map((c, i) => (i === index ? { ...c, [field]: value } : c))
    )
  }, [])

  const { gpa, totalCredits } = useMemo(() => {
    let weightedSum = 0
    let creditSum = 0
    for (const course of courses) {
      const gradeEntry = gradeOptions.find(g => g.label === course.grade)
      if (gradeEntry && course.credits > 0) {
        weightedSum += gradeEntry.value * course.credits
        creditSum += course.credits
      }
    }
    return {
      gpa: creditSum > 0 ? weightedSum / creditSum : 0,
      totalCredits: creditSum,
    }
  }, [courses, gradeOptions])

  const letterGrade = getLetterGrade(gpa, scale)

  return (
    <>
      <ToolSEO title={tool.seoTitle} description={tool.seoDescription} slug={tool.slug} keywords={tool.keywords} />
      <FormToolPage toolId={tool.id} title={tool.name} description={tool.description}>
        {/* Scale selector */}
        <div className="flex items-center justify-between mb-6">
          <label className="text-[var(--text-body)] text-sm font-medium">Grading Scale</label>
          <div className="flex gap-2">
            {(['4.0', '5.0'] as Scale[]).map(s => (
              <button
                key={s}
                onClick={() => setScale(s)}
                className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all ${
                  scale === s
                    ? 'btn-primary'
                    : 'btn-secondary'
                }`}
              >
                {s} Scale
              </button>
            ))}
          </div>
        </div>

        {/* Result display */}
        <div className="glass-card p-6 mb-6 text-center">
          <p className="text-[var(--text-muted)] text-sm mb-1">Your GPA</p>
          <p className="font-[family-name:var(--font-display)] text-5xl font-bold text-[var(--accent-text)]">
            {gpa.toFixed(2)}
          </p>
          <p className="text-[var(--text-body)] text-lg mt-1">
            {letterGrade} &middot; {totalCredits} credit{totalCredits !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Desktop table */}
        <div className="hidden md:block glass-card overflow-hidden mb-4">
          <table className="w-full">
            <thead>
              <tr className="border-b border-[var(--border-card)]">
                <th className="text-left text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider px-4 py-3">
                  Course Name
                </th>
                <th className="text-left text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider px-4 py-3">
                  Credits
                </th>
                <th className="text-left text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider px-4 py-3">
                  Grade
                </th>
                <th className="w-12 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {courses.map((course, i) => (
                <tr key={i} className="border-b border-[var(--border-card)] last:border-b-0" style={{ borderColor: 'color-mix(in srgb, var(--border-card) 50%, transparent)' }}>
                  <td className="px-4 py-2">
                    <input
                      type="text"
                      placeholder={`Course ${i + 1}`}
                      value={course.name}
                      onChange={e => updateCourse(i, 'name', e.target.value)}
                      className="input-field"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <input
                      type="number"
                      min={0.5}
                      max={12}
                      step={0.5}
                      value={course.credits}
                      onChange={e => updateCourse(i, 'credits', parseFloat(e.target.value) || 0)}
                      className="input-field w-24"
                    />
                  </td>
                  <td className="px-4 py-2">
                    <select
                      value={course.grade}
                      onChange={e => updateCourse(i, 'grade', e.target.value)}
                      className="select-field w-28"
                    >
                      {gradeOptions.map(g => (
                        <option key={g.label} value={g.label}>
                          {g.label} ({g.value.toFixed(1)})
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-2">
                    <button
                      onClick={() => removeCourse(i)}
                      disabled={courses.length <= 1}
                      className="p-2 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                      aria-label="Remove course"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <div className="md:hidden space-y-3 mb-4">
          {courses.map((course, i) => (
            <div key={i} className="glass-card p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-[var(--text-muted)] text-xs font-medium uppercase tracking-wider">
                  Course {i + 1}
                </span>
                <button
                  onClick={() => removeCourse(i)}
                  disabled={courses.length <= 1}
                  className="p-1.5 text-[var(--text-muted)] hover:text-red-400 transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                  aria-label="Remove course"
                >
                  <Trash2 size={14} />
                </button>
              </div>
              <input
                type="text"
                placeholder="Course name"
                value={course.name}
                onChange={e => updateCourse(i, 'name', e.target.value)}
                className="input-field"
              />
              <div className="flex gap-3">
                <div className="flex-1">
                  <label className="text-[var(--text-faint)] text-xs mb-1 block">Credits</label>
                  <input
                    type="number"
                    min={0.5}
                    max={12}
                    step={0.5}
                    value={course.credits}
                    onChange={e => updateCourse(i, 'credits', parseFloat(e.target.value) || 0)}
                    className="input-field"
                  />
                </div>
                <div className="flex-1">
                  <label className="text-[var(--text-faint)] text-xs mb-1 block">Grade</label>
                  <select
                    value={course.grade}
                    onChange={e => updateCourse(i, 'grade', e.target.value)}
                    className="select-field"
                  >
                    {gradeOptions.map(g => (
                      <option key={g.label} value={g.label}>
                        {g.label} ({g.value.toFixed(1)})
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add course button */}
        <button onClick={addCourse} className="btn-secondary flex items-center gap-2 mx-auto">
          <Plus size={16} />
          Add Course
        </button>
      </FormToolPage>
    </>
  )
}
