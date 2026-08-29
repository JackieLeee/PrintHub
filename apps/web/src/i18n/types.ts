import type { UiThemeId } from "../lib/ui-themes.js";

export type Locale = "zh" | "en";

export interface Translations {
  lang: { label: string; zh: string; en: string };
  theme: { label: string; names: Record<UiThemeId, string> };
  toolbelt: {
    network: string;
    debug: string;
  };
  workbench: {
    title: string;
    expand: string;
    collapse: string;
    connectionsShort: string;
  };
  app: {
    title: string;
    subtitle: string;
    subtitleOffline: string;
    loadingHistory: string;
  };
  desktopChrome: {
    windowControls: string;
    close: string;
    minimize: string;
    maximize: string;
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
    printDelay: string;
    blockPrintOnFault: string;
    liveState: string;
    liveOnline: string;
    livePaper: string;
    liveCover: string;
    liveQueue: string;
    stateOnline: string;
    stateOffline: string;
    stateOk: string;
    stateFault: string;
    tcpQueue: string;
    queueReceiving: string;
    queueQueued: string;
    queueProcessing: string;
    eventTabAll: string;
    eventTabPolls: string;
    eventTabJobs: string;
    eventTabDrawer: string;
    pollByte: string;
    openDrawer: string;
    closeDrawer: string;
    drawerOpen: string;
    drawerClosed: string;
    events: string;
    eventsEmpty: string;
    clearEvents: string;
    drawerSection: string;
    bridgeRequired: string;
    scenarios: Record<
      "normal" | "paper-out" | "cover-open" | "offline" | "slow" | "reject-job",
      string
    >;
    eventKinds: Record<
      | "status-poll"
      | "cash-drawer"
      | "job-rejected"
      | "job-completed"
      | "scenario-change"
      | "manual-drawer",
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
    durationMs: string;
    clear: string;
    clearConfirm: string;
  };
  preview: {
    empty: string;
    warnings: string;
    rendering: string;
    paperWidth: string;
    labelSize: string;
    durationMs: string;
    rotateLeft: string;
    rotateRight: string;
    mirrorH: string;
    mirrorV: string;
    resetView: string;
    dialectStar: string;
  };
  samples: {
    previewEscPos: string;
    previewTspl: string;
    printing: string;
  };
  export: {
    open: string;
    download: string;
    downloadPng: string;
    downloadPdf: string;
    copyHex: string;
    copyBase64: string;
    copyCommands: string;
    copiedHex: string;
    copiedBase64: string;
    copiedCommands: string;
    copiedCommandsPartial: string;
    downloaded: string;
    downloadedPng: string;
    downloadedPdf: string;
    downloadFailed: string;
    copyFailed: string;
  };
  exportDialog: {
    title: string;
    subtitle: string;
    tabHex: string;
    tabBase64: string;
    tabCommands: string;
    tabRaw: string;
    tabPng: string;
    tabPdf: string;
    copy: string;
    download: string;
    close: string;
    rawFilename: string;
    rawProtocol: string;
    rawSize: string;
    rawBytes: string;
    rawDescription: string;
  };
  inspector: {
    summary: string;
    payloadBytes: string;
    unsupportedBytes: string;
    warnings: string;
    filterLabel: string;
    filterAll: string;
    filterIssues: string;
    colCategory: string;
    colLabel: string;
    colOffset: string;
    colLength: string;
    colDetail: string;
    linkHint: string;
    linkRow: string;
    metaRow: string;
    blockCount: string;
    badgeSetup: string;
    badgeGroup: string;
    badgePreview: string;
    expandGroup: string;
    expandSetup: string;
    setupMulti: string;
    blockText: string;
    blockQrCode: string;
    blockBarcode: string;
    blockReverseStrip: string;
    blockRasterImage: string;
    cmdCategory: {
      initialize: string;
      alignment: string;
      font: string;
      style: string;
      text: string;
      lineFeed: string;
      lineSpacing: string;
      feed: string;
      cut: string;
      image: string;
      rasterImage: string;
      barcode: string;
      qrCode: string;
      codePage: string;
      cashDrawer: string;
      unsupported: string;
      size: string;
      gap: string;
      direction: string;
      reference: string;
      cls: string;
      print: string;
      box: string;
      bar: string;
      reverse: string;
      qrcode: string;
      bitmap: string;
      block: string;
      circle: string;
      ellipse: string;
      fileRef: string;
      codepage: string;
    };
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
    loadSample: string;
    loadEscPosSample: string;
    loadTsplSample: string;
    clearInput: string;
    clearInputConfirm: string;
    overwriteSampleTitle: string;
    overwriteSampleBody: string;
    overwriteConfirm: string;
    cancel: string;
    sampleLoaded: string;
    fileDropHint: string;
    tabSwitchTitle: string;
    tabSwitchBody: string;
    tabSwitchConfirm: string;
  };
  cmdRef: {
    titleTspl: string;
    titleEscpos: string;
    colCommand: string;
    colDialect: string;
    colSyntax: string;
    colDesc: string;
    dialectNoteEscpos: string;
    dialects: {
      standard: string;
      star: string;
      common: string;
    };
    categories: {
      labelSetup: string;
      contentGraphics: string;
      printControl: string;
      hardwareOptions: string;
      initFeed: string;
      textStyle: string;
      barcodeImage: string;
      deviceControl: string;
      starExtensions: string;
    };
    labels: Record<string, string>;
    desc: Record<string, string>;
  };
}
