"use client";

import {
  Download,
  FileText,
  ImageIcon,
  LoaderCircle,
  Plus,
  Sparkles,
  X,
} from "lucide-react";
import {
  startTransition,
  useRef,
  useState,
  type ChangeEvent,
  type RefObject,
} from "react";
import { cn } from "@/lib/utils";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";

const CANVAS_SIZE = 1024;

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
  squareContext.fillRect(
    drawX - 14,
    drawY - 14,
    drawWidth + 28,
    drawHeight + 28
  );
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

function UploadZone({
  onClick,
  busy = false,
}: {
  onClick: () => void;
  busy?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex aspect-square w-full items-center justify-center rounded-2xl border-2 border-dashed border-white/15 bg-transparent transition-colors hover:border-purple-400/40 hover:bg-white/[0.03]"
    >
      {busy ? (
        <LoaderCircle className="size-8 animate-spin text-white/30" />
      ) : (
        <Plus className="size-8 text-white/30" />
      )}
    </button>
  );
}

function ImageThumbnail({
  src,
  onRemove,
}: {
  src: string;
  onRemove: () => void;
}) {
  return (
    <div className="relative aspect-square w-full overflow-hidden rounded-2xl border border-white/10 bg-white/5">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img alt="" src={src} className="h-full w-full object-cover" />
      <button
        type="button"
        onClick={onRemove}
        className="absolute -right-1.5 -top-1.5 flex size-7 items-center justify-center rounded-full bg-neutral-700/90 text-white transition hover:bg-neutral-600"
      >
        <X className="size-3.5" />
      </button>
    </div>
  );
}

export default function HandwrittenHwStudio() {
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

  const canGenerate =
    Boolean(pdfFile && referenceFile) &&
    !isGenerating &&
    !isPreparingPdf &&
    !isPreparingReference;

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
      setPdfFile({ dataUrl: prepared, name: file.name });
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
      setReferenceFile({ dataUrl: prepared, name: file.name });
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
        headers: { "Content-Type": "application/json" },
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

  return (
    <SidebarProvider
      defaultOpen={true}
      style={
        {
          "--sidebar-width": "18rem",
        } as React.CSSProperties
      }
    >
      <HiddenInputs
        handwritingInputRef={handwritingInputRef}
        onPdfChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handlePdfFile(file);
          event.target.value = "";
        }}
        onReferenceChange={(event) => {
          const file = event.target.files?.[0];
          if (file) void handleReferenceFile(file);
          event.target.value = "";
        }}
        pdfInputRef={pdfInputRef}
      />

      <Sidebar collapsible="offcanvas" className="border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border px-4 py-4">
          <div className="flex items-center gap-2.5">
            <div className="flex size-8 items-center justify-center rounded-lg bg-purple-500/15">
              <Sparkles className="size-4 text-purple-400" />
            </div>
            <span className="text-sm font-semibold tracking-tight text-sidebar-foreground">
              Handwriter
            </span>
          </div>
        </SidebarHeader>

        <SidebarContent className="px-2">
          {/* Prompt / PDF Upload */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-white/40">
              Homework
            </SidebarGroupLabel>
            <SidebarGroupContent>
              {pdfFile ? (
                <div className="relative overflow-hidden rounded-xl border border-white/10 bg-white/5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    alt=""
                    src={pdfFile.dataUrl}
                    className="aspect-[4/3] w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setPdfFile(null);
                      setGeneratedImage(null);
                    }}
                    className="absolute right-2 top-2 flex size-7 items-center justify-center rounded-full bg-black/60 text-white transition hover:bg-black/80"
                  >
                    <X className="size-3.5" />
                  </button>
                  <div className="border-t border-white/10 px-3 py-2">
                    <p className="truncate text-xs text-white/50">
                      {pdfFile.name}
                    </p>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => pdfInputRef.current?.click()}
                  className="flex w-full items-center gap-3 rounded-xl border border-white/10 bg-white/[0.03] px-3 py-3 text-left transition hover:border-purple-400/30 hover:bg-white/[0.05]"
                >
                  <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-purple-500/10">
                    {isPreparingPdf ? (
                      <LoaderCircle className="size-4 animate-spin text-purple-400" />
                    ) : (
                      <FileText className="size-4 text-purple-400" />
                    )}
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white/80">
                      Upload PDF
                    </p>
                    <p className="text-xs text-white/35">
                      Homework to convert
                    </p>
                  </div>
                </button>
              )}
            </SidebarGroupContent>
          </SidebarGroup>

          {/* References */}
          <SidebarGroup>
            <SidebarGroupLabel className="text-[11px] uppercase tracking-widest text-white/40">
              <ImageIcon className="mr-1.5 size-3.5" />
              References
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="grid grid-cols-2 gap-2.5">
                {referenceFile && (
                  <ImageThumbnail
                    src={referenceFile.dataUrl}
                    onRemove={() => setReferenceFile(null)}
                  />
                )}
                <UploadZone
                  onClick={() => handwritingInputRef.current?.click()}
                  busy={isPreparingReference}
                />
              </div>
              <p className="mt-2 text-[11px] text-white/30">
                Add your handwriting sample
              </p>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-3">
          {hasError && (
            <p className="mb-2 text-center text-xs text-red-400">
              Something went wrong. Please try again.
            </p>
          )}
          <Button
            className={cn(
              "w-full rounded-xl py-5 text-sm font-medium",
              canGenerate
                ? "bg-purple-600 text-white shadow-[0_8px_30px_rgba(139,92,246,0.3)] hover:bg-purple-500"
                : "bg-white/5 text-white/30"
            )}
            disabled={!canGenerate}
            onClick={() => void handleGenerate()}
          >
            {isGenerating ? (
              <LoaderCircle className="mr-2 size-4 animate-spin" />
            ) : (
              <Sparkles className="mr-2 size-4" />
            )}
            Generate
          </Button>
        </SidebarFooter>
      </Sidebar>

      <SidebarInset className="bg-[#0f0618]">
        {/* Top bar */}
        <div className="flex h-14 items-center justify-between border-b border-sidebar-border px-4">
          <SidebarTrigger className="text-white/50 hover:text-white/80" />
          <button
            type="button"
            className={cn(
              "flex size-9 items-center justify-center rounded-lg border transition",
              generatedImage
                ? "border-purple-500/30 bg-purple-500/10 text-purple-300 hover:bg-purple-500/20"
                : "border-white/10 bg-white/5 text-white/20"
            )}
            disabled={!generatedImage}
            onClick={handleDownload}
          >
            <Download className="size-4" />
          </button>
        </div>

        {/* Canvas area */}
        <div className="flex flex-1 items-center justify-center p-6">
          {generatedImage ? (
            <div className="relative max-h-full max-w-full overflow-hidden rounded-2xl border border-white/10 shadow-[0_20px_60px_rgba(0,0,0,0.5)]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                alt="Generated handwritten homework"
                src={generatedImage}
                className="max-h-[calc(100vh-8rem)] object-contain"
              />
            </div>
          ) : null}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
