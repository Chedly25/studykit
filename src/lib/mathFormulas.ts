export type FormulaCategory = 'algebra' | 'geometry' | 'trigonometry' | 'calculus' | 'statistics'

export interface Formula {
  name: string
  formula: string
  category: FormulaCategory
  description: string
}

export const formulaCategories: { id: FormulaCategory; label: string }[] = [
  { id: 'algebra', label: 'Algebra' },
  { id: 'geometry', label: 'Geometry' },
  { id: 'trigonometry', label: 'Trigonometry' },
  { id: 'calculus', label: 'Calculus' },
  { id: 'statistics', label: 'Statistics' },
]

export const categoryBadgeColors: Record<FormulaCategory, string> = {
  algebra: 'bg-blue-500/20 text-blue-400',
  geometry: 'bg-green-500/20 text-green-400',
  trigonometry: 'bg-purple-500/20 text-purple-400',
  calculus: 'bg-orange-500/20 text-orange-400',
  statistics: 'bg-pink-500/20 text-pink-400',
}

export const formulas: Formula[] = [
  // Algebra
  {
    name: 'Quadratic Formula',
    formula: 'x = (-b \u00b1 \u221a(b\u00b2 - 4ac)) / 2a',
    category: 'algebra',
    description: 'Solves ax\u00b2 + bx + c = 0 for x',
  },
  {
    name: 'Distance Formula',
    formula: 'd = \u221a((x\u2082 - x\u2081)\u00b2 + (y\u2082 - y\u2081)\u00b2)',
    category: 'algebra',
    description: 'Distance between two points in a plane',
  },
  {
    name: 'Slope Formula',
    formula: 'm = (y\u2082 - y\u2081) / (x\u2082 - x\u2081)',
    category: 'algebra',
    description: 'Slope of a line through two points',
  },
  {
    name: 'Midpoint Formula',
    formula: 'M = ((x\u2081 + x\u2082)/2, (y\u2081 + y\u2082)/2)',
    category: 'algebra',
    description: 'Midpoint between two points',
  },
  {
    name: 'Slope-Intercept Form',
    formula: 'y = mx + b',
    category: 'algebra',
    description: 'Equation of a line with slope m and y-intercept b',
  },
  {
    name: 'Point-Slope Form',
    formula: 'y - y\u2081 = m(x - x\u2081)',
    category: 'algebra',
    description: 'Line through point (x\u2081, y\u2081) with slope m',
  },
  {
    name: 'Product Rule (Exponents)',
    formula: 'a\u207c \u00b7 a\u207f = a\u207c\u207a\u207f',
    category: 'algebra',
    description: 'Multiplying powers with the same base',
  },
  {
    name: 'Power Rule (Exponents)',
    formula: '(a\u207c)\u207f = a\u207c\u207f',
    category: 'algebra',
    description: 'Raising a power to a power',
  },
  {
    name: 'Logarithm Product Rule',
    formula: 'log(ab) = log(a) + log(b)',
    category: 'algebra',
    description: 'Log of a product equals sum of logs',
  },
  {
    name: 'Logarithm Quotient Rule',
    formula: 'log(a/b) = log(a) - log(b)',
    category: 'algebra',
    description: 'Log of a quotient equals difference of logs',
  },
  {
    name: 'Logarithm Power Rule',
    formula: 'log(a\u207f) = n \u00b7 log(a)',
    category: 'algebra',
    description: 'Log of a power equals exponent times the log',
  },
  {
    name: 'Change of Base',
    formula: 'log\u2090(b) = log(b) / log(a)',
    category: 'algebra',
    description: 'Convert logarithm to a different base',
  },
  {
    name: 'Difference of Squares',
    formula: 'a\u00b2 - b\u00b2 = (a + b)(a - b)',
    category: 'algebra',
    description: 'Factoring a difference of two squares',
  },
  {
    name: 'Binomial Expansion (Square)',
    formula: '(a + b)\u00b2 = a\u00b2 + 2ab + b\u00b2',
    category: 'algebra',
    description: 'Expanding the square of a binomial',
  },

  // Geometry
  {
    name: 'Area of Circle',
    formula: 'A = \u03c0r\u00b2',
    category: 'geometry',
    description: 'Area of a circle with radius r',
  },
  {
    name: 'Circumference of Circle',
    formula: 'C = 2\u03c0r',
    category: 'geometry',
    description: 'Circumference of a circle with radius r',
  },
  {
    name: 'Area of Triangle',
    formula: 'A = \u00bdbh',
    category: 'geometry',
    description: 'Area of a triangle with base b and height h',
  },
  {
    name: 'Area of Rectangle',
    formula: 'A = lw',
    category: 'geometry',
    description: 'Area of a rectangle with length l and width w',
  },
  {
    name: 'Perimeter of Rectangle',
    formula: 'P = 2l + 2w',
    category: 'geometry',
    description: 'Perimeter of a rectangle',
  },
  {
    name: 'Area of Trapezoid',
    formula: 'A = \u00bd(a + b)h',
    category: 'geometry',
    description: 'Area of a trapezoid with parallel sides a, b and height h',
  },
  {
    name: 'Pythagorean Theorem',
    formula: 'a\u00b2 + b\u00b2 = c\u00b2',
    category: 'geometry',
    description: 'Relates sides of a right triangle',
  },
  {
    name: 'Volume of Sphere',
    formula: 'V = (4/3)\u03c0r\u00b3',
    category: 'geometry',
    description: 'Volume of a sphere with radius r',
  },
  {
    name: 'Surface Area of Sphere',
    formula: 'A = 4\u03c0r\u00b2',
    category: 'geometry',
    description: 'Surface area of a sphere with radius r',
  },
  {
    name: 'Volume of Cylinder',
    formula: 'V = \u03c0r\u00b2h',
    category: 'geometry',
    description: 'Volume of a cylinder with radius r and height h',
  },
  {
    name: 'Volume of Cone',
    formula: 'V = (1/3)\u03c0r\u00b2h',
    category: 'geometry',
    description: 'Volume of a cone with radius r and height h',
  },
  {
    name: 'Volume of Rectangular Prism',
    formula: 'V = lwh',
    category: 'geometry',
    description: 'Volume of a box with length, width, and height',
  },
  {
    name: "Heron's Formula",
    formula: 'A = \u221a(s(s-a)(s-b)(s-c)), s = (a+b+c)/2',
    category: 'geometry',
    description: 'Area of a triangle from its three sides',
  },

  // Trigonometry
  {
    name: 'Sine Definition',
    formula: 'sin(\u03b8) = opposite / hypotenuse',
    category: 'trigonometry',
    description: 'Sine of an angle in a right triangle',
  },
  {
    name: 'Cosine Definition',
    formula: 'cos(\u03b8) = adjacent / hypotenuse',
    category: 'trigonometry',
    description: 'Cosine of an angle in a right triangle',
  },
  {
    name: 'Tangent Definition',
    formula: 'tan(\u03b8) = opposite / adjacent',
    category: 'trigonometry',
    description: 'Tangent of an angle in a right triangle',
  },
  {
    name: 'Pythagorean Identity',
    formula: 'sin\u00b2(\u03b8) + cos\u00b2(\u03b8) = 1',
    category: 'trigonometry',
    description: 'Fundamental trigonometric identity',
  },
  {
    name: 'Law of Sines',
    formula: 'a/sin(A) = b/sin(B) = c/sin(C)',
    category: 'trigonometry',
    description: 'Relates sides and angles in any triangle',
  },
  {
    name: 'Law of Cosines',
    formula: 'c\u00b2 = a\u00b2 + b\u00b2 - 2ab\u00b7cos(C)',
    category: 'trigonometry',
    description: 'Generalized Pythagorean theorem for any triangle',
  },
  {
    name: 'Double Angle (Sine)',
    formula: 'sin(2\u03b8) = 2\u00b7sin(\u03b8)\u00b7cos(\u03b8)',
    category: 'trigonometry',
    description: 'Sine of double an angle',
  },
  {
    name: 'Double Angle (Cosine)',
    formula: 'cos(2\u03b8) = cos\u00b2(\u03b8) - sin\u00b2(\u03b8)',
    category: 'trigonometry',
    description: 'Cosine of double an angle',
  },
  {
    name: 'Tangent Identity',
    formula: 'tan(\u03b8) = sin(\u03b8) / cos(\u03b8)',
    category: 'trigonometry',
    description: 'Tangent expressed as sine over cosine',
  },
  {
    name: 'Area of Triangle (Trig)',
    formula: 'A = \u00bd\u00b7a\u00b7b\u00b7sin(C)',
    category: 'trigonometry',
    description: 'Area using two sides and the included angle',
  },

  // Calculus
  {
    name: 'Power Rule (Derivative)',
    formula: 'd/dx [x\u207f] = nx\u207f\u207b\u00b9',
    category: 'calculus',
    description: 'Derivative of x raised to a power',
  },
  {
    name: 'Product Rule',
    formula: 'd/dx [f\u00b7g] = f\u2032g + fg\u2032',
    category: 'calculus',
    description: 'Derivative of a product of two functions',
  },
  {
    name: 'Quotient Rule',
    formula: 'd/dx [f/g] = (f\u2032g - fg\u2032) / g\u00b2',
    category: 'calculus',
    description: 'Derivative of a quotient of two functions',
  },
  {
    name: 'Chain Rule',
    formula: 'd/dx [f(g(x))] = f\u2032(g(x)) \u00b7 g\u2032(x)',
    category: 'calculus',
    description: 'Derivative of a composite function',
  },
  {
    name: 'Derivative of sin(x)',
    formula: 'd/dx [sin(x)] = cos(x)',
    category: 'calculus',
    description: 'Derivative of the sine function',
  },
  {
    name: 'Derivative of cos(x)',
    formula: 'd/dx [cos(x)] = -sin(x)',
    category: 'calculus',
    description: 'Derivative of the cosine function',
  },
  {
    name: 'Derivative of e\u02e3',
    formula: 'd/dx [e\u02e3] = e\u02e3',
    category: 'calculus',
    description: 'Derivative of the natural exponential function',
  },
  {
    name: 'Derivative of ln(x)',
    formula: 'd/dx [ln(x)] = 1/x',
    category: 'calculus',
    description: 'Derivative of the natural logarithm',
  },
  {
    name: 'Power Rule (Integral)',
    formula: '\u222b x\u207f dx = x\u207f\u207a\u00b9/(n+1) + C',
    category: 'calculus',
    description: 'Integral of x raised to a power (n \u2260 -1)',
  },
  {
    name: 'Fundamental Theorem of Calculus',
    formula: '\u222b\u2090\u1d47 f(x)dx = F(b) - F(a)',
    category: 'calculus',
    description: 'Definite integral via antiderivative',
  },
  {
    name: 'Integral of 1/x',
    formula: '\u222b (1/x) dx = ln|x| + C',
    category: 'calculus',
    description: 'Integral of the reciprocal function',
  },
  {
    name: 'Integral of e\u02e3',
    formula: '\u222b e\u02e3 dx = e\u02e3 + C',
    category: 'calculus',
    description: 'Integral of the natural exponential function',
  },

  // Statistics
  {
    name: 'Mean (Average)',
    formula: '\u03bc = \u03a3x\u1d62 / n',
    category: 'statistics',
    description: 'Sum of all values divided by count',
  },
  {
    name: 'Standard Deviation',
    formula: '\u03c3 = \u221a(\u03a3(x\u1d62 - \u03bc)\u00b2 / n)',
    category: 'statistics',
    description: 'Measure of spread around the mean (population)',
  },
  {
    name: 'Variance',
    formula: '\u03c3\u00b2 = \u03a3(x\u1d62 - \u03bc)\u00b2 / n',
    category: 'statistics',
    description: 'Average of squared deviations from the mean',
  },
  {
    name: 'Z-Score',
    formula: 'z = (x - \u03bc) / \u03c3',
    category: 'statistics',
    description: 'Number of standard deviations from the mean',
  },
  {
    name: 'Permutations',
    formula: 'P(n, r) = n! / (n - r)!',
    category: 'statistics',
    description: 'Ordered arrangements of r items from n',
  },
  {
    name: 'Combinations',
    formula: 'C(n, r) = n! / (r!(n - r)!)',
    category: 'statistics',
    description: 'Unordered selections of r items from n',
  },
  {
    name: 'Probability (Basic)',
    formula: 'P(A) = favorable outcomes / total outcomes',
    category: 'statistics',
    description: 'Basic probability of an event',
  },
  {
    name: 'Bayes\u2019 Theorem',
    formula: 'P(A|B) = P(B|A)\u00b7P(A) / P(B)',
    category: 'statistics',
    description: 'Conditional probability relationship',
  },
  {
    name: 'Sample Standard Deviation',
    formula: 's = \u221a(\u03a3(x\u1d62 - x\u0304)\u00b2 / (n - 1))',
    category: 'statistics',
    description: 'Standard deviation for a sample (Bessel correction)',
  },
  {
    name: 'Correlation Coefficient',
    formula: 'r = \u03a3((x\u1d62-x\u0304)(y\u1d62-\u0233)) / \u221a(\u03a3(x\u1d62-x\u0304)\u00b2\u00b7\u03a3(y\u1d62-\u0233)\u00b2)',
    category: 'statistics',
    description: 'Measure of linear relationship between two variables',
  },
]
