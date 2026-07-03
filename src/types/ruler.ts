export interface GuidelineData {
  id: string;
  orientation: 'v' | 'h';
  position: number;
}

export type GuidelineEvents = {
  RULER_VISIBILITY_CHANGED: { visible: boolean };
  RULER_GUIDELINE_ADD: { id: string; orientation: 'v' | 'h'; position: number };
  RULER_GUIDELINE_REMOVE: { id: string };
  RULER_GUIDELINE_MOVE: {
    id: string;
    orientation: 'v' | 'h';
    position: number;
  };
  RULER_GUIDELINES_VISIBILITY_CHANGED: {
    orientation: 'v' | 'h';
    visible: boolean;
  };
};
