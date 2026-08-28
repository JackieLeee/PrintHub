export type DesktopLocale = "en" | "zh";

export interface DesktopTranslations {
  menu: {
    edit: string;
    currentStatus: string;
    bridgeRunning: string;
    bridgeStopped: string;
    tcpListening: string;
    tcpNotListening: string;
    mdnsOn: string;
    mdnsOff: string;
    lanHttp: string;
    lanDisabled: string;
    lanStarting: string;
    bridgeNotRunning: string;
    openConsole: string;
    copyLanUrl: string;
    disableLanWeb: string;
    enableLanWeb: string;
    httpPortWithCurrent: string;
    httpPortLanOff: string;
    disableAutoLaunch: string;
    enableAutoLaunch: string;
    restartBridge: string;
    quit: string;
    trayHttpOff: string;
    language: string;
    languageEn: string;
    languageZh: string;
  };
  dialog: {
    missingWebUiTitle: string;
    missingWebUiMessage: string;
    bridgeStartFailedTitle: string;
    restartFailedTitle: string;
    uiStartFailedTitle: string;
    appStartFailedTitle: string;
    bridgeHttpFailed: string;
    bridgeFailed: string;
    lanHttpOffTitle: string;
    lanHttpOffMessage: string;
    menuBarPermTitle: string;
    menuBarPermMessage: string;
    menuBarPermDetail: string;
    openSystemSettings: string;
    dismissHint: string;
  };
  portPrompt: {
    title: string;
    hint: string;
    note: string;
    label: string;
    cancel: string;
    ok: string;
  };
}
