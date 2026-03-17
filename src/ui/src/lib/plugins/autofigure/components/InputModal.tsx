"use client"

/**
 * Input Modal Component
 *
 * Modal for collecting content type and content input before figure generation.
 * Appears when AutoFigure canvas is opened without an active session.
 */

import { useState, useRef, useEffect } from "react"
import {
    X,
    Sparkles,
    Paperclip,
    ChevronDown,
    Check,
    FileText,
    BookOpen,
    GraduationCap,
    Image,
    Settings2,
    ArrowRight,
    Loader2,
    Newspaper,
} from "lucide-react"
import { useAutoFigure } from "../contexts/autofigure-context"
import { useAutoFigureSettings } from "@/lib/stores/autofigure-settings"
import type { ContentType, AutoFigureConfig, LLMProvider } from "../lib/autofigure-types"
// File operations not needed for PDF extraction (done client-side)
import { extractPdfText, isTextFile } from "../lib/pdf-extraction"
import SettingsModal from "./SettingsModal"

interface InputModalProps {
    isOpen: boolean
    onClose: () => void
    onConfirm: () => void
}

// Output types: Figure (methodology diagrams) vs Poster (promotional posters)
type OutputType = "figure" | "poster"

// Content types for Figure output (poster is handled separately)
const figureContentTypes: { value: ContentType; label: string; icon: React.ReactNode }[] = [
    { value: "paper", label: "Paper", icon: <FileText className="w-4 h-4" /> },
    { value: "survey", label: "Survey", icon: <BookOpen className="w-4 h-4" /> },
    { value: "textbook", label: "Textbook", icon: <GraduationCap className="w-4 h-4" /> },
]

