export interface PathCommand {
  command: string;
  args: number[];
}

export type InteractivePathCommand = 'M' | 'L' | 'C' | 'Q' | 'Z';
