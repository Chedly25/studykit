interface FAQ {
  question: string
  answer: string
}

interface ToolContent {
  faqs: FAQ[]
  content: string
}

export const toolContent: Record<string, ToolContent> = {
  'gpa-calculator': {
    faqs: [
      { question: 'How is GPA calculated?', answer: 'GPA is calculated by multiplying each course grade point by its credit hours, summing those values, and dividing by total credit hours. This gives a weighted average.' },
      { question: 'What is a good GPA?', answer: 'A GPA of 3.0 (B average) is generally considered good. A 3.5+ is very good, and 3.7+ is excellent. Requirements vary by program and institution.' },
      { question: 'What is the difference between 4.0 and 5.0 scale?', answer: 'The 4.0 scale is standard in most colleges where A=4.0. The 5.0 scale is used in some high schools where honors/AP classes can earn up to 5.0 points.' },
    ],
    content: 'Your Grade Point Average (GPA) is one of the most important metrics in your academic career. Use this calculator to track your cumulative GPA across all courses. Simply add each course with its credit hours and letter grade to see your weighted GPA instantly.',
  },
  'grade-calculator': {
    faqs: [
      { question: 'How does weighted grading work?', answer: 'In weighted grading, each assignment category has a percentage weight (e.g., homework 20%, exams 50%, projects 30%). Your final grade is the sum of each category score multiplied by its weight.' },
      { question: 'What letter grade is a 93%?', answer: 'In most standard grading scales, a 93% or above is an A. The exact cutoffs can vary: A+ (97-100), A (93-96), A- (90-92).' },
    ],
    content: 'Keep track of your current grade in any class by entering your assignments with their weights and scores. The calculator will show your overall weighted grade and corresponding letter grade in real time.',
  },
  'final-grade-calculator': {
    faqs: [
      { question: 'How do I calculate what I need on my final?', answer: 'The formula is: Required = (Desired Grade - Current Grade × (1 - Final Weight)) / Final Weight. Our calculator handles this automatically.' },
      { question: 'What if I need more than 100% on my final?', answer: 'If the calculator shows you need more than 100%, it means achieving your desired grade is mathematically impossible with the given final exam weight.' },
    ],
    content: 'Wondering what you need to score on your final exam? Enter your current grade, desired final grade, and the weight of your final exam to find out the minimum score needed.',
  },
  'word-counter': {
    faqs: [
      { question: 'How are words counted?', answer: 'Words are counted by splitting text on whitespace boundaries. Hyphenated words count as one word. Numbers and abbreviations each count as one word.' },
      { question: 'How is reading time calculated?', answer: 'Reading time is based on your selected reading speed (default 238 WPM). Speaking time uses 150 words per minute. You can adjust the WPM with the speed slider.' },
    ],
    content: 'Paste or type your text to instantly see word count, character count (with and without spaces), sentence count, paragraph count, estimated reading time, speaking time, and page count. Adjust reading speed for more accurate estimates.',
  },
  'citation-generator': {
    faqs: [
      { question: 'What citation formats are supported?', answer: 'The generator supports APA 7th Edition, MLA 9th Edition, Chicago 17th Edition, and Harvard referencing style.' },
      { question: 'What source types can I cite?', answer: 'You can generate citations for books, websites, journal articles, and videos. Each source type has relevant fields for accurate citation.' },
    ],
    content: 'Generate properly formatted citations for your research papers and essays. Select your source type, fill in the details, and choose your citation format. Copy the formatted citation with one click.',
  },
  'pomodoro-timer': {
    faqs: [
      { question: 'What is the Pomodoro Technique?', answer: 'The Pomodoro Technique is a time management method where you work for 25 minutes (one "pomodoro"), then take a 5-minute break. After 4 pomodoros, take a longer 15-30 minute break.' },
      { question: 'Can I customize the timer durations?', answer: 'Yes! You can customize work duration, short break duration, and long break duration to fit your study style.' },
    ],
    content: 'Boost your study productivity with the Pomodoro technique. Set your work and break durations, start the timer, and focus. Track your completed sessions and build consistent study habits.',
  },
  'exam-countdown': {
    faqs: [
      { question: 'Are my exams saved?', answer: 'Yes, all your exams are saved in your browser\'s localStorage. They\'ll be there when you return, as long as you use the same browser.' },
      { question: 'What happens when an exam passes?', answer: 'Past exams are moved to a "completed" section. You can remove them anytime.' },
    ],
    content: 'Keep track of all your upcoming exams in one place. Add exam names and dates to see countdown timers showing exactly how much time you have to prepare. Stay organized and never be caught off guard.',
  },
  'study-time-tracker': {
    faqs: [
      { question: 'How is study time tracked?', answer: 'Use the start/stop timer to record study sessions for each subject. All time is tracked to the second and displayed in hours and minutes.' },
      { question: 'Is my data saved?', answer: 'All study sessions are saved in your browser\'s localStorage. Your data stays on your device and persists between visits.' },
    ],
    content: 'Monitor your study habits by tracking time spent on each subject. Start and stop the timer as you study, and view your weekly statistics to understand where your time goes.',
  },
  'flashcard-maker': {
    faqs: [
      { question: 'What is spaced repetition?', answer: 'Spaced repetition is a study technique where you review material at increasing intervals. Cards you know well are shown less frequently, while difficult cards appear more often.' },
      { question: 'How does the SM-2 algorithm work?', answer: 'SM-2 calculates optimal review intervals based on how easily you recalled each card. Rate your recall from Again (0) to Easy (5), and the algorithm schedules the next review accordingly.' },
      { question: 'Can I import/export flashcards?', answer: 'Yes! You can export your flashcard decks as JSON or CSV files and import them later or share with classmates.' },
    ],
    content: 'Create digital flashcard decks and study with the SM-2 spaced repetition algorithm. Manage decks with add/edit/delete, study due cards with quality ratings, and track your progress with mastery stats and review scheduling.',
  },
  'assignment-tracker': {
    faqs: [
      { question: 'Are my assignments saved?', answer: 'Yes, all assignments are saved in your browser\'s localStorage. They\'ll persist between visits as long as you use the same browser.' },
      { question: 'How can I organize my assignments?', answer: 'You can sort assignments by due date, priority, or status. Filter by status (all, to-do, in progress, done) to focus on what needs attention.' },
    ],
    content: 'Keep track of all your homework, projects, and assignments in one place. Add due dates, set priority levels, and update status as you work. Sort and filter to stay organized throughout the semester.',
  },
  'ambient-sound-generator': {
    faqs: [
      { question: 'What sounds are available?', answer: 'Four sound types: white noise, rain, coffee shop ambiance, and lo-fi. Each can be toggled on/off and has its own volume control.' },
      { question: 'Can I mix multiple sounds?', answer: 'Yes! Toggle any combination of sounds and adjust individual volumes to create your perfect study atmosphere.' },
      { question: 'Does this use external audio files?', answer: 'No, all sounds are generated in real-time using the Web Audio API directly in your browser. No downloads or streaming required.' },
    ],
    content: 'Create your ideal study environment with synthesized ambient sounds. Mix white noise, rain, coffee shop ambiance, and lo-fi sounds with individual volume controls. All generated in your browser.',
  },
  'periodic-table': {
    faqs: [
      { question: 'How many elements are there?', answer: 'There are 118 confirmed elements in the periodic table, from Hydrogen (1) to Oganesson (118).' },
      { question: 'What do the colors represent?', answer: 'Elements are color-coded by their category: alkali metals, alkaline earth metals, transition metals, metalloids, nonmetals, noble gases, lanthanides, and actinides.' },
    ],
    content: 'Explore all 118 elements of the periodic table in an interactive format. Click any element to see its atomic number, atomic mass, electron configuration, and category. Search and filter elements by name or symbol.',
  },
  'unit-converter': {
    faqs: [
      { question: 'What categories of units are supported?', answer: 'The converter supports 7 categories: length, weight/mass, temperature, volume, area, speed, and time.' },
      { question: 'How accurate are the conversions?', answer: 'Conversions use standard conversion factors and are accurate to multiple decimal places. Temperature conversions use the exact formulas.' },
    ],
    content: 'Convert between common units of measurement across 7 categories. Enter a value, select your units, and see the conversion instantly. Supports metric, imperial, and other common measurement systems.',
  },
}
