import { useEffect, useMemo, useRef, useState } from "react"
import { useChat } from "@ai-sdk/react"
import { PlusIcon } from "lucide-react"
import { Button } from "@workspace/ui/components/button"
import type { ProviderModelRuntimeConfig } from "../lib/app-settings"
import { ChatTranscript } from "./playground/chat-ui"
import { PlaygroundComposer } from "./playground/composer"
import { PlaygroundModelPicker } from "./playground/model-picker"
import type { PlaygroundUIMessage } from "./playground/types"
import type { ComposerAttachment } from "./playground/utils"
import {
  buildUserMessageParts,
  cloneMessageParts,
  createComposerAttachments,
  createPlaygroundTransport,
  getErrorMessage,
  isRunningStatus,
  releaseComposerAttachments,
  uploadComposerAttachments,
} from "./playground/utils"

type ClusterThread = {
  id: string
  title: string
  modelKey: string
}

type ClusterChatProps = {
  projectId: string
  modelOptions: ProviderModelRuntimeConfig[]
  defaultModelKey: string
}

type BroadcastSubmission = {
  id: string
  parts: PlaygroundUIMessage["parts"]
}

const nextId = () => Math.random().toString(36).slice(2)

function createThread(modelKey: string, index: number): ClusterThread {
  return {
    id: nextId(),
    title: `Cluster ${index}`,
    modelKey,
  }
}

