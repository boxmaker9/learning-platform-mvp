"use client"

import { useEffect, useId, useMemo, useState } from "react"
import Link from "next/link"
import { useParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { Eye, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Separator } from "@/components/ui/separator"
import { Textarea } from "@/components/ui/textarea"
import { problemSchema, type ProblemFormValues } from "@/lib/validators/problem"

const typeLabels: Record<ProblemFormValues["type"], string> = {
  single_choice: "択一式",
  multiple_choice: "複数選択",
  text: "記述式",
}

type OptionRow = {
  id: string
  label: string
  is_correct: boolean
}

type ProblemRow = {
  id: string
  title: string
  prompt: string | null
  type: ProblemFormValues["type"]
  answer_text: string | null
  explanation: string | null
  tags: string[] | null
}

const blankValues: ProblemFormValues = {
  title: "",
  prompt: "",
  type: "single_choice",
  tags: [],
  options: [
    { label: "", isCorrect: true },
    { label: "", isCorrect: false },
  ],
  textAnswer: "",
  explanation: "",
}

export default function ProblemEditPage() {
  const params = useParams()
  const tenant =
    typeof params.tenant === "string"
      ? params.tenant
      : Array.isArray(params.tenant)
        ? params.tenant[0]
        : ""
  const problemId =
    typeof params.problemId === "string"
      ? params.problemId
      : Array.isArray(params.problemId)
        ? params.problemId[0]
        : ""

  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [tagsTextInput, setTagsTextInput] = useState("")
  const radioNamePrefix = useId()

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema),
    defaultValues: blankValues,
    mode: "onBlur",
  })

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "options",
  })

  const type = watch("type")
  const options = watch("options")

  useEffect(() => {
    if (!tenant || !problemId) return
    let cancelled = false

    const run = async () => {
      setLoadError(null)
      try {
        const response = await fetch(`/api/tenants/${tenant}/problems/${problemId}`)
        if (!response.ok) {
          const payload = (await response.json()) as { message?: string }
          throw new Error(payload.message ?? "読み込みに失敗しました。")
        }

        const payload = (await response.json()) as {
          problem: ProblemRow
          options: OptionRow[]
        }

        if (cancelled) return

        const p = payload.problem
        const opts = payload.options ?? []

        const initial: ProblemFormValues = {
          title: p.title ?? "",
          prompt: p.prompt ?? "",
          type: p.type,
          tags: Array.isArray(p.tags) ? p.tags : [],
          options:
            p.type === "text"
              ? []
              : opts.map((o) => ({ label: o.label, isCorrect: Boolean(o.is_correct) })),
          textAnswer: p.type === "text" ? (p.answer_text ?? "") : "",
          explanation: p.explanation ?? "",
        }

        reset(initial)
        setTagsTextInput((initial.tags ?? []).join(", "))
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "読み込みに失敗しました。")
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [tenant, problemId, reset])

  useEffect(() => {
    if (type === "text") {
      if (fields.length > 0) {
        replace([])
      }
      return
    }

    if (fields.length === 0) {
      replace([
        { label: "", isCorrect: true },
        { label: "", isCorrect: false },
      ])
    }
  }, [type, fields.length, replace])

  const singleCorrectRadioName = useMemo(
    () => `pf-single-correct-${problemId || "edit"}`,
    [problemId]
  )

  const handleSingleChoiceSelect = (index: number) => {
    const n = fields.length
    for (let optionIndex = 0; optionIndex < n; optionIndex++) {
      setValue(`options.${optionIndex}.isCorrect`, optionIndex === index, {
        shouldValidate: true,
      })
    }
  }

  const handleRemoveOption = (index: number) => {
    remove(index)
    setTimeout(() => {
      const currentOptions = watch("options")
      const hasCorrect = currentOptions.some((option) => option.isCorrect)
      if (type === "single_choice" && !hasCorrect && currentOptions.length > 0) {
        setValue("options.0.isCorrect", true, { shouldValidate: true })
      }
    }, 0)
  }

  const onSubmit = handleSubmit(async (values) => {
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const response = await fetch(`/api/tenants/${tenant}/problems/${problemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "保存に失敗しました。")
      }

      setSubmitSuccess(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "通信エラーが発生しました。")
    }
  })

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>小問を編集</CardTitle>
          <CardDescription>既存の小問を編集できます。</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <Button asChild variant="secondary">
            <Link href={`/${tenant}/admin/problems/${problemId}`}>詳細へ戻る</Link>
          </Button>
          <Button asChild variant="secondary">
            <Link href={`/${tenant}/admin/problems`}>一覧へ戻る</Link>
          </Button>
        </CardContent>
      </Card>

      <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
        <Card>
          <CardHeader>
            <CardTitle>編集内容</CardTitle>
            <CardDescription>保存すると受講者側にも反映されます。</CardDescription>
          </CardHeader>
          <CardContent>
            {loadError ? (
              <p className="text-sm text-red-600" role="alert">
                {loadError}
              </p>
            ) : null}
            <form className="space-y-6" onSubmit={onSubmit} aria-busy={isSubmitting}>
              <div className="space-y-2">
                <Label htmlFor="title">タイトル</Label>
                <Input id="title" {...register("title")} />
                {errors.title ? (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.title.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="prompt">問題文</Label>
                <Textarea id="prompt" {...register("prompt")} />
                {errors.prompt ? (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.prompt.message}
                  </p>
                ) : null}
              </div>

              <div className="space-y-2">
                <Label htmlFor="tagsText">カテゴリタグ (任意)</Label>
                <Input
                  id="tagsText"
                  placeholder="例: ネットワーク, 基礎, SB"
                  value={tagsTextInput}
                  onChange={(event) => setTagsTextInput(event.currentTarget.value)}
                  onBlur={(event) => {
                    const raw = event.currentTarget.value
                    const tags = raw
                      .split(",")
                      .map((t) => t.trim())
                      .filter(Boolean)
                    setValue("tags", Array.from(new Set(tags)), { shouldValidate: true })
                  }}
                />
                {errors.tags ? (
                  <p className="text-sm text-red-600" role="alert">
                    {errors.tags.message as string}
                  </p>
                ) : null}
                <p className="text-xs text-cream-700">カンマ区切りで複数指定できます。</p>
              </div>

              <fieldset className="space-y-3" aria-describedby="type-help">
                <legend className="text-sm font-medium">問題タイプ</legend>
                <p id="type-help" className="text-xs text-cream-700">
                  形式を変更すると、必要な入力が変わります。
                </p>
                <RadioGroup
                  name={`${radioNamePrefix}-problem-type`}
                  value={type}
                  onValueChange={(value) =>
                    setValue("type", value as ProblemFormValues["type"], {
                      shouldValidate: true,
                    })
                  }
                  className="grid gap-3 sm:grid-cols-3"
                >
                  {Object.entries(typeLabels).map(([value, label]) => (
                    <label
                      key={value}
                      className="flex items-center gap-2 rounded-md border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
                    >
                      <RadioGroupItem value={value} aria-label={label} />
                      <span>{label}</span>
                    </label>
                  ))}
                </RadioGroup>
              </fieldset>

              {type === "text" ? (
                <div className="space-y-2">
                  <Label htmlFor="textAnswer">模範解答</Label>
                  <Textarea id="textAnswer" {...register("textAnswer")} />
                  {errors.textAnswer ? (
                    <p className="text-sm text-red-600" role="alert">
                      {errors.textAnswer.message}
                    </p>
                  ) : null}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium">選択肢</p>
                      <p className="text-xs text-cream-700">正解を設定しながら編集できます。</p>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      onClick={() => append({ label: "", isCorrect: false })}
                    >
                      <Plus className="h-4 w-4" aria-hidden="true" />
                      追加
                    </Button>
                  </div>

                  {typeof errors.options?.message === "string" ? (
                    <p className="text-sm text-red-600" role="alert">
                      {errors.options.message}
                    </p>
                  ) : null}

                  {type === "single_choice" ? (
                    <div className="space-y-3" role="radiogroup" aria-label="正解の選択肢">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex flex-col gap-2 rounded-md border border-cream-300 bg-cream-50 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              placeholder={`選択肢 ${index + 1}`}
                              {...register(`options.${index}.label`)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="self-start text-red-600 hover:text-red-700"
                              onClick={() => handleRemoveOption(index)}
                              aria-label={`選択肢 ${index + 1} を削除`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>

                          <label className="flex cursor-pointer items-center gap-2 text-sm text-cream-800">
                            <input
                              type="radio"
                              name={singleCorrectRadioName}
                              checked={Boolean(options?.[index]?.isCorrect)}
                              onChange={() => handleSingleChoiceSelect(index)}
                              className="h-4 w-4 shrink-0 cursor-pointer rounded-full border border-gray-300 text-primary-600 accent-primary-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary-400"
                              aria-label={`選択肢 ${index + 1} を正解に設定`}
                            />
                            正解に設定
                          </label>

                          {errors.options?.[index]?.label ? (
                            <p className="text-xs text-red-600" role="alert">
                              {errors.options[index]?.label?.message}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {fields.map((field, index) => (
                        <div
                          key={field.id}
                          className="flex flex-col gap-2 rounded-md border border-cream-300 bg-cream-50 p-3"
                        >
                          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
                            <Input
                              placeholder={`選択肢 ${index + 1}`}
                              {...register(`options.${index}.label`)}
                            />
                            <Button
                              type="button"
                              variant="ghost"
                              className="self-start text-red-600 hover:text-red-700"
                              onClick={() => handleRemoveOption(index)}
                              aria-label={`選択肢 ${index + 1} を削除`}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden="true" />
                            </Button>
                          </div>

                          <Controller
                            control={control}
                            name={`options.${index}.isCorrect`}
                            render={({ field: checkboxField }) => (
                              <label className="flex items-center gap-2 text-sm text-cream-800">
                                <Checkbox
                                  checked={checkboxField.value}
                                  onCheckedChange={(checked) =>
                                    checkboxField.onChange(checked === true)
                                  }
                                  aria-label="正解に設定"
                                />
                                正解に設定
                              </label>
                            )}
                          />

                          {errors.options?.[index]?.label ? (
                            <p className="text-xs text-red-600" role="alert">
                              {errors.options[index]?.label?.message}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="explanation">解説 (任意)</Label>
                <Textarea id="explanation" {...register("explanation")} />
              </div>

              <Separator />

              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-sm text-cream-700">
                  {submitSuccess ? (
                    <span className="text-emerald-600">保存が完了しました。</span>
                  ) : null}
                  {submitError ? (
                    <span className="text-red-600" role="alert">
                      {submitError}
                    </span>
                  ) : null}
                </div>
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "保存中..." : "変更を保存"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <Card className="h-fit">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Eye className="h-4 w-4" aria-hidden="true" />
              プレビュー
            </CardTitle>
            <CardDescription>受講者に見える表示を確認できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <ProblemPreview values={watch()} />
          </CardContent>
        </Card>
      </div>
    </div>
  )
}

function ProblemPreview({ values }: { values: ProblemFormValues }) {
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <Badge>{typeLabels[values.type]}</Badge>
        <span className="text-xs text-cream-700">Preview</span>
      </div>

      {values.tags && values.tags.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {values.tags.map((tag) => (
            <Badge key={tag} variant="secondary">
              {tag}
            </Badge>
          ))}
        </div>
      ) : null}

      <div>
        <h2 className="text-lg font-semibold">{values.title ? values.title : "タイトル未入力"}</h2>
        <p className="mt-2 text-sm text-cream-800">
          {values.prompt ? values.prompt : "問題文がまだ入力されていません。"}
        </p>
      </div>

      {values.type === "text" ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">回答欄</p>
          <div className="min-h-[120px] rounded-md border border-dashed border-gray-300 bg-cream-200 p-3 text-sm text-cream-700">
            記述式の回答を入力します。
          </div>
          {values.textAnswer ? (
            <p className="text-xs text-cream-700">模範解答: {values.textAnswer}</p>
          ) : null}
        </div>
      ) : (
        <div className="space-y-3">
          <p className="text-sm font-medium">選択肢</p>
          <ul className="space-y-2">
            {values.options.length === 0 ? (
              <li className="text-sm text-cream-700">選択肢がありません。</li>
            ) : (
              values.options.map((option, index) => (
                <li
                  key={`${option.label}-${index}`}
                  className="flex items-center gap-2 rounded-md border border-cream-300 bg-cream-50 px-3 py-2 text-sm"
                >
                  <span className="font-medium">{index + 1}.</span>
                  <span>{option.label || "未入力の選択肢"}</span>
                  {option.isCorrect ? (
                    <Badge variant="secondary" className="ml-auto">
                      正解
                    </Badge>
                  ) : null}
                </li>
              ))
            )}
          </ul>
        </div>
      )}

      {values.explanation ? (
        <div className="rounded-md border border-cream-300 bg-cream-200 p-3 text-xs text-cream-800">
          {values.explanation}
        </div>
      ) : null}
    </div>
  )
}

