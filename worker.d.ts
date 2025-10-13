declare module "*.worker.ts" {
  export default class WebpackWorker extends Worker {
    constructor();
  }
}