function ClusterThreadPanel({
  thread,
  projectId,
  modelOptions,
  submission,
  onModelKeyChange,
  onRunningChange,
}: {
  thread: ClusterThread
  projectId: string
  modelOptions: ProviderModelRuntimeConfig[]
  submission: BroadcastSubmission | null
  onModelKeyChange: (threadId: string, modelKey: string) => void
  onRunningChange: (threadId: string, running: boolean) => void
}) {
  const modelOptionMap = useMemo(
    () => new Map(modelOptions.map((option) => [option.key, option])),
    [modelOptions]
  )
  const config = modelOptionMap.get(thread.modelKey) || null
  const transport = useMemo(
    () =>
      createPlaygroundTransport({
        providerId: config?.providerId || "",
        modelId: config?.modelId || "",
        projectId,
      }),
    [config?.modelId, config?.providerId, projectId]
  )
  const chat = useChat<PlaygroundUIMessage>({ transport })
  const lastSubmissionIdRef = useRef("")
  const running = isRunningStatus(chat.status)

  useEffect(() => {
    onRunningChange(thread.id, running)
  }, [onRunningChange, running, thread.id])

  useEffect(() => {
    if (!submission || lastSubmissionIdRef.current === submission.id || !config) {
      return
    }

    lastSubmissionIdRef.current = submission.id
    void chat.sendMessage({
      parts: cloneMessageParts(submission.parts),
    })
  }, [chat, config, submission])

  return (
    <section className="flex min-h-0 flex-col rounded-[28px] border border-[#3a3935] bg-[#1b1b19]/88 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.18)]">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-[0.72rem] uppercase tracking-[0.16em] text-[#87867f]">
            <span>{thread.title}</span>
            <span className="h-px w-8 bg-[#3a3935]" />
            <span>{running ? "Streaming" : "Ready"}</span>
          </div>
          <h3 className="font-heading text-[1.2rem] leading-[1.15] text-[#faf9f5]">
            {config ? config.modelLabel : "Select a model"}
          </h3>
          <p className="text-sm text-[#b0aea5]">
            {config
              ? `${config.providerLabel} / ${config.modelId}`
              : "Choose a runtime model for this cluster."}
          </p>
        </div>

        <div className="min-w-[14rem]">
          <PlaygroundModelPicker
            modelOptions={modelOptions}
            selectedModelKey={thread.modelKey}
            selectedModel={config}
            onSelectModelKey={(value) => onModelKeyChange(thread.id, value)}
            className="w-full border-[#3a3935] bg-[#141413] text-[#faf9f5] hover:bg-[#1e1e1c]"
          />
        </div>
      </div>

      <div className="mt-4 min-h-0 flex-1 rounded-[22px] border border-[#30302e] bg-[#141413]/72">
        <ChatTranscript
          messages={chat.messages}
          status={chat.status}
          error={chat.error}
          emptyState="This cluster has not received a broadcast yet."
          contentClassName="pb-6"
          emptyClassName="text-[#b0aea5]"
          onRegenerate={
            config && chat.messages.length > 0
              ? () => void chat.regenerate()
              : undefined
          }
        />
      </div>
    </section>
  )
}

export function ClusterChat({
  projectId,
  modelOptions,
  defaultModelKey,
}: ClusterChatProps) {
  const [input, setInput] = useState("")
  const [attachments, setAttachments] = useState<ComposerAttachment[]>([])
  const [threads, setThreads] = useState<ClusterThread[]>([
    createThread(defaultModelKey, 1),
  ])
  const [threadRunning, setThreadRunning] = useState<Record<string, boolean>>({})
  const [submission, setSubmission] = useState<BroadcastSubmission | null>(null)
  const [composerError, setComposerError] = useState("")
  const attachmentsRef = useRef(attachments)

  const running = useMemo(
    () => Object.values(threadRunning).some(Boolean),
    [threadRunning]
  )

  useEffect(() => {
    attachmentsRef.current = attachments
  }, [attachments])

  useEffect(
    () => () => {
      releaseComposerAttachments(attachmentsRef.current)
    },
    []
  )

  useEffect(() => {
    if (modelOptions.length === 0) {
      setThreads((current) =>
        current.map((thread) => ({
          ...thread,
          modelKey: "",
        }))
      )
      return
    }

    setThreads((current) =>
      current.map((thread, index) => ({
        ...thread,
        modelKey: modelOptions.some((option) => option.key === thread.modelKey)
          ? thread.modelKey
          : current.length === 1 && index === 0 && defaultModelKey
            ? defaultModelKey
            : modelOptions[0]?.key || "",
      }))
    )
  }, [defaultModelKey, modelOptions])

  function removeAttachment(attachmentId: string) {
    setAttachments((current) => {
      const removed = current.find((attachment) => attachment.id === attachmentId)
      if (removed) {
        releaseComposerAttachments([removed])
      }

      return current.filter((attachment) => attachment.id !== attachmentId)
    })
  }

  function clearComposerState() {
    setInput("")
    setComposerError("")
    setAttachments((current) => {
      releaseComposerAttachments(current)
      return []
    })
  }

  async function handleAddFiles(fileList: FileList | File[]) {
    try {
      const nextAttachments = await createComposerAttachments(fileList)
      setComposerError("")
      setAttachments((current) => [...current, ...nextAttachments])
    } catch (error) {
      setComposerError(getErrorMessage(error))
    }
  }

  async function handleBroadcast({
    text,
    attachments: nextAttachments,
  }: {
    text: string
    attachments: ComposerAttachment[]
  }) {
    if (running || modelOptions.length === 0) {
      return
    }

    try {
      const uploads = await uploadComposerAttachments(nextAttachments)
      const parts = buildUserMessageParts(text, uploads)

      if (parts.length === 0) {
        return
      }

      setComposerError("")
      setSubmission({
        id: nextId(),
        parts,
      })
      clearComposerState()
    } catch (error) {
      setComposerError(getErrorMessage(error))
    }
  }

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <h2 className="font-heading text-[1.35rem] text-[#faf9f5]">
            Cluster Test
          </h2>
          <p className="text-sm text-[#b0aea5]">
            Broadcast one prompt and one attachment set across multiple model threads.
          </p>
        </div>

        <Button
          variant="outline"
          className="border-[#3a3935] bg-[#1b1b19] text-[#faf9f5] hover:bg-[#252522]"
          onClick={() =>
            setThreads((current) => [
              ...current,
              createThread(
                defaultModelKey || modelOptions[0]?.key || "",
                current.length + 1
              ),
            ])
          }
          disabled={modelOptions.length === 0}
        >
          <PlusIcon data-icon="inline-start" />
          Add Cluster
        </Button>
      </div>

      {composerError ? (
        <div className="rounded-[22px] border border-[#5b382d] bg-[#2d211d] px-4 py-3 text-sm text-[#f2c7b9]">
          {composerError}
        </div>
      ) : null}

      <div className="grid min-h-0 flex-1 gap-4 lg:grid-cols-2">
        {threads.map((thread) => (
          <ClusterThreadPanel
            key={thread.id}
            thread={thread}
            projectId={projectId}
            modelOptions={modelOptions}
            submission={submission}
            onModelKeyChange={(threadId, modelKey) =>
              setThreads((current) =>
                current.map((item) =>
                  item.id === threadId ? { ...item, modelKey } : item
                )
              )
            }
            onRunningChange={(threadId, nextRunning) =>
              setThreadRunning((current) => ({
                ...current,
                [threadId]: nextRunning,
              }))
            }
          />
        ))}
      </div>

      <div className="rounded-[30px] border border-[#3a3935] bg-[#171715]/92 p-4 shadow-[0_24px_80px_rgba(0,0,0,0.2)]">
        <PlaygroundComposer
          value={input}
          attachments={attachments}
          status={running ? "streaming" : "ready"}
          disabled={modelOptions.length === 0}
          placeholder="Broadcast a prompt and shared attachments to every cluster"
          hint="Attachments are uploaded once, then the resulting upload references are fanned out to every thread."
          onValueChange={setInput}
          onAddFiles={handleAddFiles}
          onRemoveAttachment={removeAttachment}
          onReset={clearComposerState}
          onSubmit={handleBroadcast}
          onError={setComposerError}
        />
      </div>
    </div>
  )
}
