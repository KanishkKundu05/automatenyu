"use client";

import {
  ChevronDown,
  ChevronUp,
  Download,
  FileText,
  ImagePlus,
  LoaderCircle,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Sparkles,
} from "lucide-react";
import {
  startTransition,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";

const CANVAS_SIZE = 1024;
const CANVAS_BG = "#12071f";
const DESKTOP_SIDEBAR_WIDTH = "w-[23rem]";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "w-[5.5rem]";

type PreparedPdf = {
  dataUrl: string;
  name: string;
};

type PreparedReference = {
  dataUrl: string;
  name: string;
};

function mimeFromDataUrl(dataUrl: string) {
  const match = dataUrl.match(/^data:(.*?);base64,/);
  return match?.[1] ?? "image/png";
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error("Unable to read file."));
    reader.readAsDataURL(file);
  });
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Unable to load image preview."));
    image.src = src;
  });
}

async function prepareReferenceImage(file: File) {
  const originalDataUrl = await readFileAsDataUrl(file);
  const image = await loadImage(originalDataUrl);
  const scale = Math.min(1, CANVAS_SIZE / Math.max(image.width, image.height));
  const width = Math.max(16, Math.round(image.width * scale));
  const height = Math.max(16, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to prepare handwriting reference.");
  }

  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvas.toDataURL("image/jpeg", 0.92);
}

async function preparePdfPreview(file: File) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const documentInit = {
    data: await file.arrayBuffer(),
    disableWorker: true,
    useSystemFonts: true,
  } as Parameters<typeof pdfjs.getDocument>[0] & {
    disableWorker: boolean;
    useSystemFonts: boolean;
  };
  const loadingTask = pdfjs.getDocument(documentInit);
  const pdf = await loadingTask.promise;
  const firstPage = await pdf.getPage(1);
  const baseViewport = firstPage.getViewport({ scale: 1 });
  const targetBounds = CANVAS_SIZE - 160;
  const scale = Math.min(
    targetBounds / baseViewport.width,
    targetBounds / baseViewport.height
  );
  const viewport = firstPage.getViewport({ scale });

  const pageCanvas = document.createElement("canvas");
  pageCanvas.width = Math.ceil(viewport.width);
  pageCanvas.height = Math.ceil(viewport.height);
  const pageContext = pageCanvas.getContext("2d");
  if (!pageContext) {
    throw new Error("Unable to render the PDF preview.");
  }

  pageContext.fillStyle = "#ffffff";
  pageContext.fillRect(0, 0, pageCanvas.width, pageCanvas.height);
  const renderParameters = {
    canvas: pageCanvas,
    canvasContext: pageContext,
    viewport,
  } as Parameters<typeof firstPage.render>[0];

  await firstPage.render(renderParameters).promise;

  const squareCanvas = document.createElement("canvas");
  squareCanvas.width = CANVAS_SIZE;
  squareCanvas.height = CANVAS_SIZE;
  const squareContext = squareCanvas.getContext("2d");
  if (!squareContext) {
    throw new Error("Unable to prepare the uploaded homework preview.");
  }

  squareContext.fillStyle = "#f7f4ff";
  squareContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const innerScale = Math.min(
    (CANVAS_SIZE - 140) / pageCanvas.width,
    (CANVAS_SIZE - 140) / pageCanvas.height
  );
  const drawWidth = pageCanvas.width * innerScale;
  const drawHeight = pageCanvas.height * innerScale;
  const drawX = (CANVAS_SIZE - drawWidth) / 2;
  const drawY = (CANVAS_SIZE - drawHeight) / 2;

  squareContext.fillStyle = "#ffffff";
  squareContext.fillRect(drawX - 14, drawY - 14, drawWidth + 28, drawHeight + 28);
  squareContext.drawImage(pageCanvas, drawX, drawY, drawWidth, drawHeight);

  return squareCanvas.toDataURL("image/png");
}

