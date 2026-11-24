import React, { useEffect, useState } from 'react';
import { Button, Tooltip, message } from 'antd';
import { DownloadOutlined } from '@ant-design/icons';
import { useSystemSettings, useToken } from '@nocobase/client';
import { useTranslation } from 'react-i18next';

// The browser fires beforeinstallprompt when the app is installable.
let deferredPrompt: BeforeInstallPromptEvent | null = null;

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

export const PwaInstallButton: React.FC = () => {
  const { t } = useTranslation();
  const { token } = useToken();
  const [, setInstallable] = useState(false);
  const { data } = useSystemSettings();
  const title = data?.data?.title;
  const logoUrl = data?.data?.logo?.url;

  // Keep the document title in sync with the system setting
  useEffect(() => {
    if (title) {
      document.title = title;
    }
  }, [title]);

  // Inject or update apple-touch-icon link for iOS
  useEffect(() => {
    if (!logoUrl) return;
    let link = document.querySelector<HTMLLinkElement>('link[rel="apple-touch-icon"]');
    if (!link) {
      link = document.createElement('link');
      link.rel = 'apple-touch-icon';
      document.head.appendChild(link);
    }
    link.href = logoUrl;
  }, [logoUrl]);

  // Listen for the browser's deferred install prompt.
  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      deferredPrompt = e as BeforeInstallPromptEvent;
      setInstallable(true);

      // Auto-prompt the user on first event
      deferredPrompt.prompt();
    };

    window.addEventListener('beforeinstallprompt', handler);

    window.addEventListener('appinstalled', () => {
      deferredPrompt = null;
      setInstallable(false);
    });

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  // Inject manifest link, meta tags, and register service worker
  useEffect(() => {
    // Manifest link
    if (!document.querySelector<HTMLLinkElement>('link[rel="manifest"]')) {
      const manifestLink = document.createElement('link');
      manifestLink.rel = 'manifest';
      manifestLink.href = '/api/manifest.json';
      document.head.appendChild(manifestLink);
    }

    // Theme color
    if (!document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')) {
      const themeColor = document.createElement('meta');
      themeColor.name = 'theme-color';
      themeColor.content = '#1677ff';
      document.head.appendChild(themeColor);
    }

    // iOS: web app capable
    if (!document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-capable"]')) {
      const capable = document.createElement('meta');
      capable.name = 'apple-mobile-web-app-capable';
      capable.content = 'yes';
      document.head.appendChild(capable);
    }

    // iOS: status bar style
    if (!document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')) {
      const statusBar = document.createElement('meta');
      statusBar.name = 'apple-mobile-web-app-status-bar-style';
      statusBar.content = 'default';
      document.head.appendChild(statusBar);
    }

    // Register the service worker
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/api/sw.js', { scope: '/' }).catch(console.error);
    }
  }, []);

  const handleInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        deferredPrompt = null;
        setInstallable(false);
      }
    } else {
      message.info(
        t('To install this app, you can also use your browser menu (e.g. "Install app" or "Add to Home Screen").'),
      );
    }
  };

  return (
    <Tooltip title={t('Install app')}>
      <Button
        data-testid="pwa-install-button"
        type="text"
        icon={<DownloadOutlined />}
        onClick={handleInstall}
        aria-label={t('Install app')}
        style={{
          height: 46,
          width: 46,
          padding: 0,
          border: 0,
          borderRadius: 0,
          background: 'none',
          color: token.colorTextHeaderMenu || 'rgba(255, 255, 255, 0.65)',
          display: 'inline-flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
        }}
      />
    </Tooltip>
  );
};

export default PwaInstallButton;
