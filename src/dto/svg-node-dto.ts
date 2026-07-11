export interface SvgNodeDto {
  id: string;
  tag: string;
  groupPath: number[];
  properties: Record<string, string>;
  svgFileId: string | null;
  svgGroupId: string | null;
  laserGroupId: string | null;
  laserActionType: string;
}
