import { Plugin } from '@nocobase/client';
import { PWAProvider } from './PWAProvider';
import models from './models';

export class PluginPwaClient extends Plugin {
  async load() {
    this.flowEngine.registerModels(models);
    this.app.use(PWAProvider);
  }
}

export default PluginPwaClient;
