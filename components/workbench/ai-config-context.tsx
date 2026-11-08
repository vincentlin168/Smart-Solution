'use client'

import { createContext, useContext, useState, ReactNode, useEffect } from 'react'

export interface AiConfig {
  apiKey: string
  provider: 'openai' | 'deepseek'
  endpoint: string
  model: string
}

interface AiConfigContextValue {
  config: AiConfig
  setConfig: (config: AiConfig) => void
  hasApiKey: boolean
}

const AiConfigContext = createContext<AiConfigContextValue | undefined>(undefined)

const STORAGE_KEY = 'workbench:ai-config'

export function AiConfigProvider({ children }: { children: ReactNode }) {
  const [config, setConfigState] = useState<AiConfig>({
    apiKey: '',
    provider: 'openai',
    endpoint: '',
    model: '',
  })
  const [mounted, setMounted] = useState(false)

  // Load from localStorage on mount
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setConfigState((prev) => ({ ...prev, ...parsed }))
      } catch (e) {
        console.error('Failed to parse stored AI config:', e)
      }
    }
    setMounted(true)
  }, [])

  const setConfig = (newConfig: AiConfig) => {
    setConfigState(newConfig)
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(newConfig))
    } catch (e) {
      console.error('Failed to save AI config:', e)
    }
  }

  if (!mounted) {
    return <>{children}</>
  }

  return (
    <AiConfigContext.Provider value={{ config, setConfig, hasApiKey: !!config.apiKey }}>
      {children}
    </AiConfigContext.Provider>
  )
}

export function useAiConfig() {
  const context = useContext(AiConfigContext)
  if (!context) {
    throw new Error('useAiConfig must be used within AiConfigProvider')
  }
  return context
}

export function useAiConfigSafe() {
  return useContext(AiConfigContext)
}
