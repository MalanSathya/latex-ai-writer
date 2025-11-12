import { z } from 'zod';

// Job Description Form Validation
export const jobDescriptionSchema = z.object({
  title: z.string()
    .trim()
    .min(1, 'Job title is required')
    .max(200, 'Job title must be less than 200 characters'),
  company: z.string()
    .trim()
    .max(200, 'Company name must be less than 200 characters')
    .optional(),
  description: z.string()
    .trim()
    .min(1, 'Job description is required')
    .max(50000, 'Job description must be less than 50,000 characters'),
});

// Resume/Cover Letter Upload Validation
export const latexContentSchema = z.object({
  content: z.string()
    .trim()
    .min(1, 'Content is required')
    .max(100000, 'Content must be less than 100,000 characters')
    .refine(
      (val) => val.includes('\\documentclass') || val.includes('\\begin{document}'),
      'Content must be valid LaTeX with \\documentclass or \\begin{document}'
    ),
});

// Settings Form Validation
export const settingsSchema = z.object({
  aiPrompt: z.string()
    .trim()
    .min(1, 'AI prompt is required')
    .max(10000, 'AI prompt must be less than 10,000 characters'),
  latexApiKey: z.string()
    .trim()
    .max(500, 'API key must be less than 500 characters')
    .optional(),
  mistralApiKey: z.string()
    .trim()
    .max(500, 'API key must be less than 500 characters')
    .optional(),
  dailyTarget: z.number()
    .int()
    .min(1, 'Daily target must be at least 1')
    .max(50, 'Daily target must be 50 or less'),
});

// Auth Form Validation
export const signUpSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(6, 'Password must be at least 6 characters')
    .max(100, 'Password must be less than 100 characters'),
  fullName: z.string()
    .trim()
    .min(1, 'Full name is required')
    .max(200, 'Full name must be less than 200 characters'),
});

export const signInSchema = z.object({
  email: z.string()
    .trim()
    .email('Invalid email address')
    .max(255, 'Email must be less than 255 characters'),
  password: z.string()
    .min(1, 'Password is required')
    .max(100, 'Password must be less than 100 characters'),
});
