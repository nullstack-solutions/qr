export interface CustomDotShape {
  id: string;
  name: string;
  emoji: string;
  renderPath: (x: number, y: number, size: number) => string;
}

export declare const SVG_NS: string;

export declare function clampSpacing(value: number): number;

export type CustomShapeFilter = (rect: SVGElement, width: number, height: number) => boolean;

export declare function applyDotSpacing(svg: SVGElement, spacing: number, filter?: CustomShapeFilter): void;

export declare const CUSTOM_DOT_SHAPES: CustomDotShape[];

export declare function applyCustomDotShape(
  svg: SVGElement,
  shapeId: string,
  spacing: number,
  filter?: CustomShapeFilter
): void;

export declare function isCustomDotShapeSupported(shapeId: unknown): shapeId is string;
