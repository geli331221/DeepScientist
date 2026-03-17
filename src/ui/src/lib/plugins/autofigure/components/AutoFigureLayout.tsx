"use client"

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { apiClient } from "@/lib/api/client"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { ScrollArea } from "@/components/ui/scroll-area"
import { SegmentedControl } from "@/components/ui/segmented-control"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Stepper, Step } from "@/components/react-bits"
import { HelpCircle, FileText, Image as ImageIcon, UploadCloud, Download, X } from "lucide-react"
import { useAutoFigure } from "../contexts/autofigure-context"
import AutoFigureCanvas, { type AutoFigureCanvasExportBridge } from "./AutoFigureCanvas"
import AutoFigureWaitingHero from "./AutoFigureWaitingHero"
import { useAutoFigureSettings } from "@/lib/stores/autofigure-settings"
import { useAutoFigureSessionsStore } from "@/lib/stores/autofigure-sessions"
import { useAuthStore } from "@/lib/stores/auth"
import { useFileTreeStore } from "@/lib/stores/file-tree"
import { downloadFileById } from "@/lib/api/files"
import { extractPdfText, isTextFile } from "../lib/pdf-extraction"
import { getCurrentProjectId, savePdfToAutoFigure, saveTextToAutoFigure } from "../lib/file-operations"
import type { AutoFigureConfig, ContentType, LLMProvider, SessionStatus } from "../lib/autofigure-types"
import { DEFAULT_CONFIG } from "../lib/autofigure-types"
import type { EnhancedImage } from "../lib/autofigure-types"

type WorkspaceView = "stepper" | "waiting" | "canvas" | "rendered"
type WaitingPhase = "generate" | "iterate" | "render"
type OutputType = "figure" | "poster"

const FIGURE_CONTENT_TYPES: Array<{ value: ContentType; label: string }> = [
  { value: "paper", label: "Paper" },
  { value: "survey", label: "Survey" },
  { value: "textbook", label: "Textbook" },
]

const DEFAULT_STYLE_PROMPTS: Record<string, string> = {
  // Academic types (Paper/Survey)
  paper: "professional and delicate academic journal style with cute characters",
  survey: "professional and delicate academic journal style with cute characters",
  // Casual types (Textbook)
  textbook: "Delicate and cute cartoon comic style (using Morandi color palette)",
  // Poster type
  poster: "a visually engaging and interesting poster style with cute characters",
}

const DEFAULT_MODELS = {
  layout: "gemini-3-pro-preview",
  iteration: "",  // Empty means use layout model
  methodology: "gemini-3.0-flash-preview",
  render: "gemini-3-pro-preview",
  image: "gemini-3-pro-image-preview",
}

type ExportModalStage = "preview" | "rating"

type ExportRatingGroup = {
  readable: number | null
  practical: number | null
  faithful?: number | null
  editable?: number | null
}

type ExportRatingsState = {
  rendered: ExportRatingGroup
  sketch: ExportRatingGroup
}

const DEFAULT_EXPORT_RATINGS: ExportRatingsState = {
  rendered: {
    readable: null,
    faithful: null,
    practical: null,
  },
  sketch: {
    readable: null,
    editable: null,
    practical: null,
  },
}

const EXPORT_METRIC_HINTS: Record<string, string> = {
  rendered_readable:
    '5 = hierarchy instantly clear; 4 = mostly clear with minor friction; 3 = understandable but busy; 2 = hard to scan; 1 = confusing.',
  rendered_faithful:
    '5 = visual result precisely matches source structure; 4 = mostly aligned; 3 = some semantic drift; 2 = key mismatch; 1 = misleading.',
  rendered_practical:
    '5 = ready for direct publication/slides; 4 = tiny edits needed; 3 = moderate edits; 2 = large edits; 1 = not usable.',
  sketch_readable:
    '5 = nodes and flow are immediately clear; 4 = clear with minor clutter; 3 = acceptable; 2 = ambiguous; 1 = unreadable.',
  sketch_editable:
    '5 = easy to edit/rearrange in draw.io; 4 = mostly editable; 3 = some friction; 2 = cumbersome; 1 = effectively locked.',
  sketch_practical:
    '5 = strong foundation for next iteration; 4 = useful with small tweaks; 3 = partly useful; 2 = weak utility; 1 = not practical.',
}

