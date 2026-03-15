/**
 * USMLE Step 1 seed data — based on NBME content outline.
 * Organized by organ system with discipline cross-references.
 */
import type { ExamType } from '../schema'
import type { SeedSubject } from './barExam'

export const usmleStep1Seed: { examType: ExamType; subjects: SeedSubject[] } = {
  examType: 'usmle-step1',
  subjects: [
    {
      name: 'General Principles',
      weight: 15,
      color: '#6366f1',
      topics: [
        { name: 'Biochemistry', subtopics: ['Amino Acids', 'Enzyme Kinetics', 'Metabolic Pathways', 'Vitamins & Cofactors', 'DNA/RNA Structure'] },
        { name: 'Cell Biology', subtopics: ['Cell Cycle', 'Apoptosis', 'Signal Transduction', 'Cytoskeleton'] },
        { name: 'Genetics', subtopics: ['Mendelian Genetics', 'Population Genetics', 'Genetic Disorders', 'Epigenetics'] },
        { name: 'Immunology', subtopics: ['Innate Immunity', 'Adaptive Immunity', 'Hypersensitivity', 'Immunodeficiency', 'Transplant Rejection'] },
        { name: 'Microbiology', subtopics: ['Bacteriology', 'Virology', 'Mycology', 'Parasitology', 'Antimicrobials'] },
        { name: 'Pathology', subtopics: ['Inflammation', 'Neoplasia', 'Hemodynamic Disorders', 'Cell Injury & Death'] },
        { name: 'Pharmacology', subtopics: ['Pharmacokinetics', 'Pharmacodynamics', 'Drug Metabolism', 'Autonomic Drugs', 'Toxicology'] },
      ],
    },
    {
      name: 'Cardiovascular',
      weight: 10,
      color: '#ef4444',
      topics: [
        { name: 'Cardiac Anatomy & Physiology', subtopics: ['Heart Chambers', 'Coronary Circulation', 'Cardiac Cycle', 'Frank-Starling'] },
        { name: 'Cardiac Pathology', subtopics: ['MI', 'Heart Failure', 'Valvular Disease', 'Cardiomyopathies', 'Pericardial Disease'] },
        { name: 'Vascular Pathology', subtopics: ['Atherosclerosis', 'Aneurysms', 'Vasculitis', 'Hypertension'] },
        { name: 'CV Pharmacology', subtopics: ['Antihypertensives', 'Antiarrhythmics', 'Anticoagulants', 'Lipid-Lowering Agents'] },
      ],
    },
    {
      name: 'Respiratory',
      weight: 10,
      color: '#06b6d4',
      topics: [
        { name: 'Pulmonary Anatomy & Physiology', subtopics: ['Lung Volumes', 'Gas Exchange', 'V/Q Matching', 'Pulmonary Circulation'] },
        { name: 'Obstructive Diseases', subtopics: ['Asthma', 'COPD', 'Bronchiectasis'] },
        { name: 'Restrictive Diseases', subtopics: ['Idiopathic Pulmonary Fibrosis', 'Sarcoidosis', 'Pneumoconioses'] },
        { name: 'Pulmonary Infections', subtopics: ['Pneumonia', 'Tuberculosis', 'Lung Abscess'] },
        { name: 'Lung Cancer', subtopics: ['Small Cell', 'Non-Small Cell', 'Mesothelioma'] },
      ],
    },
    {
      name: 'Gastrointestinal',
      weight: 10,
      color: '#f59e0b',
      topics: [
        { name: 'GI Anatomy', subtopics: ['Esophagus', 'Stomach', 'Small Intestine', 'Large Intestine', 'Biliary System'] },
        { name: 'GI Pathology', subtopics: ['GERD', 'Peptic Ulcer Disease', 'IBD', 'Celiac Disease', 'Colorectal Cancer'] },
        { name: 'Hepatobiliary', subtopics: ['Hepatitis', 'Cirrhosis', 'Liver Tumors', 'Gallstones', 'Pancreatitis'] },
        { name: 'GI Pharmacology', subtopics: ['Antacids & PPIs', 'Antiemetics', 'Laxatives', 'Antidiarrheals'] },
      ],
    },
    {
      name: 'Renal',
      weight: 8,
      color: '#8b5cf6',
      topics: [
        { name: 'Renal Physiology', subtopics: ['Glomerular Filtration', 'Tubular Function', 'Acid-Base', 'Electrolytes'] },
        { name: 'Renal Pathology', subtopics: ['Glomerulonephritis', 'Nephrotic Syndrome', 'AKI', 'CKD', 'Renal Tumors'] },
        { name: 'Diuretics', subtopics: ['Loop Diuretics', 'Thiazides', 'K-Sparing', 'Osmotic Diuretics'] },
      ],
    },
    {
      name: 'Endocrine',
      weight: 8,
      color: '#ec4899',
      topics: [
        { name: 'Hypothalamic-Pituitary Axis', subtopics: ['Anterior Pituitary', 'Posterior Pituitary', 'Feedback Loops'] },
        { name: 'Thyroid', subtopics: ['Hyperthyroidism', 'Hypothyroidism', 'Thyroid Cancer', 'Thyroiditis'] },
        { name: 'Adrenal', subtopics: ['Cushing Syndrome', 'Addison Disease', 'Pheochromocytoma', 'Congenital Adrenal Hyperplasia'] },
        { name: 'Diabetes', subtopics: ['Type 1', 'Type 2', 'DKA', 'Insulin Therapy', 'Oral Hypoglycemics'] },
        { name: 'Calcium & Bone', subtopics: ['PTH', 'Vitamin D', 'Osteoporosis', 'Paget Disease'] },
      ],
    },
    {
      name: 'Neuroscience',
      weight: 12,
      color: '#10b981',
      topics: [
        { name: 'Neuroanatomy', subtopics: ['Cerebral Cortex', 'Basal Ganglia', 'Cerebellum', 'Brainstem', 'Spinal Cord', 'Cranial Nerves'] },
        { name: 'Neurophysiology', subtopics: ['Action Potential', 'Neurotransmitters', 'Synaptic Transmission'] },
        { name: 'Neuropathology', subtopics: ['Stroke', 'Seizures', 'Dementia', 'MS', 'Meningitis', 'Brain Tumors'] },
        { name: 'Neuropharmacology', subtopics: ['Antiepileptics', 'Antidepressants', 'Antipsychotics', 'Anxiolytics', 'Anesthetics'] },
        { name: 'Psychiatry', subtopics: ['Mood Disorders', 'Anxiety Disorders', 'Psychotic Disorders', 'Personality Disorders', 'Substance Abuse'] },
      ],
    },
    {
      name: 'Musculoskeletal',
      weight: 7,
      color: '#78716c',
      topics: [
        { name: 'MSK Anatomy', subtopics: ['Upper Extremity', 'Lower Extremity', 'Spine', 'Joints'] },
        { name: 'Bone & Joint Pathology', subtopics: ['Fractures', 'Osteoarthritis', 'Rheumatoid Arthritis', 'Gout', 'Bone Tumors'] },
        { name: 'Connective Tissue', subtopics: ['SLE', 'Scleroderma', 'Dermatomyositis', 'Vasculitis'] },
      ],
    },
    {
      name: 'Reproductive',
      weight: 8,
      color: '#f43f5e',
      topics: [
        { name: 'Male Reproductive', subtopics: ['Testicular Pathology', 'Prostate', 'Erectile Dysfunction'] },
        { name: 'Female Reproductive', subtopics: ['Ovarian Pathology', 'Uterine Pathology', 'Cervical Cancer', 'Breast Pathology'] },
        { name: 'Pregnancy', subtopics: ['Normal Pregnancy', 'Complications', 'Teratogens', 'Labor & Delivery'] },
        { name: 'Reproductive Pharmacology', subtopics: ['Contraceptives', 'Fertility Drugs', 'Tocolytics'] },
      ],
    },
    {
      name: 'Hematology & Oncology',
      weight: 7,
      color: '#dc2626',
      topics: [
        { name: 'Red Blood Cell Disorders', subtopics: ['Iron Deficiency', 'Sickle Cell', 'Thalassemia', 'Hemolytic Anemias', 'Aplastic Anemia'] },
        { name: 'White Blood Cell Disorders', subtopics: ['Leukemias', 'Lymphomas', 'Myeloma', 'Myeloproliferative'] },
        { name: 'Coagulation', subtopics: ['Platelet Disorders', 'Clotting Cascade', 'DIC', 'Hypercoagulable States'] },
        { name: 'Transfusion Medicine', subtopics: ['Blood Typing', 'Transfusion Reactions'] },
      ],
    },
    {
      name: 'Behavioral & Social Sciences',
      weight: 5,
      color: '#a855f7',
      topics: [
        { name: 'Biostatistics', subtopics: ['Study Design', 'Sensitivity & Specificity', 'Statistical Tests', 'Bias & Confounding'] },
        { name: 'Ethics', subtopics: ['Informed Consent', 'Autonomy', 'Beneficence', 'Confidentiality', 'End of Life'] },
        { name: 'Epidemiology', subtopics: ['Incidence & Prevalence', 'Screening', 'Disease Prevention'] },
      ],
    },
  ],
}
