export type PlayerId = 1 | 2;
export type QuestionType = "single" | "boolean" | "matching" | "sequence" | "multi";

export interface Point { x: number; y: number; }

export interface BaseQuestion {
  id: string;
  type: QuestionType;
  chapter: number;
  title: string;
  stimulus: string;
  prompt: string;
  explanation: string;
}

export interface SingleQuestion extends BaseQuestion {
  type: "single";
  options: string[];
  correct: number;
}

export interface BooleanQuestion extends BaseQuestion {
  type: "boolean";
  correct: boolean;
}

export interface MatchPair { id: string; left: string; right: string; }
export interface MatchingQuestion extends BaseQuestion {
  type: "matching";
  pairs: MatchPair[];
}

export interface SequenceQuestion extends BaseQuestion {
  type: "sequence";
  options: string[];
  correctOrder: number[];
}

export interface MultiQuestion extends BaseQuestion {
  type: "multi";
  options: string[];
  correct: number[];
}

export type Question = SingleQuestion | BooleanQuestion | MatchingQuestion | SequenceQuestion | MultiQuestion;

export interface HandFrame {
  playerId: PlayerId;
  cursor: Point;
  pinch: boolean;
  pinchRatio: number;
  fist: boolean;
  fistScore: number;
  landmarks: Point[];
  seenAt: number;
}
