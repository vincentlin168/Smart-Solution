'use client'

import { useState } from 'react'
import { Settings2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { useAiConfigSafe, type AiConfig } from './ai-config-context'

interface AiSettingsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function AiSettingsDialog({ open, onOpenChange }: AiSettingsDialogProps) {
  const context = useAiConfigSafe()
  if (!context) return null // Guard against missing provider

  const { config, setConfig } = context
  const [formData, setFormData] = useState<AiConfig>(config)

  const handleSave = () => {
    setConfig(formData)
    onOpenChange(false)
  }

  const handleOpenChange = (isOpen: boolean) => {
    if (!isOpen) {
      setFormData(config) // Reset on close
    }
    onOpenChange(isOpen)
  }

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/20"
        onClick={() => handleOpenChange(false)}
        aria-hidden
      />

      {/* Dialog */}
      <div className="relative z-50 w-full max-w-md rounded-lg border bg-card p-6 shadow-lg">
        <div className="mb-4 flex items-center gap-2">
          <Settings2 className="size-5" />
          <h2 className="text-lg font-semibold">AI 模型配置</h2>
        </div>

        <div className="space-y-4">
          {/* Provider Selection */}
          <div>
            <label className="mb-2 block text-sm font-medium">模型提供商</label>
            <div className="flex gap-2">
              {(['openai', 'deepseek'] as const).map((provider) => (
                <button
                  key={provider}
                  type="button"
                  onClick={() => setFormData({ ...formData, provider })}
                  className={cn(
                    'flex-1 rounded-md border px-3 py-2 text-sm font-medium transition-colors',
                    formData.provider === provider
                      ? 'border-primary bg-primary text-primary-foreground'
                      : 'border-border hover:border-primary/50',
                  )}
                >
                  {provider === 'openai' ? 'OpenAI' : 'DeepSeek'}
                </button>
              ))}
            </div>
          </div>

          {/* API Key */}
          <div>
            <label htmlFor="api-key" className="mb-2 block text-sm font-medium">
              API Key
            </label>
            <Input
              id="api-key"
              type="password"
              placeholder="sk-... 或 sk_..."
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              {formData.provider === 'openai' ? '获取地址：' : '获取地址：'}
              <a
                href={
                  formData.provider === 'openai'
                    ? 'https://platform.openai.com/api-keys'
                    : 'https://platform.deepseek.com/api_keys'
                }
                target="_blank"
                rel="noopener noreferrer"
                className="text-primary hover:underline"
              >
                {formData.provider === 'openai' ? 'OpenAI Platform' : 'DeepSeek Platform'}
              </a>
            </p>
          </div>

          {/* Model */}
          <div>
            <label htmlFor="model" className="mb-2 block text-sm font-medium">
              模型名称 (可选)
            </label>
            <Input
              id="model"
              placeholder={formData.provider === 'openai' ? 'gpt-4o-mini' : 'deepseek-chat'}
              value={formData.model}
              onChange={(e) => setFormData({ ...formData, model: e.target.value })}
              className="font-mono text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              使用中转网关时，需填写网关已开通的模型名，否则会报 no_upstream_route
            </p>
          </div>

          {/* Custom Endpoint (Optional) */}
          <div>
            <label htmlFor="endpoint" className="mb-2 block text-sm font-medium">
              自定义端点 (可选)
            </label>
            <Input
              id="endpoint"
              type="url"
              placeholder="https://api.openai.com/v1"
              value={formData.endpoint}
              onChange={(e) => setFormData({ ...formData, endpoint: e.target.value })}
              className="text-xs"
            />
            <p className="mt-1 text-xs text-muted-foreground">
              留空使用默认端点；用于兼容 OpenAI API 的服务（如 Ollama、LM Studio）
            </p>
          </div>

          {/* Help Text */}
          <div className="rounded-md bg-accent/30 p-3 text-xs text-muted-foreground">
            <p className="mb-1 font-medium">💡 说明</p>
            <ul className="space-y-1">
              <li>• API Key 保存在浏览器本地，不会上传到服务器</li>
              <li>• 用于生成图形、补充素材等 AI 推理功能</li>
              <li>• 支持 OpenAI GPT-4o 和 DeepSeek V3 等模型</li>
            </ul>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex gap-2 justify-end">
          <Button
            variant="outline"
            onClick={() => handleOpenChange(false)}
          >
            取消
          </Button>
          <Button
            onClick={handleSave}
            disabled={!formData.apiKey.trim()}
          >
            保存配置
          </Button>
        </div>
      </div>
    </div>
  )
}
