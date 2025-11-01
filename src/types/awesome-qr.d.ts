declare module "awesome-qr/dist/awesome-qr.js" {
  export interface AwesomeQROptions {
    text: string;
    size?: number;
    margin?: number;
    correctLevel?: number;
    maskPattern?: number;
    version?: number;
    colorDark?: string;
    colorLight?: string;
    autoColor?: boolean;
    backgroundImage?: string;
    backgroundDimming?: string;
    gifBackground?: ArrayBuffer;
    whiteMargin?: boolean;
    logoImage?: string;
    logoScale?: number;
    logoMargin?: number;
    logoCornerRadius?: number;
    dotScale?: number;
    components?: {
      data?: { scale?: number };
      timing?: { scale?: number; protectors?: boolean };
      alignment?: { scale?: number; protectors?: boolean };
      cornerAlignment?: { scale?: number; protectors?: boolean };
    };
  }

  export class AwesomeQR {
    static CorrectLevel: {
      L: number;
      M: number;
      Q: number;
      H: number;
    };

    constructor(options: Partial<AwesomeQROptions>);

    draw(): Promise<string | ArrayBuffer | Uint8Array | null | undefined>;
  }

  export { AwesomeQR as default };
}
