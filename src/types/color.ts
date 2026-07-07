export type RGB = {
  r: number;
  g: number;
  b: number;
};

export type CMYK = {
  c: number;
  m: number;
  y: number;
  k: number;
};

export type PrintViabilityStatus =
  | 'Likely printable/paintable'
  | 'May shift in print/paint'
  | 'Difficult to reproduce in print/paint';