export default function AutoFigureLayout() {
  const {
    session,
    hydrateSession,
    resetSession,
    isGenerating,
    enhancementProgress,
    enhancedImages,
    error,
    setError,
    updateConfig,
    startGeneration,
  } = useAutoFigure()
  const settings = useAutoFigureSettings()
  const sessions = useAutoFigureSessionsStore((state) => state.sessions)
  const activeSessionId = useAutoFigureSessionsStore((state) => state.activeSessionId)
  const ownerUserId = useAutoFigureSessionsStore((state) => state.ownerUserId)
  const fetchSessions = useAutoFigureSessionsStore((state) => state.fetchSessions)
  const setActiveSessionId = useAutoFigureSessionsStore((state) => state.setActiveSessionId)
  const setOwnerUserId = useAutoFigureSessionsStore((state) => state.setOwnerUserId)
  const upsertSession = useAutoFigureSessionsStore((state) => state.upsertSession)
  const removeSession = useAutoFigureSessionsStore((state) => state.removeSession)
  const resetSessions = useAutoFigureSessionsStore((state) => state.resetSessions)
  const projectId = useFileTreeStore((state) => state.projectId)
  const findNodeByPath = useFileTreeStore((state) => state.findNodeByPath)
  const refreshFileTree = useFileTreeStore((state) => state.refresh)
  const currentUserId = useAuthStore((state) => state.user?.id ?? null)
  const canUseSessions = Boolean(currentUserId) && ownerUserId === currentUserId
  const visibleSessions = canUseSessions ? sessions : []

  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("stepper")
  const [renderedImage, setRenderedImage] = useState<EnhancedImage | null>(null)
  const [generationProgress, setGenerationProgress] = useState(0)
  const [waitingPhase, setWaitingPhase] = useState<WaitingPhase>("generate")
  const [inputText, setInputText] = useState("")
  const [inputType, setInputType] = useState<"text" | "pdf">("text")
  const [sourceFileName, setSourceFileName] = useState<string | null>(null)
  const [outputType, setOutputType] = useState<OutputType>("figure")
  const [contentType, setContentType] = useState<ContentType>("paper")
  const [styleMode, setStyleMode] = useState<"default" | "custom">("default")
  const [customStylePrompt, setCustomStylePrompt] = useState("")
  const [isPdfProcessing, setIsPdfProcessing] = useState(false)
  const [showModelEditor, setShowModelEditor] = useState(false)
  const [sessionMenu, setSessionMenu] = useState<SessionMenuState | null>(null)
  const [apiProvider, setApiProvider] = useState<LLMProvider>(settings.layoutGenProvider)
  const [apiKey, setApiKey] = useState(settings.layoutGenApiKey)
  const [openRouterBaseUrl, setOpenRouterBaseUrl] = useState(settings.layoutGenBaseUrl || "https://openrouter.ai/api/v1")
  const [layoutModel, setLayoutModel] = useState(settings.layoutGenModel || DEFAULT_MODELS.layout)
  const [iterationModel, setIterationModel] = useState(settings.iterationModel || DEFAULT_MODELS.iteration)
  const [methodologyModel, setMethodologyModel] = useState(settings.methodologyModel || DEFAULT_MODELS.methodology)
  const [renderModel, setRenderModel] = useState(settings.enhancementModel || DEFAULT_MODELS.render)
  const [imageModel, setImageModel] = useState(settings.imageGenModel || DEFAULT_MODELS.image)
  const [enhancementMode, setEnhancementMode] = useState<"none" | "code2prompt">("code2prompt")
  const [exportBridge, setExportBridge] = useState<AutoFigureCanvasExportBridge | null>(null)
  const [showExportModal, setShowExportModal] = useState(false)
  const [exportModalStage, setExportModalStage] = useState<ExportModalStage>("preview")
  const [isExportModalMinimizing, setIsExportModalMinimizing] = useState(false)
  const [sketchPreviewUrl, setSketchPreviewUrl] = useState<string | null>(null)
  const [isSketchPreviewLoading, setIsSketchPreviewLoading] = useState(false)
  const [exportRatings, setExportRatings] = useState<ExportRatingsState>({
    rendered: {
      readable: null,
      faithful: null,
      practical: null,
    },
    sketch: {
      readable: null,
      editable: null,
      practical: null,
    },
  })

  const renderedPreviewDataUrl = useMemo(() => {
    if (!renderedImage?.pngBase64) return null
    return renderedImage.pngBase64.startsWith('data:')
      ? renderedImage.pngBase64
      : `data:image/png;base64,${renderedImage.pngBase64}`
  }, [renderedImage?.pngBase64])

  const hasRenderedOutput = Boolean(renderedPreviewDataUrl)

  const prevSessionStatusRef = useRef<SessionStatus | null>(null)
  const autoOpenedExportKeyRef = useRef<string | null>(null)

  const getDefaultStylePrompt = () => {
    if (outputType === "poster") {
      return DEFAULT_STYLE_PROMPTS.poster
    }
    return DEFAULT_STYLE_PROMPTS[contentType] || DEFAULT_STYLE_PROMPTS.paper
  }

  const handleProviderChange = (value: LLMProvider) => {
    setApiProvider(value)
    if (value === "gemini") {
      setLayoutModel(DEFAULT_MODELS.layout)
      setIterationModel(DEFAULT_MODELS.iteration)
      setMethodologyModel(DEFAULT_MODELS.methodology)
      setRenderModel(DEFAULT_MODELS.render)
      setImageModel(DEFAULT_MODELS.image)
      setShowModelEditor(false)
    } else if (!openRouterBaseUrl) {
      setOpenRouterBaseUrl("https://openrouter.ai/api/v1")
    }
  }

  const resetExportRatings = useCallback(() => {
    setExportRatings({
      rendered: {
        readable: null,
        faithful: null,
        practical: null,
      },
      sketch: {
        readable: null,
        editable: null,
        practical: null,
      },
    })
  }, [])

  const loadSketchPreview = useCallback(async () => {
    if (!showExportModal || !exportBridge?.getSketchPreview) {
      setSketchPreviewUrl(null)
      return
    }

    setIsSketchPreviewLoading(true)
    try {
      const preview = await exportBridge.getSketchPreview()
      setSketchPreviewUrl(preview)
    } catch {
      setSketchPreviewUrl(null)
    } finally {
      setIsSketchPreviewLoading(false)
    }
  }, [exportBridge, showExportModal])

  const openExportHub = useCallback(async () => {
    if (!hasRenderedOutput) {
      setError("Render an image first, then export.")
      return
    }

    resetExportRatings()
    setExportModalStage("preview")
    setIsExportModalMinimizing(false)
    setShowExportModal(true)
  }, [hasRenderedOutput, resetExportRatings, setError])

  const closeExportModalWithAnimation = useCallback(() => {
    setIsExportModalMinimizing(true)
    window.setTimeout(() => {
      setShowExportModal(false)
      setExportModalStage("preview")
      setIsExportModalMinimizing(false)
    }, 500)
  }, [])

  const handleBackToCanvas = useCallback(() => {
    setWorkspaceView("canvas")
    closeExportModalWithAnimation()
  }, [closeExportModalWithAnimation])

  const updateExportRating = useCallback(
    (
      group: keyof ExportRatingsState,
      metric: keyof ExportRatingGroup,
      value: number,
    ) => {
      setExportRatings((prev) => ({
        ...prev,
        [group]: {
          ...prev[group],
          [metric]: value,
        },
      }))
    },
    [],
  )

  const ratingsComplete = useMemo(() => {
    const renderedComplete =
      exportRatings.rendered.readable !== null &&
      exportRatings.rendered.faithful !== null &&
      exportRatings.rendered.practical !== null
    const sketchComplete =
      exportRatings.sketch.readable !== null &&
      exportRatings.sketch.editable !== null &&
      exportRatings.sketch.practical !== null
    return renderedComplete && sketchComplete
  }, [exportRatings])

  const downloadRenderedPng = useCallback(() => {
    if (!renderedPreviewDataUrl) {
      return
    }
    const link = document.createElement("a")
    link.href = renderedPreviewDataUrl
    link.download = `autofigure_rendered_${Date.now()}.png`
    document.body.appendChild(link)
    link.click()
    link.remove()
  }, [renderedPreviewDataUrl])

  const handleConfirmExport = useCallback(async () => {
    if (!ratingsComplete) {
      return
    }

    try {
      let downloadedSketch = false
      if (exportBridge?.downloadSketchSvg) {
        downloadedSketch = await exportBridge.downloadSketchSvg()
      }
      if (!downloadedSketch && exportBridge?.downloadSketchPng) {
        await exportBridge.downloadSketchPng()
      }
      downloadRenderedPng()
      closeExportModalWithAnimation()
    } catch {
      setError("Export failed. Please try again.")
    }
  }, [ratingsComplete, exportBridge, downloadRenderedPng, closeExportModalWithAnimation, setError])

  const fileInputRef = useRef<HTMLInputElement>(null)
  const stepRef = useRef(1)
  const hasRestoredSessionRef = useRef(false)

  const isEnhancing = session?.status === "enhancing"

  useEffect(() => {
    if (!isGenerating) {
      setGenerationProgress(0)
      return
    }

    const start = Date.now()
    const timer = setInterval(() => {
      const elapsed = (Date.now() - start) / 1000
      const next = Math.min(100, Math.round((elapsed / 180) * 100))
      setGenerationProgress(next)
    }, 1000)

    return () => clearInterval(timer)
  }, [isGenerating, isEnhancing])

  const displayProgress = isEnhancing
    ? Math.max(enhancementProgress, generationProgress)
    : generationProgress
  const progressLabel = isEnhancing ? "Rendering (~3 min)" : "Generating (~3 min)"

  useEffect(() => {
    void loadSketchPreview()
  }, [loadSketchPreview])

  useEffect(() => {
    const currentStatus = session?.status ?? null
    const previousStatus = prevSessionStatusRef.current

    if (
      session?.sessionId &&
      hasRenderedOutput &&
      currentStatus === 'completed' &&
      previousStatus &&
      previousStatus !== 'completed'
    ) {
      const key = `${session.sessionId}:${renderedImage?.variant ?? '0'}:${renderedImage?.pngBase64?.length ?? 0}`
      if (autoOpenedExportKeyRef.current !== key) {
        autoOpenedExportKeyRef.current = key
        void openExportHub()
      }
    }

    prevSessionStatusRef.current = currentStatus
  }, [session?.sessionId, session?.status, hasRenderedOutput, renderedImage?.variant, renderedImage?.pngBase64, openExportHub])

  useEffect(() => {
    if (!currentUserId) return
    fetchSessions(projectId || undefined)
  }, [fetchSessions, projectId, currentUserId])

  useEffect(() => {
    if (!currentUserId) {
      if (ownerUserId) {
        resetSessions()
        setOwnerUserId(null)
      }
      if (session) {
        resetSession()
        setRenderedImage(null)
        setWorkspaceView("stepper")
      }
      hasRestoredSessionRef.current = false
      return
    }

    if (ownerUserId && ownerUserId !== currentUserId) {
      resetSessions()
      resetSession()
      setRenderedImage(null)
      setWorkspaceView("stepper")
      hasRestoredSessionRef.current = false
    }

    if (ownerUserId !== currentUserId) {
      setOwnerUserId(currentUserId)
    }
  }, [currentUserId, ownerUserId, resetSessions, resetSession, setOwnerUserId, session])

  useEffect(() => {
    if (!session) return
    if (!canUseSessions) return
    setActiveSessionId(session.sessionId)
    upsertSession({
      sessionId: session.sessionId,
      status: session.status,
      projectId: getCurrentProjectId(),
      inputType: session.config?.inputType || "text",
      sessionName: session.config?.sessionName || null,
      sourceFileName: session.config?.sourceFileName || null,
      contentType: session.config?.contentType,
      createdAt: session.iterations?.[0]?.timestamp || null,
      updatedAt: new Date().toISOString(),
    })
  }, [session, canUseSessions, setActiveSessionId, upsertSession])

  useEffect(() => {
    if (!session) return
    const completed = enhancedImages.find(
      (img) => img.status === "completed" && img.pngBase64
    )
    if (completed) {
      setRenderedImage(completed)
    }
  }, [enhancedImages, session])

  useEffect(() => {
    if (!session) {
      setRenderedImage(null)
      return
    }
    if (!enhancedImages.length || session.status === "enhancing" || session.status === "generating") {
      setRenderedImage(null)
      if (workspaceView === "rendered") {
        setWorkspaceView("canvas")
      }
    }
  }, [session, enhancedImages.length, workspaceView])

  useEffect(() => {
    if (!session) return
    const isBusy =
      isGenerating ||
      session.status === "enhancing" ||
      session.status === "generating" ||
      session.status === "improving"

    if (isBusy) {
      if (workspaceView !== "waiting") {
        setWorkspaceView("waiting")
      }
      return
    }

    if (workspaceView === "waiting") {
      setWorkspaceView(renderedImage ? "rendered" : "canvas")
    }
  }, [session, isGenerating, workspaceView, renderedImage])

  const handleOpenSession = useCallback(
    async (sessionId: string) => {
      setWorkspaceView("canvas")
      setRenderedImage(null)
      resetSession()
      setActiveSessionId(sessionId)
      try {
        const response = await apiClient.get(`/api/v1/autofigure/session/${sessionId}`)
        const data = response.data
        const mappedSession = {
          sessionId: data.session_id,
          status: data.status,
          config: { ...DEFAULT_CONFIG, ...(data.config || {}) } as AutoFigureConfig,
          currentIteration: data.current_iteration || 0,
          iterations: data.iterations || [],
          finalXml: data.final_xml || undefined,
          enhancedImages: data.enhanced_images || [],
          error: data.error || undefined,
        }
        hydrateSession(mappedSession)
        setWorkspaceView("canvas")
      } catch (err: any) {
        const status = err?.response?.status
        if (status === 403 || status === 404) {
          removeSession(sessionId)
          setActiveSessionId(null)
          resetSession()
          setRenderedImage(null)
          setWorkspaceView("stepper")
        }
        setError(err?.message || "Failed to load session")
      }
    },
    [hydrateSession, removeSession, resetSession, setActiveSessionId, setError]
  )

  useEffect(() => {
    if (session || hasRestoredSessionRef.current) return
    if (!canUseSessions) return
    const activeId = activeSessionId
    if (!activeId) return
    hasRestoredSessionRef.current = true
    handleOpenSession(activeId)
  }, [session, activeSessionId, handleOpenSession, canUseSessions])

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    if (isTextFile(file)) {
      const text = await file.text()
      setInputText(text)
      setInputType("text")
      setSourceFileName(null)
      return
    }

    if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
      setIsPdfProcessing(true)
      setInputText(`[Processing PDF: ${file.name}...]`)
      setInputType("pdf")
      setSourceFileName(file.name)
      setError(null)

      try {
        let storedPdfName = file.name
        if (projectId) {
          const savedPdf = await savePdfToAutoFigure(projectId, file)
          storedPdfName = savedPdf.name
          setSourceFileName(savedPdf.name)
        }
        const extractedText = await extractPdfText(file)
        if (extractedText && extractedText.trim()) {
          setInputText(extractedText)
          if (projectId) {
            const textFileName = deriveTextFileName(storedPdfName)
            await saveTextToAutoFigure(projectId, extractedText, textFileName)
          }
        } else {
          setInputText("")
          setInputType("text")
          setSourceFileName(null)
          setError("Could not extract text from PDF.")
        }
      } catch (err: any) {
        setInputText("")
        setInputType("text")
        setSourceFileName(null)
        setError(err?.message || "PDF extraction failed.")
      } finally {
        setIsPdfProcessing(false)
      }
      return
    }

    setInputType("text")
    setSourceFileName(null)
    setError(`Unsupported file type: ${file.type || file.name}`)
  }

  const applyApiSettings = () => {
    const baseUrl = apiProvider === "openrouter" ? openRouterBaseUrl : ""
    settings.updateSettings({
      layoutGenProvider: apiProvider,
      layoutGenApiKey: apiKey,
      layoutGenBaseUrl: apiProvider === "openrouter" ? baseUrl : "",
      layoutGenModel: layoutModel,
      iterationModel: iterationModel,
      methodologyProvider: apiProvider,
      methodologyApiKey: apiKey,
      methodologyModel: methodologyModel,
      enhancementProvider: apiProvider,
      enhancementApiKey: apiKey,
      enhancementModel: renderModel,
      enhancementBaseUrl: apiProvider === "openrouter" ? baseUrl : "",
      imageGenProvider: apiProvider,
      imageGenApiKey: apiKey,
      imageGenModel: imageModel,
      imageGenBaseUrl: apiProvider === "openrouter" ? baseUrl : "",
    })
  }

  const applyStyleSettings = () => {
    const artStyle = styleMode === "custom" && customStylePrompt.trim()
      ? customStylePrompt.trim()
      : getDefaultStylePrompt()
    settings.updateSettings({
      enhancementMode: enhancementMode,
      artStyle,
      enhancementCount: 1,
    })
    updateConfig({
      enhancementMode: enhancementMode,
      artStyle,
      enhancementCount: 1,
    })
  }

  const buildGenerationConfig = () => {
    const baseUrl = apiProvider === "openrouter" ? openRouterBaseUrl : ""
    const artStyle = styleMode === "custom" && customStylePrompt.trim()
      ? customStylePrompt.trim()
      : getDefaultStylePrompt()
    const sessionName = deriveSessionName(inputText, sourceFileName)
    const genConfig: Partial<AutoFigureConfig> = {
      contentType: outputType === "poster" ? "poster" : contentType,
      inputText,
      inputType,
      ...(inputType === "pdf" && sourceFileName ? { sourceFileName } : {}),
      sessionName,
      llmProvider: apiProvider,
      apiKey,
      baseUrl: baseUrl || undefined,
      model: layoutModel,
      iterationModel: iterationModel || layoutModel,  // Use layoutModel if not specified
      enableMethodologyExtraction: settings.enableMethodologyExtraction,
      methodologyLlmProvider: apiProvider,
      methodologyLlmApiKey: apiKey,
      methodologyLlmBaseUrl: baseUrl || undefined,
      methodologyLlmModel: methodologyModel,
      enhancementMode: enhancementMode,
      artStyle,
      enhancementCount: 1,
      enhancementLlmProvider: apiProvider,
      enhancementLlmApiKey: apiKey,
      enhancementLlmBaseUrl: baseUrl,
      enhancementLlmModel: renderModel,
      imageGenProvider: apiProvider,
      imageGenApiKey: apiKey,
      imageGenBaseUrl: baseUrl,
      imageGenModel: imageModel,
      pptxExportEnabled: settings.pptxExportEnabled,
      pptxExportMode: settings.pptxExportMode,
      pptxIncludeMetadata: settings.pptxIncludeMetadata,
    }
    updateConfig(genConfig)
    return genConfig
  }

  const handleStepChange = (step: number) => {
    if (step > stepRef.current) {
      if (stepRef.current === 2) {
        applyApiSettings()
      }
    }
    stepRef.current = step
  }

  const canProceed = (step: number) => {
    if (step === 2) {
      const hasKey = apiKey.trim().length > 0
      const hasBaseUrl = apiProvider !== "openrouter" || openRouterBaseUrl.trim().length > 0
      return hasKey && hasBaseUrl
    }
    if (step === 3) {
      return inputText.trim().length > 0 && !isPdfProcessing
    }
    return true
  }

  const handleCreateSession = async () => {
    applyApiSettings()
    applyStyleSettings()
    const genConfig = buildGenerationConfig()
    const configOverride = { ...DEFAULT_CONFIG, ...genConfig } as AutoFigureConfig
    resetSession()
    setWaitingPhase("generate")
    setWorkspaceView("waiting")
    const success = await startGeneration(inputText, configOverride)
    if (!success) {
      setWorkspaceView("stepper")
      return
    }
    setWorkspaceView("canvas")
  }

  const nextButtonLabel = (step: number, total: number) => {
    if (step === 1) return "Next"
    if (step === total) return "Create & Generate"
    return "Next"
  }

  const handleFinalStep = () => {
    handleCreateSession()
  }

  const statusLabel = (status: string) => {
    const mapping: Record<string, string> = {
      created: "Created",
      generating: "Generating",
      iteration_complete: "Iterating",
      improving: "Improving",
      finalized: "Finalized",
      enhancing: "Rendering",
      completed: "Completed",
      error: "Error",
      failed: "Failed",
    }
    return mapping[status] || status
  }

  const formatTimestamp = (value?: string | null) => {
    if (!value) return "Just now"
    const date = new Date(value)
    if (Number.isNaN(date.getTime())) return "Just now"
    return date.toLocaleString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })
  }

  const deriveSessionName = (text: string, fileName?: string | null) => {
    if (fileName) return fileName.replace(/\.[^/.]+$/, "")
    const line = text.split("\n").map((item) => item.trim()).find((item) => item.length > 0)
    if (line) return line.slice(0, 48)
    return "Untitled Session"
  }

  const deriveTextFileName = (fileName: string) => {
    const safeName = fileName.split("/").pop() || fileName
    const lastDot = safeName.lastIndexOf(".")
    if (lastDot > 0) {
      return `${safeName.slice(0, lastDot)}.txt`
    }
    return `${safeName}.txt`
  }

  const downloadFileByPath = async (path: string | string[]) => {
    const paths = Array.isArray(path) ? path : [path]
    if (!projectId) {
      setError("Open a project to view AutoFigure files.")
      return
    }
    await refreshFileTree()
    for (const candidate of paths) {
      const node = findNodeByPath(candidate)
      if (node && node.type === "file") {
        try {
          await downloadFileById(node.id, node.name)
        } catch (err: any) {
          setError(err?.message || "Failed to download file.")
        }
        return
      }
    }
    setError("File not found in the project tree.")
  }

  const deleteSession = async (sessionId: string) => {
    try {
      await apiClient.delete(`/api/v1/autofigure/session/${sessionId}`)
      removeSession(sessionId)
      if (activeSessionId === sessionId) {
        resetSession()
        setActiveSessionId(null)
        setRenderedImage(null)
        setWorkspaceView("stepper")
      }
    } catch (err: any) {
      setError(err?.message || "Failed to delete session")
    }
  }

  const handleNewSession = () => {
    resetSession()
    setActiveSessionId(null)
    setRenderedImage(null)
    setWorkspaceView("stepper")
  }

  const activeSessionName =
    session?.config?.sessionName ||
    session?.config?.sourceFileName ||
    (activeSessionId ? `Session ${activeSessionId.slice(0, 8)}` : 'No active session')
  const activeSessionStatus = session?.status ? statusLabel(session.status) : 'Idle'

  return (
    <div className="af-layout">
      <aside className="af-session-panel">
        <div className="af-session-header">
          <div className="af-session-logo">
            <img src="/autofigure_apparent.png" alt="AutoFigure logo" />
          </div>
          <div className="af-session-title">
            AutoFigure Sessions
            <HelpHint text="Open a session to continue or start a new one." />
          </div>
          <Button
            className="af-session-cta"
            onClick={handleNewSession}
          >
            New Session
          </Button>
        </div>

        <ScrollArea className="af-session-list">
          {visibleSessions.length === 0 && (
            <div className="af-session-empty">No sessions yet.</div>
          )}
          {visibleSessions.map((item) => {
            const isActive = activeSessionId === item.sessionId
            const displayName =
              item.sessionName ||
              item.sourceFileName ||
              (item.contentType ? item.contentType : "Session")
            return (
              <button
                key={item.sessionId}
                className={cn("af-session-row", isActive && "active")}
                onClick={() => handleOpenSession(item.sessionId)}
                onContextMenu={(event) => {
                  event.preventDefault()
                  setSessionMenu({
                    session: item,
                    x: event.clientX,
                    y: event.clientY,
                  })
                }}
              >
                <span className="af-session-caret">{isActive ? ">" : ""}</span>
                <div className="af-session-meta">
                  <div className="af-session-name">
                    {displayName}
                  </div>
                  <div className="af-session-time">
                    {formatTimestamp(item.updatedAt || item.createdAt)}
                  </div>
                </div>
                <span className={cn("af-session-status", `status-${item.status}`)}>
                  {statusLabel(item.status)}
                </span>
              </button>
            )
          })}
        </ScrollArea>

        <div className="af-session-footer">
          {activeSessionId ? (
            <div className="af-session-status-line">Active session loaded</div>
          ) : null}
        </div>
      </aside>

      <section className="af-workspace">
        <div className="af-workspace-topbar">
          <div className="af-topbar-main">
            <div className="af-topbar-title">AutoFigure Editor</div>
            <div className="af-topbar-meta">{activeSessionName}</div>
          </div>
          <div className="af-topbar-actions">
            <span className="af-topbar-status">{activeSessionStatus}</span>
            {hasRenderedOutput && (
              <button
                type="button"
                className="af-topbar-export-btn"
                onClick={() => void openExportHub()}
              >
                <Download className="h-3.5 w-3.5" />
                Export
              </button>
            )}
          </div>
        </div>

        <AutoFigureProgressBar
          isActive={isGenerating}
          progress={displayProgress}
          label={progressLabel}
        />

        {error && (
          <div className="af-error-strip">
            <span>{error}</span>
            <button onClick={() => setError(null)} aria-label="Dismiss error">
              ×
            </button>
          </div>
        )}

        {workspaceView === "waiting" && (
          <div className="af-waiting-panel">
            <AutoFigureWaitingHero
              progress={displayProgress}
              label={progressLabel}
              phase={waitingPhase}
            />
          </div>
        )}

        {workspaceView === "stepper" && (
          <div className="af-stepper-panel">
            <div className="af-stepper-hero">
              <img
                src="/autofigure_apparent.png"
                alt="AutoFigure logo"
                className="af-stepper-logo"
              />
              <div className="af-stepper-subtitle">
                Build, iterate, and render publication‑ready figures in minutes.
              </div>
            </div>
            <div className="af-stepper-scroll">
              <Stepper
                initialStep={1}
                onStepChange={handleStepChange}
                onFinalStepCompleted={handleFinalStep}
                nextButtonText={nextButtonLabel}
                nextDisabled={(step) => !canProceed(step)}
                backButtonText="Previous"
                contentAnimation
                className="af-stepper-body"
              >
                <Step title="Let’s Start" description="Start a new AutoFigure session.">
                  <div className="af-step-content">
                    <p className="af-step-copy">
                      Follow four quick steps to generate your first draft. Existing sessions reopen
                      automatically from the sidebar.
                    </p>
                  </div>
                </Step>

                <Step title="Configure API" description="Choose a provider and enter your API key.">
                  <div className="af-step-content">
                    <div className="af-step-row">
                      <div className="af-step-label">
                        Provider <HelpHint text="Google Gemini is the fastest setup. OpenRouter offers more control." />
                      </div>
                      <SegmentedControl
                        value={apiProvider}
                        onValueChange={(value) => handleProviderChange(value as LLMProvider)}
                        items={[
                          { value: "gemini", label: "Google Gemini" },
                          { value: "openrouter", label: "OpenRouter" },
                        ]}
                        size="sm"
                      />
                    </div>

                    <div className="af-step-row">
                      <div className="af-step-label">
                        API Key <HelpHint text="Saved locally. Never shared with other users." />
                      </div>
                      <Input
                        type="password"
                        value={apiKey}
                        onChange={(event) => setApiKey(event.target.value)}
                        placeholder="Paste your API key"
                      />
                    </div>

                    {apiProvider === "openrouter" && (
                      <div className="af-step-row">
                        <div className="af-step-label">Base URL</div>
                        <Input
                          value={openRouterBaseUrl}
                          onChange={(event) => setOpenRouterBaseUrl(event.target.value)}
                          placeholder="https://openrouter.ai/api/v1"
                        />
                      </div>
                    )}

                    {apiProvider === "openrouter" ? (
                      <>
                        <div className="af-step-row af-step-inline">
                          <span className="af-step-label">Models</span>
                          <button
                            type="button"
                            className="af-link"
                            onClick={() => setShowModelEditor((prev) => !prev)}
                          >
                            {showModelEditor ? "Hide" : "Edit models"}
                          </button>
                        </div>

                        {!showModelEditor && (
                          <div className="af-model-summary">
                            <div>
                            Layout: <span>{layoutModel}</span>
                          </div>
                          <div>
                            Iteration: <span>{iterationModel || "(same as Layout)"}</span>
                          </div>
                          <div>
                            Methodology: <span>{methodologyModel}</span>
                          </div>
                          <div>
                            Render: <span>{renderModel}</span>
                          </div>
                          <div>
                            Image: <span>{imageModel}</span>
                          </div>
                        </div>
                      )}

                      {showModelEditor && (
                        <div className="af-model-editor">
                          <div className="af-model-row">
                            <span className="af-model-label">Layout</span>
                            <Input
                              value={layoutModel}
                              onChange={(event) => setLayoutModel(event.target.value)}
                              placeholder={DEFAULT_MODELS.layout}
                            />
                          </div>
                          <div className="af-model-row">
                            <span className="af-model-label">Iteration</span>
                            <Input
                              value={iterationModel}
                              onChange={(event) => setIterationModel(event.target.value)}
                              placeholder="(same as Layout)"
                            />
                          </div>
                          <div className="af-model-row">
                            <span className="af-model-label">Methodology</span>
                            <Input
                              value={methodologyModel}
                              onChange={(event) => setMethodologyModel(event.target.value)}
                              placeholder={DEFAULT_MODELS.methodology}
                            />
                          </div>
                          <div className="af-model-row">
                            <span className="af-model-label">Render</span>
                            <Input
                              value={renderModel}
                              onChange={(event) => setRenderModel(event.target.value)}
                              placeholder={DEFAULT_MODELS.render}
                            />
                          </div>
                          <div className="af-model-row">
                            <span className="af-model-label">Image</span>
                            <Input
                              value={imageModel}
                              onChange={(event) => setImageModel(event.target.value)}
                              placeholder={DEFAULT_MODELS.image}
                            />
                          </div>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="af-model-summary">
                      <div>
                        Layout: <span>{layoutModel}</span>
                      </div>
                      <div>
                        Iteration: <span>{iterationModel || "(same as Layout)"}</span>
                      </div>
                      <div>
                        Methodology: <span>{methodologyModel}</span>
                      </div>
                      <div>
                        Render: <span>{renderModel}</span>
                      </div>
                      <div>
                        Image: <span>{imageModel}</span>
                      </div>
                      <div className="af-model-note">Defaults are applied for Google Gemini.</div>
                    </div>
                  )}
                </div>
              </Step>

              <Step title="Doc Ingestion" description="Upload a document or paste text.">
                <div className="af-step-content">
                  <div className="af-upload-card">
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,.txt,.md,.tex"
                      onChange={handleFileUpload}
                      className="hidden"
                    />
                    <UploadCloud className="h-5 w-5" />
                    <div>Drag a file or click to upload</div>
                    <button
                      type="button"
                      className="af-link"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      Browse files
                    </button>
                  </div>

                  <Textarea
                    value={inputText}
                    onChange={(event) => setInputText(event.target.value)}
                    placeholder="Paste your document content here..."
                    className="af-textarea"
                  />

                  <div className="af-step-row">
                    <div className="af-step-label">Output Type</div>
                    <SegmentedControl
                      value={outputType}
                      onValueChange={(value) => setOutputType(value as OutputType)}
                      items={[
                        { value: "figure", label: "Figure", icon: <ImageIcon className="h-3 w-3" /> },
                        { value: "poster", label: "Poster", icon: <FileText className="h-3 w-3" /> },
                      ]}
                      size="sm"
                    />
                  </div>

                  {outputType === "figure" && (
                    <div className="af-step-row">
                      <div className="af-step-label">
                        Content Type <HelpHint text="Helps the layout engine choose the right structure." />
                      </div>
                      <Select value={contentType} onValueChange={(value) => setContentType(value as ContentType)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Select content type" />
                        </SelectTrigger>
                        <SelectContent>
                          {FIGURE_CONTENT_TYPES.map((item) => (
                            <SelectItem key={item.value} value={item.value}>
                              {item.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                </div>
              </Step>

              <Step title="Style & Render" description="Choose a render style.">
                <div className="af-step-content">
                  <div className="af-step-row">
                    <div className="af-step-label">Style</div>
                    <SegmentedControl
                      value={styleMode}
                      onValueChange={(value) => setStyleMode(value as "default" | "custom")}
                      items={[
                        { value: "default", label: "Default" },
                        { value: "custom", label: "Custom" },
                      ]}
                      size="sm"
                    />
                  </div>

                  <div className="af-step-row">
                    <div className="af-step-label">Mode</div>
                    <SegmentedControl
                      value={enhancementMode === "none" ? "faithful" : "creative"}
                      onValueChange={(value) => setEnhancementMode(value === "faithful" ? "none" : "code2prompt")}
                      items={[
                        { value: "faithful", label: "Faithful" },
                        { value: "creative", label: "Creative" },
                      ]}
                      size="sm"
                    />
                  </div>

                  {styleMode === "custom" && (
                    <Textarea
                      value={customStylePrompt}
                      onChange={(event) => setCustomStylePrompt(event.target.value)}
                      placeholder="Describe your desired style..."
                      className="af-textarea af-style-textarea"
                    />
                  )}
                </div>
              </Step>
            </Stepper>
          </div>
        </div>
        )}

        {(workspaceView === "canvas" || workspaceView === "rendered") && (
          <div className="af-canvas-stack">
            <AutoFigureCanvas
              onRender={() => setWorkspaceView("rendered")}
              onError={(message) => setError(message)}
              onIterateStart={() => setWaitingPhase("iterate")}
              onRenderStart={() => setWaitingPhase("render")}
              onOpenExportHub={() => void openExportHub()}
              onExportBridgeChange={setExportBridge}
            />
          </div>
        )}
      </section>

      {showExportModal && typeof document !== "undefined" &&
        createPortal(
          <div className="af-export-overlay">
            <div
              className={cn('af-export-modal', isExportModalMinimizing && 'is-minimizing')}
              role="dialog"
              aria-modal="true"
              aria-label="AutoFigure export"
            >
              <div className="af-export-header">
                <div>
                  <div className="af-export-title">
                    {exportModalStage === 'preview' ? 'Export Assets' : 'Confirm Export Quality'}
                  </div>
                  <div className="af-export-subtitle">
                    {exportModalStage === 'preview'
                      ? 'Preview both outputs and continue to export.'
                      : 'Please complete quality ratings before download.'}
                  </div>
                </div>
                <button
                  type="button"
                  className="af-export-close"
                  onClick={closeExportModalWithAnimation}
                  aria-label="Close export dialog"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {exportModalStage === 'preview' ? (
                <>
                  <div className="af-export-preview-grid">
                    <div className="af-export-preview-card">
                      <div className="af-export-preview-card-head">
                        <span>SVG Sketch</span>
                        <span className="af-export-preview-note">Editable source</span>
                      </div>
                      <div className="af-export-preview-box">
                        {isSketchPreviewLoading ? (
                          <div className="af-export-empty">Loading sketch preview...</div>
                        ) : sketchPreviewUrl ? (
                          <img src={sketchPreviewUrl} alt="Sketch preview" />
                        ) : (
                          <div className="af-export-empty">Sketch preview unavailable.</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="af-export-secondary-btn"
                        onClick={() => setExportModalStage('rating')}
                      >
                        Continue Export
                      </button>
                    </div>

                    <div className="af-export-preview-card">
                      <div className="af-export-preview-card-head">
                        <span>Rendered PNG</span>
                        <span className="af-export-preview-note">Final output</span>
                      </div>
                      <div className="af-export-preview-box">
                        {renderedPreviewDataUrl ? (
                          <img src={renderedPreviewDataUrl} alt="Rendered preview" />
                        ) : (
                          <div className="af-export-empty">Render required before export.</div>
                        )}
                      </div>
                      <button
                        type="button"
                        className="af-export-primary-btn"
                        onClick={() => setExportModalStage('rating')}
                        disabled={!hasRenderedOutput}
                      >
                        Continue Export
                      </button>
                    </div>
                  </div>

                  <div className="af-export-footer">
                    <div className="af-export-footnote">
                      SVG can be directly imported into Microsoft PowerPoint 2019 or later.
                    </div>
                    <button
                      type="button"
                      className="af-export-primary-btn"
                      onClick={handleBackToCanvas}
                    >
                      Back to SVG Editing
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <div className="af-export-rating-layout">
                    <div className="af-export-rating-panel">
                      <div className="af-export-rating-panel-title">Rendered PNG</div>
                      <RatingRow
                        label="Readable"
                        value={exportRatings.rendered.readable}
                        hint={EXPORT_METRIC_HINTS.rendered_readable}
                        onChange={(score) => updateExportRating('rendered', 'readable', score)}
                      />
                      <RatingRow
                        label="Faithful"
                        value={exportRatings.rendered.faithful ?? null}
                        hint={EXPORT_METRIC_HINTS.rendered_faithful}
                        onChange={(score) => updateExportRating('rendered', 'faithful', score)}
                      />
                      <RatingRow
                        label="Practical"
                        value={exportRatings.rendered.practical}
                        hint={EXPORT_METRIC_HINTS.rendered_practical}
                        onChange={(score) => updateExportRating('rendered', 'practical', score)}
                      />
                    </div>

                    <div className="af-export-rating-panel">
                      <div className="af-export-rating-panel-title">SVG Sketch</div>
                      <RatingRow
                        label="Readable"
                        value={exportRatings.sketch.readable}
                        hint={EXPORT_METRIC_HINTS.sketch_readable}
                        onChange={(score) => updateExportRating('sketch', 'readable', score)}
                      />
                      <RatingRow
                        label="Editable"
                        value={exportRatings.sketch.editable ?? null}
                        hint={EXPORT_METRIC_HINTS.sketch_editable}
                        onChange={(score) => updateExportRating('sketch', 'editable', score)}
                      />
                      <RatingRow
                        label="Practical"
                        value={exportRatings.sketch.practical}
                        hint={EXPORT_METRIC_HINTS.sketch_practical}
                        onChange={(score) => updateExportRating('sketch', 'practical', score)}
                      />
                    </div>
                  </div>

                  <div className="af-export-footer">
                    <div className="af-export-footnote">
                      SVG can be directly imported into Microsoft PowerPoint 2019 or later.
                    </div>
                    <button
                      type="button"
                      className="af-export-primary-btn"
                      onClick={() => void handleConfirmExport()}
                      disabled={!ratingsComplete || !hasRenderedOutput}
                    >
                      Export and Download
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>,
          document.body
        )}

      {sessionMenu && typeof document !== "undefined" &&
        createPortal(
          <SessionContextMenu
            menu={sessionMenu}
            onClose={() => setSessionMenu(null)}
            onDownload={downloadFileByPath}
            onDelete={deleteSession}
            deriveTextFileName={deriveTextFileName}
          />,
          document.body
        )}
    </div>
  )
}

type SessionMenuState = {
  session: {
    sessionId: string
    sourceFileName?: string | null
  }
  x: number
  y: number
}

function SessionContextMenu({
  menu,
  onClose,
  onDownload,
  onDelete,
  deriveTextFileName,
}: {
  menu: SessionMenuState
  onClose: () => void
  onDownload: (path: string | string[]) => void
  onDelete: (sessionId: string) => void
  deriveTextFileName: (fileName: string) => string
}) {
  const safeDownload = typeof onDownload === "function" ? onDownload : null
  const safeDelete = typeof onDelete === "function" ? onDelete : null
  const [position, setPosition] = useState({ x: 0, y: 0 })

  useEffect(() => {
    let isMounted = true
    const handleClick = () => onClose()
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    const timeoutId = window.setTimeout(() => {
      if (!isMounted) return
      window.addEventListener("click", handleClick)
      window.addEventListener("keydown", handleEscape)
      window.addEventListener("scroll", handleClick, true)
    }, 0)
    return () => {
      isMounted = false
      window.clearTimeout(timeoutId)
      window.removeEventListener("click", handleClick)
      window.removeEventListener("keydown", handleEscape)
      window.removeEventListener("scroll", handleClick, true)
    }
  }, [onClose])

  useLayoutEffect(() => {
    const width = 220
    const height = 176
    const padding = 8
    const maxX = window.innerWidth - width - padding
    const maxY = window.innerHeight - height - padding
    setPosition({
      x: Math.max(padding, Math.min(menu.x, maxX)),
      y: Math.max(padding, Math.min(menu.y, maxY)),
    })
  }, [menu.x, menu.y])

  const pdfPath = menu.session.sourceFileName
    ? `/AutoFigure/PDF/${menu.session.sourceFileName}`
    : null
  const textFileName = menu.session.sourceFileName
    ? deriveTextFileName(menu.session.sourceFileName)
    : null
  const textPath = textFileName ? `/AutoFigure/Text/${textFileName}` : null
  const enhancedImagePath = `/AutoFigure/Image/${menu.session.sessionId}/enhanced_1.png`
  const finalImagePath = `/AutoFigure/Image/${menu.session.sessionId}/final.png`

  return (
    <div
      className="af-session-menu"
      style={{ top: position.y, left: position.x }}
      role="menu"
      onClick={(event) => event.stopPropagation()}
      onMouseDown={(event) => event.stopPropagation()}
    >
      <button
        type="button"
        className="af-session-menu-item"
        disabled={!pdfPath || !safeDownload}
        onClick={() => {
          if (!pdfPath || !safeDownload) return
          safeDownload(pdfPath)
          onClose()
        }}
      >
        Download PDF
      </button>
      <button
        type="button"
        className="af-session-menu-item"
        disabled={!textPath || !safeDownload}
        onClick={() => {
          if (!textPath || !safeDownload) return
          safeDownload(textPath)
          onClose()
        }}
      >
        Download TXT
      </button>
      <button
        type="button"
        className="af-session-menu-item"
        disabled={!safeDownload}
        onClick={() => {
          if (!safeDownload) return
          safeDownload([enhancedImagePath, finalImagePath])
          onClose()
        }}
      >
        Download IMG
      </button>
      <button
        type="button"
        className={cn("af-session-menu-item", "danger")}
        disabled={!safeDelete}
        onClick={() => {
          if (!safeDelete) return
          if (confirm("Delete this AutoFigure session? This cannot be undone.")) {
            safeDelete(menu.session.sessionId)
            onClose()
          }
        }}
      >
        Delete Session
      </button>
    </div>
  )
}

function AutoFigureProgressBar({
  isActive,
  progress,
  label,
}: {
  isActive: boolean
  progress: number
  label: string
}) {
  if (!isActive) return null

  return (
    <div className="af-progress-bar">
      <div className="af-progress-track">
        <div className="af-progress-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="af-progress-label">{label}</div>
    </div>
  )
}

function RatingRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: number | null
  onChange: (score: number) => void
}) {
  return (
    <div className="af-export-rating-row">
      <div className="af-export-rating-label">
        <span>{label}</span>
        <TooltipProvider>
          <Tooltip delayDuration={100}>
            <TooltipTrigger className="af-export-metric-hint">
              <span className="af-export-hint-icon">?</span>
            </TooltipTrigger>
            <TooltipContent side="top" className="af-export-tooltip">
              {hint}
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="af-export-score-group">
        {[1, 2, 3, 4, 5].map((score) => (
          <button
            key={`${label}-${score}`}
            type="button"
            className={cn('af-export-score-btn', value === score && 'active')}
            onClick={() => onChange(score)}
          >
            {score}
          </button>
        ))}
      </div>
    </div>
  )
}

function HelpHint({ text }: { text: string }) {
  const [open, setOpen] = useState(false)
  const buttonRef = useRef<HTMLButtonElement | null>(null)
  const [position, setPosition] = useState({ top: 0, left: 0 })

  useLayoutEffect(() => {
    if (!open || !buttonRef.current) return
    const rect = buttonRef.current.getBoundingClientRect()
    setPosition({
      top: rect.bottom + 8,
      left: rect.left,
    })
  }, [open])

  return (
    <div className="af-help-wrap">
      <button
        ref={buttonRef}
        type="button"
        className="af-help-icon"
        aria-label="Help"
        onClick={() => setOpen(true)}
      >
        <HelpCircle className="h-3.5 w-3.5" />
      </button>
      {open &&
        typeof document !== "undefined" &&
        createPortal(
          <div
            className="af-help-popover"
            role="dialog"
            style={{ top: position.top, left: position.left }}
          >
            <div className="af-help-header">
              <span>Tip</span>
              <button type="button" onClick={() => setOpen(false)}>
                ×
              </button>
            </div>
            <div className="af-help-body">{text}</div>
          </div>,
          document.body
        )}
    </div>
  )
}
