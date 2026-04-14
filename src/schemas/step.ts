import { z } from "zod";

import { QuestionSpec } from "./question-types";

export const Step = z.object({
  questions: z.array(QuestionSpec).min(1)
});

export type Step = z.infer<typeof Step>;
