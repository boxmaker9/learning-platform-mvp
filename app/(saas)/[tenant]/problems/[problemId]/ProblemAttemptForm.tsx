"use client"

import { useEffect, useMemo, useState } from "react"
import { useForm } from "react-hook-form"

import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Textarea } from "@/components/ui/textarea"

type ProblemOption = {
  id: string
  label: string
}

type ProblemAttemptFormProps = {
  tenant: string
  problemId: string
  type: "single_choice" | "multiple_choice" | "text"
  options: ProblemOption[]
  explanation?: string | null
  initialValues?: Partial<AttemptFormValues>
  locked?: boolean
  onSubmitted?: (result: {
    isCorrect: boolean | null
    userAnswerDisplay: string
    submittedValues: AttemptFormValues
  }) => void
}

type AttemptFormValues = {
  answerText: string
  selectedOptionId: string
  selectedOptionIds: Record<string, boolean>
}

function formatUserAnswerDisplay(
  type: "single_choice" | "multiple_choice" | "text",
  values: AttemptFormValues,
  options: ProblemOption[]
): string {
  if (type === "text") {
    const t = (values.answerText ?? "").trim()
    return t.length > 0 ? t : "（未入力）"
  }
  if (type === "single_choice") {
    if (!values.selectedOptionId) return "（未選択）"
    const opt = options.find((o) => o.id === values.selectedOptionId)
    return opt?.label ?? "（不明）"
  }
  const ids = Object.entries(values.selectedOptionIds)
    .filter(([, checked]) => checked)
    .map(([id]) => id)
  if (ids.length === 0) return "（未選択）"
  const labels = ids
    .map((id) => options.find((o) => o.id === id)?.label)
    .filter((label): label is string => Boolean(label))
  return labels.join("・")
}

export default function ProblemAttemptForm({
  tenant,
  problemId,
  type,
  options,
  explanation,
  initialValues,
  locked,
  onSubmitted,
}: ProblemAttemptFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)
  const [resultLabel, setResultLabel] = useState<"correct" | "incorrect" | "pending" | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [hasSubmitted, setHasSubmitted] = useState(false)

  const defaultValues = useMemo<AttemptFormValues>(
    () => ({
      answerText: "",
      selectedOptionId: "",
      selectedOptionIds: {},
      ...(initialValues ?? {}),
    }),
    [initialValues]
  )

  const { register, handleSubmit, setValue, watch, reset } = useForm<AttemptFormValues>({
    defaultValues,
  })

  useEffect(() => {
    reset(defaultValues)
    setError(null)
    setSuccess(null)
    setResultLabel(null)
    setHasSubmitted(Boolean(locked))
  }, [defaultValues, locked, reset])

  const selectedOptionIds = watch("selectedOptionIds")

  const onSubmit = handleSubmit(async (values) => {
    if (locked || hasSubmitted) return
    setError(null)
    setSuccess(null)
    setResultLabel(null)
    setIsSubmitting(true)

    const payload = {
      type,
      answerText: values.answerText,
      selectedOptionId: values.selectedOptionId,
      selectedOptionIds: Object.entries(values.selectedOptionIds)
        .filter(([, checked]) => checked)
        .map(([id]) => id),
    }

    try {
      const response = await fetch(
        `/api/tenants/${tenant}/problems/${problemId}/attempts`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        }
      )

      if (!response.ok) {
        const data = (await response.json()) as { message?: string }
        throw new Error(data.message ?? "送信に失敗しました。")
      }

      const data = (await response.json()) as {
        success?: boolean
        isCorrect: boolean | null
      }

      setSuccess("回答を送信しました。")
      if (data.isCorrect === true) {
        setResultLabel("correct")
      } else if (data.isCorrect === false) {
        setResultLabel("incorrect")
      } else {
        setResultLabel("pending")
      }
      setHasSubmitted(true)

      onSubmitted?.({
        isCorrect: data.isCorrect,
        userAnswerDisplay: formatUserAnswerDisplay(type, values, options),
        submittedValues: values,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : "通信エラーが発生しました。")
    } finally {
      setIsSubmitting(false)
    }
  })

  return (
    <form className="space-y-4" onSubmit={onSubmit} aria-busy={isSubmitting}>
      {type === "text" ? (
        <div className="space-y-2">
          <Label htmlFor="answerText">回答</Label>
          <Textarea id="answerText" {...register("answerText")} disabled={Boolean(locked || hasSubmitted)} />
        </div>
      ) : type === "single_choice" ? (
        <div className="space-y-3">
          <Label>選択肢</Label>
          <RadioGroup
            value={watch("selectedOptionId")}
            onValueChange={(value) => {
              if (locked || hasSubmitted) return
              setValue("selectedOptionId", value)
            }}
            className="space-y-2"
          >
            {options.map((option) => (
              <label
                key={option.id}
                className="flex items-center gap-2 rounded-md border border-cream-300 bg-white px-3 py-2 text-sm"
              >
                <RadioGroupItem value={option.id} disabled={Boolean(locked || hasSubmitted)} />
                <span>{option.label}</span>
              </label>
            ))}
          </RadioGroup>
        </div>
      ) : (
        <div className="space-y-3">
          <Label>選択肢</Label>
          {options.map((option) => (
            <label
              key={option.id}
              className="flex items-center gap-2 rounded-md border border-cream-300 bg-white px-3 py-2 text-sm"
            >
              <Checkbox
                checked={Boolean(selectedOptionIds?.[option.id])}
                onCheckedChange={(checked) =>
                  locked || hasSubmitted
                    ? undefined
                    : setValue(`selectedOptionIds.${option.id}`, checked === true)
                }
                disabled={Boolean(locked || hasSubmitted)}
              />
              <span>{option.label}</span>
            </label>
          ))}
        </div>
      )}

      {error ? (
        <p className="text-sm text-red-600" role="alert">
          {error}
        </p>
      ) : null}
      {success ? (
        <div className="space-y-2" role="status">
          <p className="text-sm text-emerald-600">{success}</p>
          {resultLabel === "correct" ? (
            <p className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">
              正解です
            </p>
          ) : null}
          {resultLabel === "incorrect" ? (
            <p className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm font-semibold text-red-800">
              不正解です
            </p>
          ) : null}
          {resultLabel === "pending" ? (
            <p className="rounded-md border border-cream-300 bg-cream-100 px-3 py-2 text-sm text-cream-900">
              記述問題のため、この場では正誤を表示できません。
            </p>
          ) : null}
          {explanation ? (
            <div className="rounded-md border border-cream-300 bg-white px-3 py-2 text-sm text-cream-900">
              <p className="mb-1 text-xs font-semibold text-cream-700">解説</p>
              <p className="whitespace-pre-wrap">{explanation}</p>
            </div>
          ) : null}
        </div>
      ) : null}

      <Button type="submit" disabled={isSubmitting || Boolean(locked || hasSubmitted)}>
        {locked || hasSubmitted ? "送信済み" : isSubmitting ? "送信中..." : "回答を送信"}
      </Button>
    </form>
  )
}

