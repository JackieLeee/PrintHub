export type CommandCategory =
  | "initialize"
  | "text"
  | "lineFeed"
  | "alignment"
  | "font"
  | "style"
  | "feed"
  | "lineSpacing"
  | "cut"
  | "image"
  | "rasterImage"
  | "qrCode"
  | "barcode"
  | "unsupported"
  | "raw";

export interface BaseCommand {
  id: string;
  index: number;
  category: CommandCategory;
  label: string;
  description: string;
  span: { offset: number; length: number };
  previewable: boolean;
  rawHex: string;
}

export interface TextCommand extends BaseCommand {
  category: "text";
  text: string;
}

export interface AlignmentCommand extends BaseCommand {
  category: "alignment";
  alignment: "left" | "center" | "right";
}

export interface FontCommand extends BaseCommand {
  category: "font";
  width: number;
  height: number;
  bold: boolean;
  underline: boolean;
}

export interface StyleCommand extends BaseCommand {
  category: "style";
  bold?: boolean;
  underline?: boolean;
}

export interface FeedCommand extends BaseCommand {
  category: "feed";
  lines: number;
}

export interface LineFeedCommand extends BaseCommand {
  category: "lineFeed";
}

export interface LineSpacingCommand extends BaseCommand {
  category: "lineSpacing";
  spacing: number | null;
}

export interface InitializeCommand extends BaseCommand {
  category: "initialize";
}

export interface CutCommand extends BaseCommand {
  category: "cut";
  mode: "full" | "partial";
}

export interface ImageCommand extends BaseCommand {
  category: "image" | "rasterImage";
  width: number;
  height: number;
  imageSize: number;
  imageDataUrl: string;
  mode: string;
}

export interface QrCodeCommand extends BaseCommand {
  category: "qrCode";
  model: number;
  size: number;
  errorCorrection: number;
  data: string;
}

export interface BarcodeCommand extends BaseCommand {
  category: "barcode";
  symbology: string;
  data: string;
  height: number;
  width: number;
  position: string;
}

export interface UnsupportedCommand extends BaseCommand {
  category: "unsupported";
  reason: string;
}

export type ParsedCommand =
  | TextCommand
  | AlignmentCommand
  | FontCommand
  | StyleCommand
  | FeedCommand
  | LineFeedCommand
  | LineSpacingCommand
  | InitializeCommand
  | CutCommand
  | ImageCommand
  | QrCodeCommand
  | BarcodeCommand
  | UnsupportedCommand;

export interface ParseResult {
  commands: ParsedCommand[];
  warnings: string[];
  paperWidth: number;
}

export interface RenderElement {
  commandId: string;
  type: "text" | "image" | "barcode" | "qr" | "feed" | "cut" | "spacer";
  y: number;
  height: number;
  x?: number;
  width?: number;
  content?: string;
  imageDataUrl?: string;
  alignment?: "left" | "center" | "right";
  fontSize?: number;
  bold?: boolean;
  underline?: boolean;
}

export interface RenderResult {
  elements: RenderElement[];
  canvasWidth: number;
  canvasHeight: number;
  imageDataUrl: string;
}
