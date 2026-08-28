import type { UiThemeId } from "../lib/ui-themes.js";

export type Locale = "zh" | "en";

export interface Translations {
  lang: { label: string; zh: string; en: string };
  theme: { label: string; names: Record<UiThemeId, string> };
  toolbelt: {
    network: string;
    debug: string;
  };
  app: {
    title: string;
    subtitle: string;
    subtitleOffline: string;
    loadingHistory: string;
  };
  sections: {
    network: string;
    history: string;
    preview: string;
    debugPrint: string;
    debugPrintHint: string;
  };
  network: {
    localHub: string;
    listening: string;
    bridgeOnline: string;
    waitingBridge: string;
    posHint: string;
    noConnections: string;
    webSubscribe: string;
    portCount: string;
    wsLabel: string;
    reconnect: string;
    lanAccess: string;
    bridgeSetupTitle: string;
    bridgeSetupHint: string;
    bridgePlaceholder: string;
    bridgeConnect: string;
    httpDisabled: string;
    desktopTransport: string;
    desktopBridgeTitle: string;
    desktopBridgeHint: string;
    desktopTrayHint: string;
    desktopLanHttpToggle: string;
    desktopHttpPort: string;
    desktopDefaultHttpPort: string;
    desktopApplyPort: string;
    desktopCopyLan: string;
    desktopCopiedLan: string;
    desktopRestartBridge: string;
    mdnsHint: string;
  };
  sim: {
    title: string;
    hint: string;
    scenario: string;
    statusDelay: string;
    openDrawer: string;
    closeDrawer: string;
    drawerOpen: string;
    drawerClosed: string;
    events: string;
    eventsEmpty: string;
    bridgeRequired: string;
    scenarios: Record<
      "normal" | "paper-out" | "cover-open" | "offline" | "slow" | "reject-job",
      string
    >;
    eventKinds: Record<
      "status-poll" | "cash-drawer" | "job-rejected" | "scenario-change" | "manual-drawer",
      string
    >;
  };
  history: {
    empty: string;
    emptyHint: string;
    railEmptyHint: string;
    totalCount: string;
    receipt: string;
    receiptWithImage: string;
    label: string;
    labelWithSize: string;
  };
  preview: {
    empty: string;
    warnings: string;
    rendering: string;
    paperWidth: string;
    labelSize: string;
    rotateLeft: string;
    rotateRight: string;
    mirrorH: string;
    mirrorV: string;
    resetView: string;
  };
  samples: {
    previewEscPos: string;
    previewTspl: string;
    printing: string;
  };
  export: {
    download: string;
    copyHex: string;
    copyBase64: string;
    copyCommands: string;
    copiedHex: string;
    copiedBase64: string;
    copiedCommands: string;
    copiedCommandsPartial: string;
    downloaded: string;
    copyFailed: string;
  };
  rawPrint: {
    tabFile: string;
    tabHex: string;
    tabBase64: string;
    tabTspl: string;
    tabEscpos: string;
    pickFile: string;
    submitting: string;
    decodePreview: string;
    tsplPreview: string;
    escposPreview: string;
    localHint: string;
    hexPlaceholder: string;
    base64Placeholder: string;
    tsplPlaceholder: string;
    escposPlaceholder: string;
    escposHint: string;
    previewed: string;
    previewFailed: string;
    fileParseFailed: string;
    decodeFailed: string;
  };
  cmdRef: {
    titleTspl: string;
    titleEscpos: string;
    colCommand: string;
    colSyntax: string;
    colDesc: string;
    categories: {
      labelSetup: string;
      contentGraphics: string;
      printControl: string;
      hardwareOptions: string;
      initFeed: string;
      textStyle: string;
      barcodeImage: string;
      deviceControl: string;
    };
    labels: Record<string, string>;
    desc: Record<string, string>;
  };
}
