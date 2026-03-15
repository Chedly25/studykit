/**
 * CFA Level I seed data — based on CFA Institute curriculum weights.
 */
import type { ExamType } from '../schema'
import type { SeedSubject } from './barExam'

export const cfaLevel1Seed: { examType: ExamType; subjects: SeedSubject[] } = {
  examType: 'cfa-level1',
  subjects: [
    {
      name: 'Ethical & Professional Standards',
      weight: 15,
      color: '#6366f1',
      topics: [
        { name: 'Code of Ethics', subtopics: ['Professionalism', 'Integrity of Capital Markets'] },
        { name: 'Standards of Professional Conduct', subtopics: ['Duties to Clients', 'Duties to Employers', 'Investment Analysis'] },
        { name: 'GIPS', subtopics: ['GIPS Overview', 'Compliance Requirements'] },
      ],
    },
    {
      name: 'Quantitative Methods',
      weight: 10,
      color: '#3b82f6',
      topics: [
        { name: 'Time Value of Money', subtopics: ['PV', 'FV', 'Annuities', 'Perpetuities'] },
        { name: 'Probability & Statistics', subtopics: ['Probability Distributions', 'Sampling', 'Hypothesis Testing'] },
        { name: 'Regression Analysis', subtopics: ['Simple Linear Regression', 'Multiple Regression'] },
      ],
    },
    {
      name: 'Economics',
      weight: 10,
      color: '#10b981',
      topics: [
        { name: 'Microeconomics', subtopics: ['Supply & Demand', 'Elasticity', 'Market Structures', 'Consumer Theory'] },
        { name: 'Macroeconomics', subtopics: ['GDP', 'Business Cycles', 'Fiscal Policy', 'Monetary Policy'] },
        { name: 'International Trade', subtopics: ['Trade Agreements', 'Exchange Rates', 'Balance of Payments'] },
      ],
    },
    {
      name: 'Financial Statement Analysis',
      weight: 15,
      color: '#f59e0b',
      topics: [
        { name: 'Income Statement', subtopics: ['Revenue Recognition', 'Expense Recognition', 'Non-Recurring Items'] },
        { name: 'Balance Sheet', subtopics: ['Assets', 'Liabilities', 'Equity', 'Off-Balance-Sheet Items'] },
        { name: 'Cash Flow Statement', subtopics: ['Operating', 'Investing', 'Financing', 'Free Cash Flow'] },
        { name: 'Financial Analysis', subtopics: ['Ratio Analysis', 'DuPont Analysis', 'Quality of Earnings'] },
        { name: 'Inventories & Long-Lived Assets', subtopics: ['FIFO/LIFO', 'Depreciation Methods', 'Impairment'] },
      ],
    },
    {
      name: 'Corporate Issuers',
      weight: 10,
      color: '#8b5cf6',
      topics: [
        { name: 'Corporate Governance', subtopics: ['Board Structure', 'Shareholder Rights', 'ESG'] },
        { name: 'Capital Budgeting', subtopics: ['NPV', 'IRR', 'Payback Period'] },
        { name: 'Capital Structure', subtopics: ['WACC', 'Modigliani-Miller', 'Leverage'] },
        { name: 'Dividends & Buybacks', subtopics: ['Dividend Policy', 'Share Repurchases'] },
      ],
    },
    {
      name: 'Equity Investments',
      weight: 11,
      color: '#ec4899',
      topics: [
        { name: 'Market Organization', subtopics: ['Market Types', 'Market Indices', 'Market Efficiency'] },
        { name: 'Equity Valuation', subtopics: ['DDM', 'Free Cash Flow Models', 'Price Multiples', 'Enterprise Value'] },
        { name: 'Industry & Company Analysis', subtopics: ['Porter\'s Five Forces', 'Industry Life Cycle'] },
      ],
    },
    {
      name: 'Fixed Income',
      weight: 11,
      color: '#06b6d4',
      topics: [
        { name: 'Bond Basics', subtopics: ['Bond Features', 'Bond Pricing', 'Yield Measures'] },
        { name: 'Interest Rate Risk', subtopics: ['Duration', 'Convexity', 'Term Structure'] },
        { name: 'Credit Risk', subtopics: ['Credit Analysis', 'Credit Ratings', 'Credit Spreads'] },
        { name: 'Asset-Backed Securities', subtopics: ['MBS', 'ABS', 'CDO'] },
      ],
    },
    {
      name: 'Derivatives',
      weight: 6,
      color: '#ef4444',
      topics: [
        { name: 'Derivative Markets', subtopics: ['Forwards', 'Futures', 'Options', 'Swaps'] },
        { name: 'Option Valuation', subtopics: ['Put-Call Parity', 'Binomial Model', 'Black-Scholes'] },
        { name: 'Risk Management', subtopics: ['Hedging Strategies', 'Option Greeks'] },
      ],
    },
    {
      name: 'Alternative Investments',
      weight: 6,
      color: '#78716c',
      topics: [
        { name: 'Real Estate', subtopics: ['Direct Investment', 'REITs', 'Valuation'] },
        { name: 'Private Equity', subtopics: ['VC', 'Buyouts', 'Valuation Methods'] },
        { name: 'Hedge Funds', subtopics: ['Strategies', 'Fee Structures', 'Risk'] },
        { name: 'Commodities', subtopics: ['Commodity Markets', 'Futures Pricing'] },
      ],
    },
    {
      name: 'Portfolio Management',
      weight: 6,
      color: '#a855f7',
      topics: [
        { name: 'Portfolio Theory', subtopics: ['Risk & Return', 'Efficient Frontier', 'CAPM', 'APT'] },
        { name: 'Investment Policy', subtopics: ['IPS', 'Asset Allocation', 'Rebalancing'] },
        { name: 'Performance Evaluation', subtopics: ['Benchmarks', 'Attribution Analysis', 'Sharpe Ratio'] },
      ],
    },
  ],
}