function HiddenInputs({
  pdfInputRef,
  handwritingInputRef,
  onPdfChange,
  onReferenceChange,
}: {
  pdfInputRef: RefObject<HTMLInputElement | null>;
  handwritingInputRef: RefObject<HTMLInputElement | null>;
  onPdfChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onReferenceChange: (event: ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <>
      <input
        ref={pdfInputRef}
        accept="application/pdf"
        className="hidden"
        type="file"
        onChange={onPdfChange}
      />
      <input
        ref={handwritingInputRef}
        accept="image/png,image/jpeg,image/webp,image/heic,image/heif"
        className="hidden"
        type="file"
        onChange={onReferenceChange}
      />
    </>
  );
}

function StatusDot({
  active,
  accent = "var(--accent)",
  busy = false,
}: {
  active: boolean;
  accent?: string;
  busy?: boolean;
}) {
  return (
    <span
      className={cn(
        "block rounded-full border border-white/10 transition",
        busy ? "animate-pulse" : "",
        active ? "opacity-100 shadow-[0_0_22px_var(--accent-shadow)]" : "opacity-45"
      )}
      style={{
        width: 10,
        height: 10,
        background: active ? accent : "rgba(192,192,192,0.18)",
        ["--accent-shadow" as string]: active ? accent : "rgba(0,0,0,0)",
      }}
    />
  );
}

function PreviewPlate({
  icon,
  preview,
  active,
  busy = false,
  onClick,
}: {
  icon: React.ReactNode;
  preview?: string | null;
  active: boolean;
  busy?: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      className={cn(
        "group relative flex aspect-[5/4] w-full items-center justify-center overflow-hidden rounded-[1.4rem] border transition duration-200",
        active
          ? "border-[color:var(--edge-strong)] bg-[linear-gradient(160deg,rgba(139,92,246,0.14),rgba(45,27,78,0.82))] shadow-[0_18px_50px_rgba(139,92,246,0.16)]"
          : "border-[color:var(--edge)] bg-[linear-gradient(160deg,rgba(75,48,122,0.35),rgba(26,10,46,0.86))]",
        onClick ? "hover:-translate-y-0.5 hover:border-[color:var(--edge-strong)]" : ""
      )}
      onClick={onClick}
      type={onClick ? "button" : undefined}
    >
      {preview ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            alt=""
            className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
            src={preview}
          />
          <div className="absolute inset-0 bg-[linear-gradient(180deg,transparent,rgba(13,6,23,0.45))]" />
        </>
      ) : (
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,rgba(139,92,246,0.26),transparent_42%),linear-gradient(180deg,rgba(45,27,78,0.92),rgba(20,9,35,0.96))]" />
      )}

      <div className="absolute left-3 top-3 flex gap-1.5">
        <StatusDot active={active} busy={busy} />
        <StatusDot active={preview != null} accent="#c4b5fd" />
      </div>

      <div className="relative flex size-14 items-center justify-center rounded-[1.2rem] border border-white/10 bg-white/8 text-[color:var(--ink)] backdrop-blur">
        {busy ? <LoaderCircle className="size-5 animate-spin" /> : icon}
      </div>

      <span className="sr-only">Upload</span>
    </button>
  );
}

