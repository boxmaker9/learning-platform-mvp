"use client"

import { useEffect, useMemo, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { Controller, useFieldArray, useForm } from "react-hook-form"
import { Eye, Plus, Trash2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
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

const baseDefaultValues: ProblemFormValues = {
  groupId: "",
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

export default function GroupProblemForm({
  tenant,
  groupId,
  groupTitle,
}: {
  tenant: string
  groupId: string
  groupTitle?: string
}) {
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [queue, setQueue] = useState<ProblemFormValues[]>([])
  const [queueError, setQueueError] = useState<string | null>(null)
  const [isQueueSaving, setIsQueueSaving] = useState(false)

  const defaultValues = useMemo(
    () => ({
      ...baseDefaultValues,
      groupId,
    }),
    [groupId]
  )

  const {
    control,
    register,
    handleSubmit,
    reset,
    setValue,
    getValues,
    trigger,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<ProblemFormValues>({
    resolver: zodResolver(problemSchema),
    defaultValues,
    mode: "onBlur",
  })

  useEffect(() => {
    setValue("groupId", groupId, { shouldValidate: true })
  }, [groupId, setValue])

  const { fields, append, remove, replace } = useFieldArray({
    control,
    name: "options",
  })

  const type = watch("type")
  const options = watch("options")

  useEffect(() => {
    if (type === "text") {
      if (fields.length > 0) replace([])
      return
    }
    if (fields.length === 0) {
      replace([
        { label: "", isCorrect: true },
        { label: "", isCorrect: false },
      ])
    }
  }, [type, fields.length, replace])

  const correctIndex = useMemo(() => {
    if (!options || options.length === 0) return ""
    const index = options.findIndex((option) => option.isCorrect)
    return index >= 0 ? String(index) : ""
  }, [options])

  const handleSingleChoiceSelect = (value: string) => {
    const index = Number(value)
    options.forEach((_, optionIndex) => {
      setValue(`options.${optionIndex}.isCorrect`, optionIndex === index, {
        shouldValidate: true,
      })
    })
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

  const saveOne = async (values: ProblemFormValues) => {
    setSubmitError(null)
    setSubmitSuccess(false)

    try {
      const response = await fetch(`/api/tenants/${tenant}/problems`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const payload = (await response.json()) as { message?: string; detail?: string }
        throw new Error(payload.detail ?? payload.message ?? "保存に失敗しました。")
      }

      reset(defaultValues)
      setSubmitSuccess(true)
    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : "通信エラーが発生しました。")
    }
  }

  const onSubmit = handleSubmit(saveOne)

  const addToQueue = async () => {
    setQueueError(null)
    setSubmitSuccess(false)
    const ok = await trigger()
    if (!ok) {
      setQueueError("入力内容を確認してください。")
      return
    }
    const values = getValues()
    setQueue((prev) => [...prev, values])
    reset(defaultValues)
  }

  const saveQueue = async () => {
    if (queue.length === 0) return
    setQueueError(null)
    setSubmitError(null)
    setSubmitSuccess(false)
    setIsQueueSaving(true)
    try {
      for (const values of queue) {
        // eslint-disable-next-line no-await-in-loop
        await saveOne(values)
      }
      setQueue([])
      setSubmitSuccess(true)
    } catch (e) {
      setQueueError(e instanceof Error ? e.message : "保存に失敗しました。")
    } finally {
      setIsQueueSaving(false)
    }
  }

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <Card>
        <CardHeader>
          <CardTitle>小問を作成</CardTitle>
          <CardDescription>
            {groupTitle ? `「${groupTitle}」に小問を追加します。` : "選択した大問に小問を追加します。"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form className="space-y-6" onSubmit={onSubmit} aria-busy={isSubmitting}>
            <div className="space-y-2">
              <Label htmlFor="groupId">大問ID</Label>
              <Input id="groupId" value={groupId} readOnly />
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">タイトル</Label>
              <Input id="title" placeholder="例: 問1" {...register("title")} />
              {errors.title ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.title.message}
                </p>
              ) : null}
            </div>

            <div className="space-y-2">
              <Label htmlFor="prompt">問題文</Label>
              <Textarea
                id="prompt"
                placeholder="受講者に提示する問題文を入力してください。"
                {...register("prompt")}
              />
              {errors.prompt ? (
                <p className="text-sm text-red-600" role="alert">
                  {errors.prompt.message}
                </p>
              ) : null}
            </div>

            <fieldset className="space-y-3" aria-describedby="type-help">
              <legend className="text-sm font-medium">問題タイプ</legend>
              <p id="type-help" className="text-xs text-slate-500">
                作成する問題形式を選択してください。
              </p>
              <RadioGroup
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
                    className="flex items-center gap-2 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
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
                <Textarea
                  id="textAnswer"
                  placeholder="記述式の回答例を入力してください。"
                  {...register("textAnswer")}
                />
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
                    <p className="text-xs text-slate-500">
                      正解を設定しながら選択肢を追加してください。
                    </p>
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
                  <RadioGroup
                    value={correctIndex}
                    onValueChange={handleSingleChoiceSelect}
                    className="space-y-3"
                  >
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3"
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

                        <label className="flex items-center gap-2 text-sm text-slate-600">
                          <RadioGroupItem value={String(index)} />
                          正解に設定
                        </label>

                        {errors.options?.[index]?.label ? (
                          <p className="text-xs text-red-600" role="alert">
                            {errors.options[index]?.label?.message}
                          </p>
                        ) : null}
                      </div>
                    ))}
                  </RadioGroup>
                ) : (
                  <div className="space-y-3">
                    {fields.map((field, index) => (
                      <div
                        key={field.id}
                        className="flex flex-col gap-2 rounded-md border border-gray-200 bg-white p-3"
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
                            <label className="flex items-center gap-2 text-sm text-slate-600">
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
              <Textarea
                id="explanation"
                placeholder="正解の解説や補足を入力してください。"
                {...register("explanation")}
              />
            </div>

            <Separator />

            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm text-slate-500">
                {submitSuccess ? (
                  <span className="text-emerald-600">保存が完了しました。</span>
                ) : null}
                {submitError ? (
                  <span className="text-red-600" role="alert">
                    {submitError}
                  </span>
                ) : null}
                {queueError ? (
                  <span className="text-red-600" role="alert">
                    {queueError}
                  </span>
                ) : null}
              </div>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={addToQueue}
                  disabled={isSubmitting || isQueueSaving}
                >
                  <Plus className="h-4 w-4" aria-hidden="true" />
                  小問を追加
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  onClick={saveQueue}
                  disabled={queue.length === 0 || isSubmitting || isQueueSaving}
                >
                  {isQueueSaving ? "保存中..." : `まとめて保存 (${queue.length})`}
                </Button>
                <Button type="submit" disabled={isSubmitting || isQueueSaving}>
                  {isSubmitting ? "保存中..." : "この小問を保存"}
                </Button>
              </div>
            </div>
          </form>
        </CardContent>
      </Card>

      {queue.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>追加予定の小問</CardTitle>
            <CardDescription>「まとめて保存」で一括作成できます。</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {queue.map((q, idx) => (
                <div
                  key={`${q.title}-${idx}`}
                  className="flex items-center justify-between gap-3 rounded-md border border-gray-200 bg-white px-3 py-2 text-sm"
                >
                  <div className="min-w-0">
                    <p className="truncate font-medium">{q.title}</p>
                    <p className="text-xs text-slate-500">{typeLabels[q.type]}</p>
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    className="shrink-0 text-red-600 hover:text-red-700"
                    onClick={() =>
                      setQueue((prev) => prev.filter((_, pIdx) => pIdx !== idx))
                    }
                    aria-label="小問を削除"
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      ) : null}

      <Card className="h-fit">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <Eye className="h-4 w-4" aria-hidden="true" />
            プレビュー
          </CardTitle>
          <CardDescription>受講者に見える表示を確認できます。</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <Badge>{typeLabels[watch("type")]}</Badge>
              <span className="text-xs text-slate-500">Preview</span>
            </div>
            <div>
              <h2 className="text-lg font-semibold">
                {watch("title") ? watch("title") : "タイトル未入力"}
              </h2>
              <p className="mt-2 text-sm text-slate-600">
                {watch("prompt") ? watch("prompt") : "問題文がまだ入力されていません。"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}

