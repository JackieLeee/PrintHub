export type Locale = "zh" | "en";

export interface Translations {
  lang: { label: string; zh: string; en: string };
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
  };
  history: {
    empty: string;
    emptyHint: string;
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
    copiedHex: string;
    copiedBase64: string;
    downloaded: string;
    copyFailed: string;
  };
  rawPrint: {
    tabFile: string;
    tabHex: string;
    tabBase64: string;
    pickFile: string;
    submitting: string;
    decodePrint: string;
    hexPlaceholder: string;
    base64Placeholder: string;
    submitted: string;
    submitFailed: string;
    fileParseFailed: string;
    decodeFailed: string;
  };
}