export default function InputModal({ isOpen, onClose, onConfirm }: InputModalProps) {
    const settings = useAutoFigureSettings()
    const { config, updateConfig, error, setError, clearError } = useAutoFigure()

    const [inputText, setInputText] = useState("")
    const [outputType, setOutputType] = useState<OutputType>("figure")
    const [showDropdown, setShowDropdown] = useState(false)
    const [showSettings, setShowSettings] = useState(false)
    const [isPdfProcessing, setIsPdfProcessing] = useState(false)
    const [inputType, setInputType] = useState<"text" | "pdf">("text")
    const [sourceFileName, setSourceFileName] = useState<string | null>(null)

    const dropdownRef = useRef<HTMLDivElement>(null)
    const fileInputRef = useRef<HTMLInputElement>(null)
    const textareaRef = useRef<HTMLTextAreaElement>(null)

    // Focus textarea when modal opens
    useEffect(() => {
        if (isOpen && textareaRef.current) {
            textareaRef.current.focus()
        }
    }, [isOpen])

    // Close on Escape key
    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === "Escape") {
                onClose()
            }
        }
        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown)
            return () => document.removeEventListener("keydown", handleKeyDown)
        }
    }, [isOpen, onClose])

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setShowDropdown(false)
            }
        }
        document.addEventListener("mousedown", handleClickOutside)
        return () => document.removeEventListener("mousedown", handleClickOutside)
    }, [])

    // Prevent body scroll when modal is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = ""
        }
        return () => {
            document.body.style.overflow = ""
        }
    }, [isOpen])

    if (!isOpen) return null

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0]
        if (!file) return

        // Handle text files
        if (isTextFile(file)) {
            const text = await file.text()
            setInputText(text)
            setInputType("text")
            setSourceFileName(null)
            console.log("[AutoFigure] Text file loaded, length:", text.length)
            return
        }

        // Handle PDF files - extract text using client-side unpdf library
        // Following autofigure_opensource pattern exactly
        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
            setIsPdfProcessing(true)
            setInputText(`[Processing PDF: ${file.name}...]`)
            setInputType("pdf")
            setSourceFileName(file.name)
            clearError()

            try {
                console.log("[AutoFigure] Starting client-side PDF text extraction...")

                // Extract text from PDF using unpdf (client-side only, no server calls)
                const extractedText = await extractPdfText(file)

                if (extractedText && extractedText.trim()) {
                    setInputText(extractedText)
                    console.log("[AutoFigure] PDF extraction successful, text length:", extractedText.length)
                } else {
                    setInputText("")
                    setInputType("text")
                    setSourceFileName(null)
                    setError("Could not extract text from PDF. The PDF may be scanned or image-based.")
                    console.error("[AutoFigure] PDF extraction returned empty text")
                }
            } catch (err) {
                console.error("[AutoFigure] PDF extraction error:", err)
                setInputText("")
                setInputType("text")
                setSourceFileName(null)
                setError(`PDF extraction failed: ${err instanceof Error ? err.message : String(err)}`)
            } finally {
                setIsPdfProcessing(false)
            }
            return
        }

        // Unsupported file type
        setInputType("text")
        setSourceFileName(null)
        setError(`Unsupported file type: ${file.type || file.name}`)
    }

    const isConfigValid = () => {
        if (!settings.layoutGenApiKey?.trim()) return false
        if (config.contentType === 'paper' && settings.enableMethodologyExtraction) {
            if (!settings.methodologyApiKey?.trim()) return false
        }
        return true
    }

    const handleConfirm = () => {
        if (!inputText.trim()) {
            setError("Please enter some content or upload a file")
            return
        }

        if (!isConfigValid()) {
            setShowSettings(true)
            return
        }

        clearError()

        // Build config from settings
        const genConfig: Partial<AutoFigureConfig> = {
            contentType: config.contentType,
            inputText,
            inputType,
            ...(inputType === "pdf" && sourceFileName ? { sourceFileName } : {}),
            llmProvider: settings.layoutGenProvider as LLMProvider,
            apiKey: settings.layoutGenApiKey,
            baseUrl: settings.layoutGenBaseUrl || undefined,
            model: settings.layoutGenModel,
            enableMethodologyExtraction: settings.enableMethodologyExtraction,
            methodologyLlmProvider: settings.methodologyProvider as LLMProvider,
            methodologyLlmApiKey: settings.methodologyApiKey || settings.layoutGenApiKey,
            methodologyLlmModel: settings.methodologyModel,
        }

        // Update context config (this will trigger generation in AutoFigurePlugin after DrawIO is ready)
        updateConfig(genConfig)

        // Save pending config to localStorage (following original autofigure pattern)
        localStorage.setItem('autofigure-pending-config', JSON.stringify(genConfig))
        console.log('[InputModal] Saved pending config, inputText length:', inputText.length)

        // Close modal - generation will start after DrawIO is ready
        onConfirm()
    }

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
            e.preventDefault()
            handleConfirm()
        }
    }

    // Get current content type for Figure dropdown (excludes poster)
    const currentContentType = figureContentTypes.find(t => t.value === config.contentType) || figureContentTypes[0]

    // Handle output type change
    const handleOutputTypeChange = (type: OutputType) => {
        setOutputType(type)
        if (type === "poster") {
            updateConfig({ contentType: "poster" })
        } else {
            // When switching to figure, default to paper if current is poster
            if (config.contentType === "poster") {
                updateConfig({ contentType: "paper" })
            }
        }
    }

    return (
        <>
            <div className="af-modal-overlay" onClick={onClose}>
                <div
                    className="af-modal"
                    onClick={e => e.stopPropagation()}
                    style={{ maxWidth: '540px', width: '90%' }}
                >
                    {/* Header */}
                    <div className="af-modal-header">
                        <div className="af-modal-title">
                            <img
                                src="/autofigure_apparent.png"
                                alt="AutoFigure"
                                style={{
                                    height: '32px',
                                    width: 'auto',
                                    objectFit: 'contain',
                                }}
                            />
                            <div>
                                <h2>Create New Figure</h2>
                                <p>Enter content to generate a scientific figure</p>
                            </div>
                        </div>
                        <button className="af-modal-close" onClick={onClose}>
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="af-modal-content">
                        {/* Output Type Toggle */}
                        <div className="af-form-group" style={{ marginBottom: '16px' }}>
                            <label className="af-label">Output Type</label>
                            <div style={{ display: 'flex', gap: '8px' }}>
                                <button
                                    className={`af-output-type-btn ${outputType === 'figure' ? 'active' : ''}`}
                                    onClick={() => handleOutputTypeChange('figure')}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '10px 16px',
                                        border: outputType === 'figure' ? '2px solid var(--af-accent-primary)' : '1px solid var(--af-border-primary)',
                                        borderRadius: '8px',
                                        background: outputType === 'figure' ? 'rgba(201, 179, 122, 0.1)' : 'var(--af-bg-glass)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <Image className="w-4 h-4" />
                                    <span>Figure</span>
                                </button>
                                <button
                                    className={`af-output-type-btn ${outputType === 'poster' ? 'active' : ''}`}
                                    onClick={() => handleOutputTypeChange('poster')}
                                    style={{
                                        flex: 1,
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '8px',
                                        padding: '10px 16px',
                                        border: outputType === 'poster' ? '2px solid var(--af-accent-primary)' : '1px solid var(--af-border-primary)',
                                        borderRadius: '8px',
                                        background: outputType === 'poster' ? 'rgba(201, 179, 122, 0.1)' : 'var(--af-bg-glass)',
                                        cursor: 'pointer',
                                        transition: 'all 0.15s ease',
                                    }}
                                >
                                    <Newspaper className="w-4 h-4" />
                                    <span>Poster</span>
                                </button>
                            </div>
                        </div>

                        {/* Content Type Dropdown - only shown for Figure output */}
                        {outputType === 'figure' && (
                            <div className="af-form-group" style={{ marginBottom: '16px' }}>
                                <label className="af-label">Content Type</label>
                                <div className="af-dropdown" ref={dropdownRef}>
                                    <button
                                        className="af-input"
                                        onClick={() => setShowDropdown(!showDropdown)}
                                        style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '8px',
                                            cursor: 'pointer',
                                            textAlign: 'left',
                                        }}
                                    >
                                        {currentContentType.icon}
                                        <span style={{ flex: 1 }}>{currentContentType.label}</span>
                                        <ChevronDown className={`w-4 h-4 transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
                                    </button>

                                    <div className={`af-dropdown-menu af-dropdown-menu-down ${showDropdown ? 'open' : ''}`}>
                                        {figureContentTypes.map(type => (
                                            <div
                                                key={type.value}
                                                className={`af-dropdown-item ${config.contentType === type.value ? 'active' : ''}`}
                                                onClick={() => {
                                                    updateConfig({ contentType: type.value })
                                                    setShowDropdown(false)
                                                }}
                                            >
                                                {type.icon}
                                                {type.label}
                                                {config.contentType === type.value && (
                                                    <Check className="w-4 h-4 ml-auto" />
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        )}

                        {/* Content Input */}
                        <div className="af-form-group" style={{ marginBottom: '16px' }}>
                            <label className="af-label">Content *</label>
                            <textarea
                                ref={textareaRef}
                                className="af-input"
                                value={inputText}
                                onChange={e => setInputText(e.target.value)}
                                onKeyDown={handleKeyDown}
                                placeholder="Paste your content here or upload a file..."
                                style={{
                                    minHeight: '180px',
                                    resize: 'vertical',
                                }}
                            />
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="af-start-error" style={{ marginBottom: '16px' }}>
                                <span>{error}</span>
                                <button onClick={clearError}>&times;</button>
                            </div>
                        )}

                        {/* Action Buttons Row */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <input
                                ref={fileInputRef}
                                type="file"
                                accept=".pdf,.txt,.md,.tex"
                                onChange={handleFileUpload}
                                className="hidden"
                                style={{ display: 'none' }}
                            />
                            <button
                                className="af-btn-secondary"
                                onClick={() => fileInputRef.current?.click()}
                                title="Upload file"
                                disabled={isPdfProcessing}
                                style={{ padding: '8px 12px' }}
                            >
                                <Paperclip className="w-4 h-4 mr-1 inline" />
                                Upload PDF
                            </button>

                            <button
                                className="af-btn-secondary"
                                onClick={() => setShowSettings(true)}
                                title="Settings"
                                style={{ padding: '8px 12px' }}
                            >
                                <Settings2 className="w-4 h-4 mr-1 inline" />
                                Settings
                            </button>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="af-modal-footer">
                        <button className="af-btn-secondary" onClick={onClose}>
                            Cancel
                        </button>
                        <button
                            className="af-btn-primary"
                            onClick={handleConfirm}
                            disabled={isPdfProcessing || !inputText.trim()}
                        >
                            {isPdfProcessing ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-1 inline animate-spin" />
                                    Processing PDF...
                                </>
                            ) : (
                                <>
                                    <ArrowRight className="w-4 h-4 mr-1 inline" />
                                    Confirm
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Settings Modal */}
            <SettingsModal
                isOpen={showSettings}
                onClose={() => setShowSettings(false)}
            />
        </>
    )
}
