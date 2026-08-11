/* Global type extensions for TEYEVO */

declare global {
  // Analytics consent flag
  var __teyevoAnalytics: boolean;

  // PWA install prompt
  interface Window {
    __uniraInstallPrompt?: BeforeInstallPromptEvent;
  }

  interface BeforeInstallPromptEvent extends Event {
    prompt(): Promise<void>;
    userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
  }
}

export {};
