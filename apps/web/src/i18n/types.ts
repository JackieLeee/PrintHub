export type Locale = "zh" | "en";

export interface Translations {
  lang: { label: string; zh: string; en: string };
  theme: { label: string };
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
  };
  history: {
    empty: string;
    emptyHint: string;
    railEmptyHint: string;
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
    printEscPos: string;
    printTspl: string;
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
    decodePrint: string;
    tsplPrint: string;
    escposPrint: string;
    hexPlaceholder: string;
    base64Placeholder: string;
    tsplPlaceholder: string;
    escposPlaceholder: string;
    escposHint: string;
    submitted: string;
    submitFailed: string;
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