export default function HandwrittenHwStudio() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [referencesExpanded, setReferencesExpanded] = useState(true);
  const [pdfFile, setPdfFile] = useState<PreparedPdf | null>(null);
  const [referenceFile, setReferenceFile] = useState<PreparedReference | null>(
    null
  );
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [isPreparingPdf, setIsPreparingPdf] = useState(false);
  const [isPreparingReference, setIsPreparingReference] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [hasError, setHasError] = useState(false);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const handwritingInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeCanvasImage = generatedImage ?? pdfFile?.dataUrl ?? null;
  const canGenerate =
    Boolean(pdfFile && referenceFile) &&
    !isGenerating &&
    !isPreparingPdf &&
    !isPreparingReference;

  useEffect(() => {
    let cancelled = false;

    async function paintCanvas() {
      const canvas = canvasRef.current;
      if (!canvas) return;

      canvas.width = CANVAS_SIZE;
      canvas.height = CANVAS_SIZE;
      const context = canvas.getContext("2d");
      if (!context) return;

      context.clearRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);
      context.fillStyle = CANVAS_BG;
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      for (let offset = 72; offset < CANVAS_SIZE; offset += 72) {
        context.strokeStyle = "rgba(139, 92, 246, 0.08)";
        context.lineWidth = 1;
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset, CANVAS_SIZE);
        context.stroke();
        context.beginPath();
        context.moveTo(0, offset);
        context.lineTo(CANVAS_SIZE, offset);
        context.stroke();
      }

      if (!activeCanvasImage) {
        context.save();
        context.translate(CANVAS_SIZE / 2, CANVAS_SIZE / 2);
        context.strokeStyle = hasError
          ? "rgba(239, 68, 68, 0.65)"
          : "rgba(139, 92, 246, 0.4)";
        context.fillStyle = "rgba(139, 92, 246, 0.06)";
        context.lineWidth = 3;
        context.beginPath();
        context.roundRect(-288, -288, 576, 576, 44);
        context.fill();
        context.stroke();
        context.setLineDash([16, 14]);
        context.beginPath();
        context.roundRect(-220, -220, 440, 440, 36);
        context.stroke();
        context.setLineDash([]);

        const ringRadius = hasError ? 86 : 104;
        context.strokeStyle = hasError
          ? "rgba(239, 68, 68, 0.8)"
          : "rgba(139, 92, 246, 0.92)";
        context.fillStyle = hasError
          ? "rgba(239, 68, 68, 0.12)"
          : "rgba(139, 92, 246, 0.16)";
        context.beginPath();
        context.arc(0, 0, ringRadius, 0, Math.PI * 2);
        context.fill();
        context.stroke();
        context.restore();

        return;
      }

      try {
        const image = await loadImage(activeCanvasImage);
        if (cancelled) return;

        const maxWidth = CANVAS_SIZE - 136;
        const maxHeight = CANVAS_SIZE - 136;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const drawX = (CANVAS_SIZE - drawWidth) / 2;
        const drawY = (CANVAS_SIZE - drawHeight) / 2;

        context.shadowColor = generatedImage
          ? "rgba(139, 92, 246, 0.34)"
          : "rgba(139, 92, 246, 0.18)";
        context.shadowBlur = generatedImage ? 34 : 26;
        context.shadowOffsetY = 20;
        context.fillStyle = "#fbf8ff";
        context.fillRect(drawX - 18, drawY - 18, drawWidth + 36, drawHeight + 36);
        context.shadowColor = "transparent";
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        context.fillStyle = "rgba(139, 92, 246, 0.95)";
        context.beginPath();
        context.arc(drawX + 20, drawY + 20, 6, 0, Math.PI * 2);
        context.fill();

        context.fillStyle = "rgba(196, 181, 253, 0.95)";
        context.beginPath();
        context.arc(drawX + 40, drawY + 20, 6, 0, Math.PI * 2);
        context.fill();
      } catch (error) {
        if (!cancelled) {
          console.error(error);
          setHasError(true);
        }
      }
    }

    void paintCanvas();

    return () => {
      cancelled = true;
    };
  }, [activeCanvasImage, generatedImage, hasError]);

  async function handlePdfFile(file: File) {
    if (file.type !== "application/pdf") {
      setHasError(true);
      return;
    }

    setIsPreparingPdf(true);
    setHasError(false);
    setGeneratedImage(null);

    try {
      const prepared = await preparePdfPreview(file);
      setPdfFile({
        dataUrl: prepared,
        name: file.name,
      });
    } catch (error) {
      console.error(error);
      setHasError(true);
    } finally {
      setIsPreparingPdf(false);
    }
  }

  async function handleReferenceFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setHasError(true);
      return;
    }

    setIsPreparingReference(true);
    setHasError(false);

    try {
      const prepared = await prepareReferenceImage(file);
      setReferenceFile({
        dataUrl: prepared,
        name: file.name,
      });
    } catch (error) {
      console.error(error);
      setHasError(true);
    } finally {
      setIsPreparingReference(false);
    }
  }

  async function handleGenerate() {
    if (!pdfFile || !referenceFile || isGenerating) return;

    setIsGenerating(true);
    setHasError(false);

    try {
      const response = await fetch("/api/handwritten-hw", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          homeworkPreview: pdfFile.dataUrl,
          handwritingReference: referenceFile.dataUrl,
          homeworkMimeType: mimeFromDataUrl(pdfFile.dataUrl),
          handwritingMimeType: mimeFromDataUrl(referenceFile.dataUrl),
          pdfName: pdfFile.name,
          handwritingName: referenceFile.name,
        }),
      });

      const payload = (await response.json()) as
        | { imageDataUrl: string; model: string }
        | { error: string };

      if (!response.ok || !("imageDataUrl" in payload)) {
        throw new Error(
          "error" in payload ? payload.error : "Generation failed unexpectedly."
        );
      }

      startTransition(() => {
        setGeneratedImage(payload.imageDataUrl);
      });
    } catch (error) {
      console.error(error);
      setHasError(true);
    } finally {
      setIsGenerating(false);
    }
  }

  function handleDownload() {
    if (!generatedImage) return;
    const link = document.createElement("a");
    link.href = generatedImage;
    link.download = "handwritten-homework.png";
    link.click();
  }

  const panelClass =
    "rounded-[1.55rem] border border-[color:var(--edge)] bg-[color:var(--panel)] shadow-[0_24px_60px_rgba(0,0,0,0.28)] backdrop-blur-xl";

  const IconPill = ({
    children,
    active = false,
    danger = false,
  }: {
    children: React.ReactNode;
    active?: boolean;
    danger?: boolean;
  }) => (
    <div
      className={cn(
        "flex h-11 w-11 items-center justify-center rounded-2xl border transition",
        danger
          ? "border-red-400/30 bg-red-500/10 text-red-300"
          : active
            ? "border-[color:var(--edge-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
            : "border-[color:var(--edge)] bg-white/5 text-[color:var(--ink-soft)]"
      )}
    >
      {children}
    </div>
  );

  const SidebarContent = ({
    collapsed,
    mobile = false,
  }: {
    collapsed: boolean;
    mobile?: boolean;
  }) => (
    <div className="flex h-full flex-col">
      <div
        className={cn(
          "flex items-center border-b border-[color:var(--edge)] p-4",
          collapsed ? "justify-center" : "justify-between"
        )}
      >
        {collapsed ? (
          <button
            className="flex size-12 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/5 text-[color:var(--ink)] transition hover:border-[color:var(--edge-strong)] hover:bg-white/8"
            onClick={() => setSidebarCollapsed(false)}
            type="button"
          >
            <PanelLeftOpen className="size-4" />
            <span className="sr-only">Expand sidebar</span>
          </button>
        ) : (
          <>
            <div className="flex items-center gap-2">
              <span className="block size-2.5 rounded-full bg-[color:var(--accent)]" />
              <span className="block size-2.5 rounded-full bg-[#c4b5fd]" />
              <span className="block size-2.5 rounded-full bg-white/30" />
            </div>
            <button
              className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/5 text-[color:var(--ink)] transition hover:border-[color:var(--edge-strong)] hover:bg-white/8"
              onClick={() =>
                mobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(true)
              }
              type="button"
            >
              <PanelLeftClose className="size-4" />
              <span className="sr-only">
                {mobile ? "Close sidebar" : "Collapse sidebar"}
              </span>
            </button>
          </>
        )}
      </div>

      <div
        className={cn(
          "flex-1 space-y-4 overflow-y-auto p-4",
          collapsed ? "px-3" : "px-4"
        )}
      >
        {collapsed ? (
          <>
            <button
              className="flex h-16 w-full items-center justify-center rounded-[1.3rem] border border-[color:var(--edge)] bg-white/5 text-[color:var(--ink)] transition hover:border-[color:var(--edge-strong)] hover:bg-white/8"
              onClick={() => pdfInputRef.current?.click()}
              type="button"
            >
              <div className="relative">
                <FileText className="size-5" />
                {pdfFile ? (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[color:var(--accent)]" />
                ) : null}
              </div>
              <span className="sr-only">Upload PDF</span>
            </button>

            <button
              className="flex h-16 w-full items-center justify-center rounded-[1.3rem] border border-[color:var(--edge)] bg-white/5 text-[color:var(--ink)] transition hover:border-[color:var(--edge-strong)] hover:bg-white/8"
              onClick={() => handwritingInputRef.current?.click()}
              type="button"
            >
              <div className="relative">
                <ImagePlus className="size-5" />
                {referenceFile ? (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[#c4b5fd]" />
                ) : null}
              </div>
              <span className="sr-only">Upload handwriting reference</span>
            </button>

            <button
              className={cn(
                "flex h-16 w-full items-center justify-center rounded-[1.3rem] border transition",
                canGenerate
                  ? "border-[color:var(--edge-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent)]"
                  : "border-[color:var(--edge)] bg-white/5 text-[color:var(--ink-soft)]"
              )}
              disabled={!canGenerate}
              onClick={() => {
                void handleGenerate();
                setMobileSidebarOpen(false);
              }}
              type="button"
            >
              {isGenerating ? (
                <LoaderCircle className="size-5 animate-spin" />
              ) : (
                <Sparkles className="size-5" />
              )}
              <span className="sr-only">Generate</span>
            </button>
          </>
        ) : (
          <>
            <section className={cn(panelClass, "p-3")}>
              <PreviewPlate
                active={pdfFile != null}
                busy={isPreparingPdf}
                icon={<FileText className="size-5" />}
                onClick={() => pdfInputRef.current?.click()}
                preview={pdfFile?.dataUrl}
              />
            </section>

            <section className={cn(panelClass, "p-3")}>
              <button
                className="mb-3 flex w-full items-center justify-between rounded-[1.15rem] border border-transparent p-1 text-[color:var(--ink)] transition hover:border-[color:var(--edge)]"
                onClick={() => setReferencesExpanded((open) => !open)}
                type="button"
              >
                <div className="flex items-center gap-2">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-white/6">
                    <ImagePlus className="size-4" />
                  </div>
                  <div className="flex gap-1.5">
                    <StatusDot active={referenceFile != null} accent="#c4b5fd" />
                    <StatusDot
                      active={isPreparingReference}
                      accent="#8b5cf6"
                      busy={isPreparingReference}
                    />
                  </div>
                </div>
                {referencesExpanded ? (
                  <ChevronUp className="size-4 text-[color:var(--ink-soft)]" />
                ) : (
                  <ChevronDown className="size-4 text-[color:var(--ink-soft)]" />
                )}
                <span className="sr-only">Toggle reference section</span>
              </button>

              {referencesExpanded ? (
                <PreviewPlate
                  active={referenceFile != null}
                  busy={isPreparingReference}
                  icon={<ImagePlus className="size-5" />}
                  onClick={() => handwritingInputRef.current?.click()}
                  preview={referenceFile?.dataUrl}
                />
              ) : null}
            </section>

            <section className={cn(panelClass, "p-4")}>
              <div className="grid grid-cols-3 gap-3">
                <IconPill active>
                  <Sparkles className="size-4" />
                </IconPill>
                <IconPill active>
                  <div className="size-4 rounded-sm border border-current" />
                </IconPill>
                <IconPill active>
                  <div className="flex gap-1">
                    <span className="block size-1.5 rounded-full bg-current" />
                    <span className="block size-1.5 rounded-full bg-current" />
                    <span className="block size-1.5 rounded-full bg-current" />
                  </div>
                </IconPill>
              </div>
            </section>
          </>
        )}
      </div>

      <div className="border-t border-[color:var(--edge)] p-4">
        <button
          className={cn(
            "flex w-full items-center justify-center rounded-[1.35rem] border px-4 py-4 transition",
            canGenerate
              ? "border-[color:var(--edge-strong)] bg-[color:var(--accent)] text-white shadow-[0_18px_50px_rgba(139,92,246,0.28)] hover:bg-[#7c3aed]"
              : "border-[color:var(--edge)] bg-white/5 text-[color:var(--ink-soft)]"
          )}
          disabled={!canGenerate}
          onClick={() => {
            void handleGenerate();
            setMobileSidebarOpen(false);
          }}
          type="button"
        >
          {isGenerating ? (
            <LoaderCircle className="size-5 animate-spin" />
          ) : (
            <Sparkles className="size-5" />
          )}
          <span className="sr-only">Generate</span>
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]"
      style={
        {
          "--paper": "#1a0a2e",
          "--panel": "rgba(45,27,78,0.64)",
          "--ink": "#f5f0ff",
          "--ink-soft": "#a89acb",
          "--accent": "#8b5cf6",
          "--accent-soft": "rgba(139,92,246,0.16)",
          "--edge": "rgba(139,92,246,0.22)",
          "--edge-strong": "rgba(139,92,246,0.48)",
        } as CSSProperties
      }
    >
      <HiddenInputs
        handwritingInputRef={handwritingInputRef}
        onPdfChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handlePdfFile(file);
          }
          event.target.value = "";
        }}
        onReferenceChange={(event) => {
          const file = event.target.files?.[0];
          if (file) {
            void handleReferenceFile(file);
          }
          event.target.value = "";
        }}
        pdfInputRef={pdfInputRef}
      />

      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(139,92,246,0.22),transparent_30%),radial-gradient(circle_at_bottom_right,rgba(124,58,237,0.2),transparent_28%),linear-gradient(180deg,#1a0a2e,#140821)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(139,92,246,0.08)_1px,transparent_1px),linear-gradient(90deg,rgba(139,92,246,0.08)_1px,transparent_1px)] [background-size:38px_38px]" />
      </div>

      <div className="relative flex min-h-screen">
        <aside
          className={cn(
            "hidden border-r border-[color:var(--edge)] bg-[rgba(20,9,35,0.72)] backdrop-blur-xl transition-[width] duration-300 lg:flex",
            sidebarCollapsed
              ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH
              : DESKTOP_SIDEBAR_WIDTH
          )}
        >
          <SidebarContent collapsed={sidebarCollapsed} />
        </aside>

        <div
          className={cn(
            "fixed inset-0 z-30 bg-black/40 transition-opacity lg:hidden",
            mobileSidebarOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(92vw,24rem)] border-r border-[color:var(--edge)] bg-[rgba(20,9,35,0.95)] backdrop-blur-xl transition-transform duration-300 lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent collapsed={false} mobile />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/6 text-[color:var(--ink)] shadow-[0_18px_45px_rgba(0,0,0,0.22)] lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
              >
                <Menu className="size-4" />
                <span className="sr-only">Open sidebar</span>
              </button>

              <div className="flex items-center gap-2 rounded-full border border-[color:var(--edge)] bg-white/6 px-4 py-3">
                <StatusDot active={pdfFile != null} />
                <StatusDot active={referenceFile != null} accent="#c4b5fd" />
                <StatusDot active={generatedImage != null} accent="#ffffff" />
                <StatusDot active={hasError} accent="#ef4444" />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl border transition",
                  generatedImage
                    ? "border-[color:var(--edge-strong)] bg-white/6 text-[color:var(--ink)] hover:bg-white/10"
                    : "border-[color:var(--edge)] bg-white/4 text-[color:var(--ink-soft)]"
                )}
                disabled={!generatedImage}
                onClick={handleDownload}
                type="button"
              >
                <Download className="size-4" />
                <span className="sr-only">Download result</span>
              </button>
              <button
                className={cn(
                  "flex size-11 items-center justify-center rounded-2xl border transition sm:hidden",
                  canGenerate
                    ? "border-[color:var(--edge-strong)] bg-[color:var(--accent)] text-white"
                    : "border-[color:var(--edge)] bg-white/4 text-[color:var(--ink-soft)]"
                )}
                disabled={!canGenerate}
                onClick={() => void handleGenerate()}
                type="button"
              >
                {isGenerating ? (
                  <LoaderCircle className="size-4 animate-spin" />
                ) : (
                  <Sparkles className="size-4" />
                )}
                <span className="sr-only">Generate</span>
              </button>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_18rem]">
            <section
              className={cn(
                "relative min-h-[24rem] overflow-hidden rounded-[2rem] border p-3 shadow-[0_34px_90px_rgba(0,0,0,0.34)]",
                hasError
                  ? "border-red-400/30 bg-[linear-gradient(180deg,rgba(51,16,26,0.88),rgba(23,9,19,0.95))]"
                  : "border-[color:var(--edge)] bg-[linear-gradient(180deg,rgba(42,24,71,0.92),rgba(15,7,26,0.98))]"
              )}
            >
              <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between rounded-[1.2rem] border border-[color:var(--edge)] bg-black/18 px-4 py-3 backdrop-blur-lg">
                <div className="flex gap-2">
                  <StatusDot active={pdfFile != null} />
                  <StatusDot active={referenceFile != null} accent="#c4b5fd" />
                  <StatusDot
                    active={isGenerating}
                    accent="#ffffff"
                    busy={isGenerating}
                  />
                </div>
                <div className="flex gap-2">
                  <StatusDot active={generatedImage != null} accent="#ffffff" />
                  <StatusDot active={hasError} accent="#ef4444" />
                </div>
              </div>

              <div className="flex h-full min-h-[24rem] items-center justify-center pt-20">
                <canvas
                  ref={canvasRef}
                  className="aspect-square max-h-full w-full rounded-[1.7rem] border border-[color:var(--edge)] bg-[#12071f] object-contain shadow-[0_26px_80px_rgba(0,0,0,0.32)]"
                  height={CANVAS_SIZE}
                  width={CANVAS_SIZE}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className={cn(panelClass, "p-3")}>
                <PreviewPlate
                  active={pdfFile != null}
                  busy={isPreparingPdf}
                  icon={<FileText className="size-5" />}
                  preview={pdfFile?.dataUrl}
                />
              </div>

              <div className={cn(panelClass, "p-3")}>
                <PreviewPlate
                  active={referenceFile != null}
                  busy={isPreparingReference}
                  icon={<ImagePlus className="size-5" />}
                  preview={referenceFile?.dataUrl}
                />
              </div>

              <div className={cn(panelClass, "p-4")}>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    className={cn(
                      "flex h-16 items-center justify-center rounded-[1.3rem] border transition",
                      canGenerate
                        ? "border-[color:var(--edge-strong)] bg-[color:var(--accent-soft)] text-[color:var(--accent)] hover:bg-[rgba(139,92,246,0.22)]"
                        : "border-[color:var(--edge)] bg-white/4 text-[color:var(--ink-soft)]"
                    )}
                    disabled={!canGenerate}
                    onClick={() => void handleGenerate()}
                    type="button"
                  >
                    {isGenerating ? (
                      <LoaderCircle className="size-5 animate-spin" />
                    ) : (
                      <Sparkles className="size-5" />
                    )}
                    <span className="sr-only">Generate</span>
                  </button>

                  <button
                    className={cn(
                      "flex h-16 items-center justify-center rounded-[1.3rem] border transition",
                      generatedImage
                        ? "border-[color:var(--edge-strong)] bg-white/6 text-[color:var(--ink)] hover:bg-white/10"
                        : "border-[color:var(--edge)] bg-white/4 text-[color:var(--ink-soft)]"
                    )}
                    disabled={!generatedImage}
                    onClick={handleDownload}
                    type="button"
                  >
                    <Download className="size-5" />
                    <span className="sr-only">Download</span>
                  </button>
                </div>

                <div className="mt-4 flex items-center justify-between rounded-[1.3rem] border border-[color:var(--edge)] bg-white/4 px-4 py-3">
                  <div className="flex gap-2">
                    <StatusDot active={pdfFile != null} />
                    <StatusDot active={referenceFile != null} accent="#c4b5fd" />
                    <StatusDot active={generatedImage != null} accent="#ffffff" />
                  </div>
                  <div className="flex gap-2">
                    <StatusDot
                      active={isPreparingPdf}
                      accent="#8b5cf6"
                      busy={isPreparingPdf}
                    />
                    <StatusDot
                      active={isPreparingReference}
                      accent="#c4b5fd"
                      busy={isPreparingReference}
                    />
                    <StatusDot
                      active={isGenerating}
                      accent="#ffffff"
                      busy={isGenerating}
                    />
                    <StatusDot active={hasError} accent="#ef4444" />
                  </div>
                </div>
              </div>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
