import { z } from "zod"

export const problemOptionSchema = z.object({
  label: z.string().min(1, "選択肢を入力してください。"),
  isCorrect: z.boolean().default(false),
})

export const problemSchema = z
  .object({
    title: z.string().min(1, "タイトルは必須です。"),
    prompt: z.string().min(1, "問題文は必須です。"),
    type: z.enum(["single_choice", "multiple_choice", "text"]),
    options: z.array(problemOptionSchema).default([]),
    textAnswer: z.string().optional(),
    explanation: z.string().optional(),
  })
  .superRefine((data, ctx) => {
    const correctCount = data.options.filter((option) => option.isCorrect).length

    if (data.type === "text") {
      if (!data.textAnswer || data.textAnswer.trim().length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "記述式の模範解答を入力してください。",
          path: ["textAnswer"],
        })
      }
      if (data.options.length > 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "記述式では選択肢は不要です。",
          path: ["options"],
        })
      }
      return
    }

    if (data.options.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "選択肢は2つ以上必要です。",
        path: ["options"],
      })
    }

    if (data.type === "single_choice" && correctCount !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "正解は1つだけ選択してください。",
        path: ["options"],
      })
    }

    if (data.type === "multiple_choice" && correctCount < 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "正解を1つ以上選択してください。",
        path: ["options"],
      })
    }
  })

export type ProblemFormValues = z.infer<typeof problemSchema>

