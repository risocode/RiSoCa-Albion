export type BlackMarketFetchNotice = {
  id: number
  kind: 'success' | 'error'
  message: string
}

export type BlackMarketFetchState = {
  isFetching: boolean
  isMinimized: boolean
  phaseText: string
  progressStep: number
  lastResultMessage: string
  error: string | null
  notice: BlackMarketFetchNotice | null
}

type Listener = () => void

const listeners = new Set<Listener>()

let noticeSeq = 0

let state: BlackMarketFetchState = {
  isFetching: false,
  isMinimized: false,
  phaseText: '',
  progressStep: 0,
  lastResultMessage: '',
  error: null,
  notice: null,
}

function emit() {
  for (const listener of listeners) listener()
}

function setState(patch: Partial<BlackMarketFetchState>) {
  state = { ...state, ...patch }
  emit()
}

export function subscribeBlackMarketFetchState(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export function getBlackMarketFetchState(): BlackMarketFetchState {
  return state
}

export function startBlackMarketFetch(phaseText: string) {
  setState({
    isFetching: true,
    isMinimized: false,
    phaseText,
    progressStep: 0,
    error: null,
  })
}

export function setBlackMarketFetchPhase(phaseText: string, progressStep?: number) {
  setState({
    phaseText,
    ...(typeof progressStep === 'number' ? { progressStep } : {}),
  })
}

export function minimizeBlackMarketFetch() {
  if (!state.isFetching) return
  setState({ isMinimized: true })
}

export function restoreBlackMarketFetch() {
  if (!state.isFetching) return
  setState({ isMinimized: false })
}

export function finishBlackMarketFetch(message: string) {
  noticeSeq += 1
  setState({
    isFetching: false,
    isMinimized: false,
    phaseText: '',
    progressStep: 4,
    lastResultMessage: message,
    error: null,
    notice: {
      id: noticeSeq,
      kind: 'success',
      message,
    },
  })
}

export function failBlackMarketFetch(message: string) {
  noticeSeq += 1
  setState({
    isFetching: false,
    isMinimized: false,
    phaseText: '',
    lastResultMessage: '',
    error: message,
    notice: {
      id: noticeSeq,
      kind: 'error',
      message,
    },
  })
}

export function clearBlackMarketFetchNotice() {
  if (!state.notice) return
  setState({ notice: null })
}
