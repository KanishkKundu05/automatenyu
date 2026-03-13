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
  ScanSearch,
  Square,
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
const PAPER_COLOR = "#f9f4ea";
const DESKTOP_SIDEBAR_WIDTH = "w-[23.5rem]";
const DESKTOP_SIDEBAR_COLLAPSED_WIDTH = "w-[5.5rem]";

type PreparedPdf = {
  dataUrl: string;
  name: string;
  size: number;
  pageCount: number;
};

type PreparedReference = {
  dataUrl: string;
  name: string;
  size: number;
};

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  squareContext.fillStyle = PAPER_COLOR;
  squareContext.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

  const innerScale = Math.min(
    (CANVAS_SIZE - 140) / pageCanvas.width,
    (CANVAS_SIZE - 140) / pageCanvas.height
  );
  const drawWidth = pageCanvas.width * innerScale;
  const drawHeight = pageCanvas.height * innerScale;
  const drawX = (CANVAS_SIZE - drawWidth) / 2;
  const drawY = (CANVAS_SIZE - drawHeight) / 2;

  squareContext.fillStyle = "#fffdf8";
  squareContext.fillRect(drawX - 14, drawY - 14, drawWidth + 28, drawHeight + 28);
  squareContext.drawImage(pageCanvas, drawX, drawY, drawWidth, drawHeight);

  return {
    dataUrl: squareCanvas.toDataURL("image/png"),
    pageCount: pdf.numPages,
  };
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
  const [statusMessage, setStatusMessage] = useState(
    "Upload a PDF and a handwriting sample to generate a handwritten paper."
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastGeneratedAt, setLastGeneratedAt] = useState<string | null>(null);

  const pdfInputRef = useRef<HTMLInputElement>(null);
  const handwritingInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const activeCanvasImage = generatedImage ?? pdfFile?.dataUrl ?? null;
  const canGenerate =
    Boolean(pdfFile && referenceFile) &&
    !isGenerating &&
    !isPreparingPdf &&
    !isPreparingReference;
  const readyLabel = generatedImage
    ? "Result ready"
    : pdfFile && referenceFile
      ? "Ready to render"
      : pdfFile
        ? "Waiting on handwriting reference"
        : referenceFile
          ? "Waiting on PDF"
          : "Awaiting uploads";

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
      context.fillStyle = PAPER_COLOR;
      context.fillRect(0, 0, CANVAS_SIZE, CANVAS_SIZE);

      context.strokeStyle = "rgba(34, 54, 43, 0.06)";
      context.lineWidth = 1;
      for (let offset = 64; offset < CANVAS_SIZE; offset += 64) {
        context.beginPath();
        context.moveTo(offset, 0);
        context.lineTo(offset, CANVAS_SIZE);
        context.stroke();
        context.beginPath();
        context.moveTo(0, offset);
        context.lineTo(CANVAS_SIZE, offset);
        context.stroke();
      }

      context.fillStyle = "rgba(255, 255, 255, 0.68)";
      context.fillRect(48, 48, CANVAS_SIZE - 96, CANVAS_SIZE - 96);

      if (!activeCanvasImage) {
        context.strokeStyle = "rgba(43, 63, 52, 0.18)";
        context.setLineDash([14, 12]);
        context.lineWidth = 3;
        context.strokeRect(112, 112, CANVAS_SIZE - 224, CANVAS_SIZE - 224);
        context.setLineDash([]);
        context.fillStyle = "#214137";
        context.font =
          '600 34px "Iowan Old Style", "Palatino Linotype", "Book Antiqua", Palatino, Georgia, serif';
        context.textAlign = "center";
        context.fillText("Generated pages land here", CANVAS_SIZE / 2, 456);
        context.fillStyle = "rgba(33, 65, 55, 0.72)";
        context.font =
          '500 20px "JetBrains Mono", "Fira Code", "SF Mono", monospace';
        context.fillText(
          "Upload the homework PDF, add a handwriting reference, then render.",
          CANVAS_SIZE / 2,
          496
        );
        return;
      }

      try {
        const image = await loadImage(activeCanvasImage);
        if (cancelled) return;

        const maxWidth = CANVAS_SIZE - 144;
        const maxHeight = CANVAS_SIZE - 144;
        const scale = Math.min(maxWidth / image.width, maxHeight / image.height);
        const drawWidth = image.width * scale;
        const drawHeight = image.height * scale;
        const drawX = (CANVAS_SIZE - drawWidth) / 2;
        const drawY = (CANVAS_SIZE - drawHeight) / 2;

        context.shadowColor = "rgba(46, 34, 16, 0.12)";
        context.shadowBlur = 28;
        context.shadowOffsetY = 16;
        context.fillStyle = "#fffdf8";
        context.fillRect(drawX - 18, drawY - 18, drawWidth + 36, drawHeight + 36);
        context.shadowColor = "transparent";
        context.drawImage(image, drawX, drawY, drawWidth, drawHeight);

        context.fillStyle = "rgba(33, 65, 55, 0.92)";
        context.font =
          '600 20px "JetBrains Mono", "Fira Code", "SF Mono", monospace';
        context.textAlign = "left";
        context.fillText(
          generatedImage ? "generated result" : "source PDF preview",
          72,
          88
        );
      } catch {
        if (!cancelled) {
          context.fillStyle = "#8f4b31";
          context.font =
            '600 24px "JetBrains Mono", "Fira Code", "SF Mono", monospace';
          context.textAlign = "center";
          context.fillText(
            "Preview failed to load.",
            CANVAS_SIZE / 2,
            CANVAS_SIZE / 2
          );
        }
      }
    }

    void paintCanvas();

    return () => {
      cancelled = true;
    };
  }, [activeCanvasImage, generatedImage]);

  async function handlePdfFile(file: File) {
    if (file.type !== "application/pdf") {
      setErrorMessage("Upload a PDF for the homework answer.");
      return;
    }

    setIsPreparingPdf(true);
    setErrorMessage(null);
    setGeneratedImage(null);
    setStatusMessage("Rasterizing the PDF so it can be used as the base image.");

    try {
      const prepared = await preparePdfPreview(file);
      setPdfFile({
        dataUrl: prepared.dataUrl,
        name: file.name,
        size: file.size,
        pageCount: prepared.pageCount,
      });
      setStatusMessage(
        referenceFile
          ? "Inputs ready. Render a handwritten paper when you want."
          : "PDF ready. Add a handwriting reference."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare the uploaded PDF."
      );
    } finally {
      setIsPreparingPdf(false);
    }
  }

  async function handleReferenceFile(file: File) {
    if (!file.type.startsWith("image/")) {
      setErrorMessage("Upload an image sample of the user's handwriting.");
      return;
    }

    setIsPreparingReference(true);
    setErrorMessage(null);
    setStatusMessage("Preparing the handwriting sample as a photo reference.");

    try {
      const prepared = await prepareReferenceImage(file);
      setReferenceFile({
        dataUrl: prepared,
        name: file.name,
        size: file.size,
      });
      setStatusMessage(
        pdfFile
          ? "Inputs ready. Render a handwritten paper when you want."
          : "Handwriting reference ready. Upload a PDF next."
      );
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to prepare the handwriting reference."
      );
    } finally {
      setIsPreparingReference(false);
    }
  }

  async function handleGenerate() {
    if (!pdfFile || !referenceFile || isGenerating) return;

    setIsGenerating(true);
    setErrorMessage(null);
    setStatusMessage("Sending the homework page and handwriting reference to FLUX.2 Flex.");

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
        setLastGeneratedAt(
          new Date().toLocaleTimeString([], {
            hour: "numeric",
            minute: "2-digit",
          })
        );
        setStatusMessage("Handwritten paper rendered on the canvas.");
      });
    } catch (error) {
      setErrorMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the handwritten result."
      );
      setStatusMessage("Generation failed. Fix the issue and try again.");
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

  const sidebarSectionClass =
    "rounded-[1.4rem] border border-[color:var(--edge)] bg-[color:var(--panel)] p-4 shadow-[0_24px_60px_rgba(31,35,25,0.06)] backdrop-blur-xl";

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
          "flex items-center border-b border-[color:var(--edge)] px-4 py-4",
          collapsed ? "justify-center" : "justify-between gap-3 px-5"
        )}
      >
        {collapsed ? (
          <button
            className="flex size-12 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/70 text-[color:var(--ink)] transition hover:-translate-y-0.5 hover:bg-white"
            onClick={() => setSidebarCollapsed(false)}
            title="Expand sidebar"
            type="button"
          >
            <PanelLeftOpen className="size-4" />
          </button>
        ) : (
          <>
            <div className="space-y-1">
              <p className="text-[11px] uppercase tracking-[0.32em] text-[color:var(--muted)]">
                cheatnyu.com
              </p>
              <div>
                <h1
                  className="text-[1.55rem] leading-none text-[color:var(--ink)]"
                  style={{
                    fontFamily:
                      '"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
                  }}
                >
                  Handwritten HW
                </h1>
                <p className="mt-1 text-sm text-[color:var(--muted)]">
                  PDF intake for handwritten paper solutions.
                </p>
              </div>
            </div>
            <button
              className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/70 text-[color:var(--ink)] transition hover:-translate-y-0.5 hover:bg-white"
              onClick={() =>
                mobile ? setMobileSidebarOpen(false) : setSidebarCollapsed(true)
              }
              title={mobile ? "Close sidebar" : "Collapse sidebar"}
              type="button"
            >
              <PanelLeftClose className="size-4" />
            </button>
          </>
        )}
      </div>

      <div
        className={cn(
          "flex-1 space-y-4 overflow-y-auto px-4 py-5",
          collapsed && "px-3"
        )}
      >
        {collapsed ? (
          <>
            <button
              className="flex h-16 w-full items-center justify-center rounded-[1.35rem] border border-[color:var(--edge)] bg-white/70 text-[color:var(--ink)] shadow-[0_18px_45px_rgba(31,35,25,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
              onClick={() => pdfInputRef.current?.click()}
              title={pdfFile ? `Replace ${pdfFile.name}` : "Upload homework PDF"}
              type="button"
            >
              <div className="relative">
                <FileText className="size-5" />
                {pdfFile ? (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[color:var(--accent)]" />
                ) : null}
              </div>
            </button>
            <button
              className="flex h-16 w-full items-center justify-center rounded-[1.35rem] border border-[color:var(--edge)] bg-white/70 text-[color:var(--ink)] shadow-[0_18px_45px_rgba(31,35,25,0.05)] transition hover:-translate-y-0.5 hover:bg-white"
              onClick={() => handwritingInputRef.current?.click()}
              title={
                referenceFile
                  ? `Replace ${referenceFile.name}`
                  : "Add a handwriting reference"
              }
              type="button"
            >
              <div className="relative">
                <ImagePlus className="size-5" />
                {referenceFile ? (
                  <span className="absolute -right-1 -top-1 size-2.5 rounded-full bg-[color:var(--warm)]" />
                ) : null}
              </div>
            </button>
            <div
              className="flex h-16 w-full items-center justify-center rounded-[1.35rem] border border-[color:var(--edge)] bg-[color:var(--accentSoft)]/75 text-[color:var(--ink)]"
              title="FLUX.2 Flex • 1:1 • 1K"
            >
              <Sparkles className="size-5" />
            </div>
          </>
        ) : (
          <>
            <section className={sidebarSectionClass}>
              <div className="mb-3 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)] text-[color:var(--accent)]">
                  <FileText className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                    Homework PDF
                  </h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    Replaces the prompt with a clickable PDF upload skeleton.
                  </p>
                </div>
              </div>

              <button
                className="group relative flex min-h-44 w-full flex-col items-center justify-center gap-3 rounded-[1.35rem] border border-dashed border-[color:var(--edge)] bg-[linear-gradient(135deg,rgba(255,255,255,0.82),rgba(245,240,231,0.96))] px-5 py-6 text-center transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--accent)] hover:shadow-[0_18px_50px_rgba(41,76,63,0.12)]"
                onClick={() => pdfInputRef.current?.click()}
                type="button"
              >
                <div className="absolute inset-0 rounded-[1.35rem] bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.48),transparent)] opacity-0 transition group-hover:opacity-100" />
                <div className="relative flex size-15 items-center justify-center rounded-[1.4rem] border border-[color:var(--edge)] bg-white/85 text-[color:var(--accent)]">
                  {isPreparingPdf ? (
                    <LoaderCircle className="size-5 animate-spin" />
                  ) : (
                    <FileText className="size-5" />
                  )}
                </div>
                {pdfFile ? (
                  <div className="relative space-y-2">
                    <p className="text-sm font-semibold text-[color:var(--ink)]">
                      {pdfFile.name}
                    </p>
                    <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
                      {pdfFile.pageCount} page{pdfFile.pageCount === 1 ? "" : "s"} ·{" "}
                      {formatBytes(pdfFile.size)}
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Page 1 is rasterized into a square base image for generation.
                    </p>
                  </div>
                ) : (
                  <div className="relative space-y-2">
                    <p className="text-base font-semibold text-[color:var(--ink)]">
                      Upload your homework answer
                    </p>
                    <p className="text-sm text-[color:var(--muted)]">
                      Click to upload the PDF that should become a handwritten paper.
                    </p>
                  </div>
                )}
              </button>
            </section>

            <section className={sidebarSectionClass}>
              <button
                className="flex w-full items-center justify-between gap-3 text-left"
                onClick={() => setReferencesExpanded((open) => !open)}
                type="button"
              >
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-[#f0e4d8] text-[color:var(--warm)]">
                    <ImagePlus className="size-4" />
                  </div>
                  <div>
                    <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                      References
                    </h2>
                    <p className="text-xs text-[color:var(--muted)]">
                      Uses the photo reference of the user&apos;s handwriting.
                    </p>
                  </div>
                </div>
                {referencesExpanded ? (
                  <ChevronUp className="size-4 text-[color:var(--muted)]" />
                ) : (
                  <ChevronDown className="size-4 text-[color:var(--muted)]" />
                )}
              </button>

              {referencesExpanded ? (
                <div className="mt-4">
                  <button
                    className="group relative block w-full overflow-hidden rounded-[1.45rem] border border-[color:var(--edge)] bg-[linear-gradient(160deg,rgba(255,255,255,0.82),rgba(244,237,226,0.94))] p-3 text-left transition duration-200 hover:-translate-y-0.5 hover:border-[color:var(--warm)] hover:shadow-[0_18px_50px_rgba(135,91,47,0.14)]"
                    onClick={() => handwritingInputRef.current?.click()}
                    type="button"
                  >
                    <div className="relative aspect-[6/4] overflow-hidden rounded-[1.15rem] border border-[color:var(--edge)] bg-[#f7f1e4]">
                      {referenceFile ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          alt="Handwriting reference preview"
                          className="h-full w-full object-cover transition duration-300 group-hover:scale-[1.02]"
                          src={referenceFile.dataUrl}
                        />
                      ) : (
                        <div className="flex h-full w-full flex-col items-center justify-center gap-3 bg-[radial-gradient(circle_at_top,rgba(186,126,76,0.18),transparent_40%),linear-gradient(180deg,#faf4ea,#f1e6d9)]">
                          {isPreparingReference ? (
                            <LoaderCircle className="size-6 animate-spin text-[color:var(--warm)]" />
                          ) : (
                            <ImagePlus className="size-6 text-[color:var(--warm)]" />
                          )}
                          <p className="text-xs uppercase tracking-[0.32em] text-[color:var(--muted)]">
                            photo reference
                          </p>
                        </div>
                      )}
                      <div className="absolute inset-0 flex items-end bg-[linear-gradient(180deg,rgba(28,34,27,0.02),rgba(28,34,27,0.72))] p-4 opacity-0 transition duration-200 group-hover:opacity-100">
                        <p className="text-sm font-medium text-white">
                          add a sample of ur handwriting
                        </p>
                      </div>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <div>
                        <p className="text-sm font-semibold text-[color:var(--ink)]">
                          {referenceFile ? referenceFile.name : "Handwriting sample"}
                        </p>
                        <p className="text-xs uppercase tracking-[0.28em] text-[color:var(--muted)]">
                          {referenceFile
                            ? formatBytes(referenceFile.size)
                            : "jpg · png · webp"}
                        </p>
                      </div>
                      <span className="rounded-full border border-[color:var(--edge)] bg-white/80 px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[color:var(--muted)]">
                        photo ref
                      </span>
                    </div>
                  </button>
                </div>
              ) : null}
            </section>

            <section className={sidebarSectionClass}>
              <div className="mb-4 flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)] text-[color:var(--accent)]">
                  <Square className="size-4" />
                </div>
                <div>
                  <h2 className="text-sm font-semibold text-[color:var(--ink)]">
                    Output
                  </h2>
                  <p className="text-xs text-[color:var(--muted)]">
                    Model selection removed. FLUX.2 Flex is the default.
                  </p>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="rounded-[1.15rem] border border-[color:var(--edge)] bg-white/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                    model
                  </p>
                  <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">
                    FLUX.2 Flex
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    multi-reference image editing
                  </p>
                </div>
                <div className="rounded-[1.15rem] border border-[color:var(--edge)] bg-white/70 p-3">
                  <p className="text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                    canvas
                  </p>
                  <p className="mt-2 text-base font-semibold text-[color:var(--ink)]">
                    1:1 · 1K
                  </p>
                  <p className="mt-1 text-xs text-[color:var(--muted)]">
                    standard 1024 × 1024 output
                  </p>
                </div>
              </div>
              <div className="mt-3 rounded-[1.15rem] border border-[color:var(--edge)] bg-[color:var(--accentSoft)]/55 px-4 py-3 text-sm text-[color:var(--ink)]">
                The PDF becomes `input_image`. Your handwriting sample is sent as
                the photo reference on `input_image_2`.
              </div>
            </section>
          </>
        )}
      </div>

      <div className="border-t border-[color:var(--edge)] p-4">
        <button
          className={cn(
            "flex w-full items-center justify-center gap-3 rounded-[1.35rem] px-4 py-3.5 text-sm font-semibold transition",
            canGenerate
              ? "bg-[color:var(--accent)] text-white shadow-[0_18px_50px_rgba(41,76,63,0.28)] hover:-translate-y-0.5 hover:bg-[#27493e]"
              : "bg-[#d7ddd4] text-[#6a7268]"
          )}
          disabled={!canGenerate}
          onClick={() => {
            void handleGenerate();
            setMobileSidebarOpen(false);
          }}
          type="button"
        >
          {isGenerating ? (
            <LoaderCircle className="size-4 animate-spin" />
          ) : (
            <Sparkles className="size-4" />
          )}
          {!collapsed && (
            <span>
              {isGenerating ? "Generating handwritten paper" : "Generate"}
            </span>
          )}
        </button>
      </div>
    </div>
  );

  return (
    <div
      className="min-h-screen bg-[color:var(--paper)] text-[color:var(--ink)]"
      style={
        {
          "--paper": "#e9e0d0",
          "--panel": "rgba(255,255,255,0.72)",
          "--ink": "#1d2d26",
          "--muted": "#6b7166",
          "--accent": "#2f5b4b",
          "--accentSoft": "#dde8df",
          "--warm": "#b17445",
          "--edge": "rgba(29,45,38,0.1)",
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
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(47,91,75,0.17),transparent_34%),radial-gradient(circle_at_bottom_right,rgba(177,116,69,0.14),transparent_34%),linear-gradient(135deg,#f0e7d8,#e4d9c5)]" />
        <div className="absolute inset-0 opacity-30 [background-image:linear-gradient(rgba(29,45,38,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(29,45,38,0.05)_1px,transparent_1px)] [background-size:36px_36px]" />
      </div>

      <div className="relative flex min-h-screen">
        <aside
          className={cn(
            "hidden border-r border-[color:var(--edge)] bg-white/42 backdrop-blur-xl transition-[width] duration-300 lg:flex",
            sidebarCollapsed
              ? DESKTOP_SIDEBAR_COLLAPSED_WIDTH
              : DESKTOP_SIDEBAR_WIDTH
          )}
        >
          <SidebarContent collapsed={sidebarCollapsed} />
        </aside>

        <div
          className={cn(
            "fixed inset-0 z-30 bg-[rgba(18,22,18,0.18)] transition-opacity lg:hidden",
            mobileSidebarOpen
              ? "pointer-events-auto opacity-100"
              : "pointer-events-none opacity-0"
          )}
          onClick={() => setMobileSidebarOpen(false)}
        />

        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-40 w-[min(92vw,24rem)] border-r border-[color:var(--edge)] bg-[#f7f2e9]/95 backdrop-blur-xl transition-transform duration-300 lg:hidden",
            mobileSidebarOpen ? "translate-x-0" : "-translate-x-full"
          )}
        >
          <SidebarContent collapsed={false} mobile />
        </aside>

        <main className="flex min-w-0 flex-1 flex-col p-4 sm:p-5 lg:p-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                className="flex size-11 items-center justify-center rounded-2xl border border-[color:var(--edge)] bg-white/80 text-[color:var(--ink)] shadow-[0_18px_45px_rgba(31,35,25,0.06)] lg:hidden"
                onClick={() => setMobileSidebarOpen(true)}
                type="button"
              >
                <Menu className="size-4" />
              </button>
              <div>
                <p className="text-[11px] uppercase tracking-[0.34em] text-[color:var(--muted)]">
                  cheatnyu.com/handwritten-hw
                </p>
                <h2
                  className="mt-1 text-[2rem] leading-none text-[color:var(--ink)] sm:text-[2.45rem]"
                  style={{
                    fontFamily:
                      '"Iowan Old Style","Palatino Linotype","Book Antiqua",Palatino,Georgia,serif',
                  }}
                >
                  Handwritten paper generator
                </h2>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-[color:var(--edge)] bg-white/75 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--muted)]">
                {readyLabel}
              </span>
              <span className="rounded-full border border-[color:var(--edge)] bg-[color:var(--accentSoft)]/75 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                FLUX.2 Flex · 1:1 · 1K
              </span>
            </div>
          </div>

          <div className="mb-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <div className="rounded-[1.7rem] border border-[color:var(--edge)] bg-white/68 px-5 py-4 shadow-[0_24px_60px_rgba(31,35,25,0.08)] backdrop-blur-xl">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    Main canvas
                  </p>
                  <p className="mt-1 text-sm text-[color:var(--muted)]">
                    The PDF is ingested as the base image, the handwriting image
                    acts as the photo reference, and the rendered page lands here.
                  </p>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <button
                    className={cn(
                      "rounded-full border border-[color:var(--edge)] px-4 py-2 text-xs uppercase tracking-[0.24em] transition",
                      generatedImage
                        ? "bg-white text-[color:var(--ink)] hover:border-[color:var(--accent)]"
                        : "bg-[#edf0ea] text-[#95a093]"
                    )}
                    disabled={!generatedImage}
                    onClick={handleDownload}
                    type="button"
                  >
                    <span className="inline-flex items-center gap-2">
                      <Download className="size-3.5" />
                      Download
                    </span>
                  </button>
                </div>
              </div>
            </div>

            <div className="rounded-[1.7rem] border border-[color:var(--edge)] bg-white/68 px-5 py-4 shadow-[0_24px_60px_rgba(31,35,25,0.08)] backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-2xl bg-[color:var(--accentSoft)] text-[color:var(--accent)]">
                  <ScanSearch className="size-4" />
                </div>
                <div>
                  <p className="text-sm font-semibold text-[color:var(--ink)]">
                    Pipeline
                  </p>
                  <p className="text-sm text-[color:var(--muted)]">
                    PDF in, handwritten image out.
                  </p>
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-[color:var(--muted)]">
                Default settings are locked to FLUX.2 Flex, a 1:1 aspect ratio,
                and a standard 1024 × 1024 render. The API uses the PDF preview
                as `input_image` and the handwriting photo as `input_image_2`.
              </p>
            </div>
          </div>

          <div className="grid min-h-0 flex-1 gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
            <section className="relative min-h-[24rem] overflow-hidden rounded-[2rem] border border-[color:var(--edge)] bg-[linear-gradient(180deg,rgba(255,255,255,0.82),rgba(248,243,234,0.92))] p-3 shadow-[0_34px_90px_rgba(31,35,25,0.11)]">
              <div className="absolute inset-x-3 top-3 z-10 flex items-center justify-between gap-3 rounded-[1.2rem] border border-[color:var(--edge)] bg-white/78 px-4 py-3 backdrop-blur-lg">
                <div>
                  <p className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
                    canvas
                  </p>
                  <p className="mt-1 text-sm font-semibold text-[color:var(--ink)]">
                    {generatedImage ? "Generated handwritten sheet" : "Preview surface"}
                  </p>
                </div>
                <div className="rounded-full border border-[color:var(--edge)] bg-[color:var(--accentSoft)]/75 px-4 py-2 text-[11px] uppercase tracking-[0.28em] text-[color:var(--accent)]">
                  {generatedImage ? "result" : "preview"}
                </div>
              </div>

              <div className="flex h-full min-h-[24rem] items-center justify-center pt-20">
                <canvas
                  ref={canvasRef}
                  className="aspect-square max-h-full w-full rounded-[1.7rem] border border-[rgba(40,55,48,0.1)] bg-[#f9f4ea] object-contain shadow-[0_26px_80px_rgba(46,34,16,0.12)]"
                  height={CANVAS_SIZE}
                  width={CANVAS_SIZE}
                />
              </div>
            </section>

            <section className="space-y-4">
              <div className="rounded-[1.7rem] border border-[color:var(--edge)] bg-white/68 p-5 shadow-[0_24px_60px_rgba(31,35,25,0.08)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
                  status
                </p>
                <p className="mt-3 text-sm leading-6 text-[color:var(--ink)]">
                  {statusMessage}
                </p>
                {errorMessage ? (
                  <div className="mt-4 rounded-[1.2rem] border border-[#d6ad91] bg-[#f6e5d8] px-4 py-3 text-sm text-[#7f4a2a]">
                    {errorMessage}
                  </div>
                ) : null}
              </div>

              <div className="rounded-[1.7rem] border border-[color:var(--edge)] bg-white/68 p-5 shadow-[0_24px_60px_rgba(31,35,25,0.08)] backdrop-blur-xl">
                <p className="text-[11px] uppercase tracking-[0.3em] text-[color:var(--muted)]">
                  assets
                </p>
                <div className="mt-4 space-y-3">
                  <div className="rounded-[1.2rem] border border-[color:var(--edge)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--muted)]">
                      homework PDF
                    </p>
                    <p className="mt-2 text-sm font-medium text-[color:var(--ink)]">
                      {pdfFile ? pdfFile.name : "Nothing uploaded yet"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[color:var(--edge)] bg-white/80 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--muted)]">
                      handwriting ref
                    </p>
                    <p className="mt-2 text-sm font-medium text-[color:var(--ink)]">
                      {referenceFile ? referenceFile.name : "Add a handwriting sample"}
                    </p>
                  </div>
                  <div className="rounded-[1.2rem] border border-[color:var(--edge)] bg-[color:var(--accentSoft)]/75 px-4 py-3">
                    <p className="text-xs uppercase tracking-[0.26em] text-[color:var(--muted)]">
                      last render
                    </p>
                    <p className="mt-2 text-sm font-medium text-[color:var(--ink)]">
                      {lastGeneratedAt ?? "No render yet"}
                    </p>
                  </div>
                </div>
              </div>

              <button
                className={cn(
                  "flex w-full items-center justify-center gap-3 rounded-[1.45rem] px-5 py-4 text-sm font-semibold transition sm:hidden",
                  generatedImage
                    ? "border border-[color:var(--edge)] bg-white/78 text-[color:var(--ink)]"
                    : "bg-[#d7ddd4] text-[#6a7268]"
                )}
                disabled={!generatedImage}
                onClick={handleDownload}
                type="button"
              >
                <Download className="size-4" />
                Download result
              </button>
            </section>
          </div>
        </main>
      </div>
    </div>
  );
}
