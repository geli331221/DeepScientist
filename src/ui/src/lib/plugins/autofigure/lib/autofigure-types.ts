/**
 * AutoFigure Type Definitions
 *
 * Types for the AutoFigure plugin - AI-powered scientific figure generation.
 *
 * @module lib/plugins/autofigure/lib/autofigure-types
 */

// ============================================================
// Basic Types
// ============================================================

export type ContentType = "paper" | "survey" | "textbook" | "poster";
export type LLMProvider = "openrouter" | "gemini";
export type EnhancementMode = "none" | "code2prompt";
export type SessionStatus =
  | "created"
  | "idle"
  | "generating"
  | "iteration_complete"
  | "waiting_feedback"
  | "improving"
  | "finalized"
  | "enhancing"
  | "completed"
  | "failed"
  | "max_iterations_reached"
  | "error";

// ============================================================
// Configuration
// ============================================================

export interface AutoFigureConfig {
  // Content Configuration
  contentType: ContentType;
  inputText: string;
  inputType?: "text" | "pdf";
  sourceFileName?: string;
  sessionName?: string;

  // Iteration Parameters
  maxIterations: number;
  qualityThreshold: number;
  minImprovement: number;
  humanInLoop: boolean;

  // LLM Configuration (for layout generation)
  llmProvider: LLMProvider;
  apiKey: string;
  baseUrl?: string;
  model: string;
  iterationModel?: string;  // Model for iteration phase (optional, defaults to model)

  // Output Configuration
  svgWidth: number;
  svgHeight: number;

  // Methodology Extraction Configuration (for paper content type)
  enableMethodologyExtraction: boolean;
  methodologyLlmProvider: LLMProvider;
  methodologyLlmApiKey: string;
  methodologyLlmBaseUrl?: string;
  methodologyLlmModel: string;

  // Beautification (shown after layout finalization)
  enhancementMode: EnhancementMode;
  artStyle: string;
  enhancementCount: number;

  // Enhancement LLM Configuration (for code2prompt conversion)
  enhancementLlmProvider: LLMProvider;
  enhancementLlmApiKey: string;
  enhancementLlmBaseUrl?: string;
  enhancementLlmModel: string;

  // Image Generation API Configuration
  imageGenProvider: LLMProvider;
  imageGenApiKey: string;
  imageGenBaseUrl?: string;
  imageGenModel: string;

  // PPTX Export Configuration
  pptxExportEnabled: boolean;
  pptxExportMode: "per_iteration" | "cumulative";
  pptxIncludeMetadata: boolean;
}

// ============================================================
// Evaluation & Results
// ============================================================

export interface EvaluationScores {
  aesthetic_design: number;
  content_fidelity: number;
  placeholder_usage: number;
}

export interface EvaluationResult {
  scores: EvaluationScores;
  overall_quality: number;
  critique_summary: string;
  specific_issues: string[];
  improvement_suggestions: string[];
}

export interface IterationResult {
  iteration: number;
  xml: string;
  pngBase64?: string;
  evaluation?: EvaluationResult;
  humanFeedback?: string;
  humanScore?: number;
  timestamp: string;
}

// ============================================================
// Session
// ============================================================

export interface AutoFigureSession {
  sessionId: string;
  status: SessionStatus;
  config: AutoFigureConfig;
  currentIteration: number;
  iterations: IterationResult[];
  finalXml?: string;
  finalPngBase64?: string;
  enhancedImages?: EnhancedImage[];
  error?: string;
}

export interface EnhancedImage {
  variant: number;
  pngBase64: string | null;
  status: "pending" | "processing" | "completed" | "failed";
  error?: string;
}

// ============================================================
// API Request/Response Types
// ============================================================

export interface StartGenerationResponse {
  sessionId: string;
  iteration: number;
  xml: string;
  pngBase64: string;
  status: SessionStatus;
}

export interface ContinueIterationRequest {
  currentXml: string;
  humanFeedback?: string;
  humanScore?: number;
}

export interface ContinueIterationResponse {
  iteration: number;
  xml: string;
  pngBase64: string;
  evaluation: EvaluationResult;
  status: SessionStatus;
}

export interface EnhanceRequest {
  mode: EnhancementMode;
  artStyle: string;
  variantCount: number;
  enhancementLlmProvider: LLMProvider;
  enhancementLlmApiKey: string;
  enhancementLlmModel: string;
  imageGenProvider: LLMProvider;
  imageGenApiKey: string;
  imageGenModel: string;
}

export interface EnhanceStatusResponse {
  status: "processing" | "completed" | "failed";
  progress: number;
  completedVariants: number;
  totalVariants: number;
  images: EnhancedImage[];
}

// ============================================================
// Default Configuration
// ============================================================

export const DEFAULT_CONFIG: AutoFigureConfig = {
  contentType: "paper",
  inputText: "",
  inputType: "text",
  sourceFileName: "",
  sessionName: "",
  maxIterations: 5,
  qualityThreshold: 9.0,
  minImprovement: 0.2,
  humanInLoop: true,
  llmProvider: "gemini",
  apiKey: "",
  baseUrl: "",
  model: "gemini-3-pro-preview",
  iterationModel: "",  // Empty means use same model as initial
  svgWidth: 1333,
  svgHeight: 750,
  enableMethodologyExtraction: true,
  methodologyLlmProvider: "gemini",
  methodologyLlmApiKey: "",
  methodologyLlmBaseUrl: "",
  methodologyLlmModel: "gemini-3.0-flash-preview",
  enhancementMode: "code2prompt",
  artStyle: "Morandi soft lab style, muted earthy palette, clean scientific illustration, soft gradients, minimal linework",
  enhancementCount: 1,
  enhancementLlmProvider: "gemini",
  enhancementLlmApiKey: "",
  enhancementLlmBaseUrl: "",
  enhancementLlmModel: "gemini-3-pro-preview",
  imageGenProvider: "gemini",
  imageGenApiKey: "",
  imageGenBaseUrl: "",
  imageGenModel: "gemini-3-pro-image-preview",
  pptxExportEnabled: false,
  pptxExportMode: "per_iteration",
  pptxIncludeMetadata: false,
};

// ============================================================
// LLM Provider Configurations
// ============================================================

export const LLM_PROVIDER_CONFIGS: Record<
  LLMProvider,
  { name: string; defaultBaseUrl: string; description: string }
> = {
  openrouter: {
    name: "OpenRouter",
    defaultBaseUrl: "https://openrouter.ai/api/v1",
    description: "OpenRouter API - Access multiple AI models",
  },
  gemini: {
    name: "Google Gemini",
    defaultBaseUrl: "https://generativelanguage.googleapis.com/v1beta",
    description: "Google Gemini API - Direct access to Gemini models",
  },
};

// Backward-compatible alias for older imports.
export const LLM_PROVIDERS = LLM_PROVIDER_CONFIGS;
