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
  'percentage-calculator': {
    faqs: [
      { question: 'How do I calculate a percentage?', answer: 'To find X% of Y, multiply Y by X/100. For example, 25% of 200 = 200 × 0.25 = 50.' },
      { question: 'How do I calculate percentage increase?', answer: 'Percentage increase = ((New Value - Old Value) / Old Value) × 100. For example, going from 50 to 75 is a 50% increase.' },
    ],
    content: 'A versatile percentage calculator with three modes: calculate X% of a number, find what percentage one number is of another, or compute the percentage increase or decrease between two values.',
  },
  'gpa-to-letter-grade': {
    faqs: [
      { question: 'What letter grade is a 3.5 GPA?', answer: 'A 3.5 GPA falls between an A- (3.7) and a B+ (3.3), so it is roughly a B+/A- on the standard 4.0 scale.' },
      { question: 'What GPA is a B+?', answer: 'A B+ is typically equivalent to a 3.3 GPA on the standard 4.0 scale.' },
    ],
    content: 'Quickly convert between GPA values and letter grades. Enter a GPA to see the corresponding letter grade, or select a letter grade to see its GPA equivalent. Includes a visual reference chart.',
  },
  'word-counter': {
    faqs: [
      { question: 'How are words counted?', answer: 'Words are counted by splitting text on whitespace boundaries. Hyphenated words count as one word. Numbers and abbreviations each count as one word.' },
      { question: 'How is reading time calculated?', answer: 'Reading time is based on an average reading speed of 238 words per minute. Speaking time uses 150 words per minute.' },
    ],
    content: 'Paste or type your text to instantly see word count, character count (with and without spaces), sentence count, paragraph count, estimated reading time, and speaking time. Perfect for essays, blog posts, and assignments.',
  },
  'citation-generator': {
    faqs: [
      { question: 'What citation formats are supported?', answer: 'The generator supports APA 7th Edition, MLA 9th Edition, Chicago 17th Edition, and Harvard referencing style.' },
      { question: 'What source types can I cite?', answer: 'You can generate citations for books, websites, journal articles, and videos. Each source type has relevant fields for accurate citation.' },
    ],
    content: 'Generate properly formatted citations for your research papers and essays. Select your source type, fill in the details, and choose your citation format. Copy the formatted citation with one click.',
  },
  'paraphrasing-helper': {
    faqs: [
      { question: 'What is paraphrasing?', answer: 'Paraphrasing is restating someone else\'s ideas in your own words while keeping the original meaning. It\'s an essential academic writing skill.' },
      { question: 'How do I paraphrase effectively?', answer: 'Read the original text carefully, put it aside, write the idea in your own words, then compare with the original. Change both vocabulary and sentence structure.' },
    ],
    content: 'Improve your paraphrasing skills with this reference tool. Enter text and get tips for rewriting, including synonym suggestions and sentence restructuring techniques. Great for avoiding plagiarism in academic work.',
  },
  'essay-outline-generator': {
    faqs: [
      { question: 'What essay types are available?', answer: 'The generator supports argumentative, expository, persuasive, and compare-contrast essay types. Each produces a different structured outline.' },
      { question: 'How should I use the outline?', answer: 'Use the generated outline as a starting framework. Fill in each section with your research, arguments, and evidence. Customize the structure as needed for your specific assignment.' },
    ],
    content: 'Get a head start on your essays with structured outlines. Select your essay type, enter your topic, and receive a detailed outline with sections for introduction, body paragraphs, and conclusion.',
  },
  'reading-time-calculator': {
    faqs: [
      { question: 'What is the average reading speed?', answer: 'The average adult reads at about 200-250 words per minute for non-technical content. Technical or academic content is typically read at 150-200 WPM.' },
      { question: 'How accurate is the estimate?', answer: 'Reading time estimates are approximations based on word count and reading speed. Actual time varies with content complexity, reader familiarity, and reading conditions.' },
    ],
    content: 'Estimate how long it will take to read any text. Paste your text directly or enter a word count. Adjust the reading speed (WPM) to match your reading pace for a more accurate estimate.',
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
      { question: 'Can I import/export flashcards?', answer: 'Yes! You can export your flashcard decks as JSON files and import them later or share with classmates.' },
      { question: 'How does the study mode work?', answer: 'In study mode, cards are shown one at a time. Click to flip and reveal the answer. Mark cards as known or unknown to track your progress.' },
    ],
    content: 'Create digital flashcard decks for any subject. Add front and back content, then study with flip animations. Shuffle cards, track which ones you know, and import/export decks for sharing.',
  },
  'random-group-generator': {
    faqs: [
      { question: 'How are groups randomized?', answer: 'Names are shuffled using a random algorithm, then distributed evenly across the specified number of groups. If names don\'t divide evenly, some groups will have one extra member.' },
      { question: 'Can I re-randomize?', answer: 'Yes, click the generate button again to create new random groups from the same list of names.' },
    ],
    content: 'Quickly split a list of names into random groups. Perfect for class projects, study groups, or team assignments. Enter names, choose the number of groups, and generate instantly.',
  },
  'quiz-maker': {
    faqs: [
      { question: 'How do I create a quiz?', answer: 'Add questions with 2-4 multiple choice options and mark the correct answer. Save your quiz and take it anytime.' },
      { question: 'Are quizzes saved?', answer: 'Yes, all quizzes are saved in your browser\'s localStorage. They persist between visits on the same browser and device.' },
    ],
    content: 'Create custom multiple-choice quizzes to test your knowledge. Add questions, set correct answers, and take your quizzes with instant scoring. Great for exam preparation and self-testing.',
  },
  'cornell-notes': {
    faqs: [
      { question: 'What is the Cornell Note-Taking System?', answer: 'The Cornell system divides your page into three sections: a narrow left column for cues/questions, a wide right column for notes, and a bottom section for summary. It promotes active review and better retention.' },
      { question: 'Can I save multiple notes?', answer: 'Yes, you can save multiple note sets in your browser\'s localStorage. Each set has a title and can be loaded or deleted independently.' },
    ],
    content: 'Take organized notes using the proven Cornell method. Use the cue column for key questions, the notes column for detailed notes, and the summary section to synthesize your learning. Save, load, and export your notes.',
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
  'math-formula-reference': {
    faqs: [
      { question: 'What topics are covered?', answer: 'The reference covers algebra, geometry, trigonometry, calculus, and statistics formulas. Over 50 commonly used formulas are included.' },
      { question: 'Can I search for specific formulas?', answer: 'Yes, use the search bar to find formulas by name or topic. You can also browse by category.' },
    ],
    content: 'Browse and search over 50 essential math formulas organized by topic. From the quadratic formula to integration rules, find the formula you need quickly. Perfect for homework, exams, and quick reference.',
  },
}
