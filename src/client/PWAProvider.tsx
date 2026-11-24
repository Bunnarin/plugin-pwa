import React from 'react';
import { PinnedPluginListProvider, SchemaComponentOptions } from '@nocobase/client';
import { PwaInstallButton } from './PwaInstallButton';

export const PWAProvider: React.FC<{ children?: React.ReactNode }> = (props) => {
  return (
    <PinnedPluginListProvider
      items={{
        pwaInstallButton: {
          order: 250,
          component: PwaInstallButton,
          pin: true,
          snippet: '*',
        },
      }}
    >
      <SchemaComponentOptions
        components={{
          PwaInstallButton,
        }}
      >
        {props.children}
      </SchemaComponentOptions>
    </PinnedPluginListProvider>
  );
};

export default PWAProvider;
