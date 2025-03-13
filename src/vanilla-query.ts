/*
VanillaQuery: A React Query-like library for vanilla TypeScript/JavaScript

MIT License

Copyright (c) 2025 mrrizkin

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.
*/

export interface QueryOptions {
  enabled?: boolean
  staleTime?: number
  cacheTime?: number
  retry?: number | boolean
  retryDelay?: number | ((attempt: number) => number)
  onSuccess?: (data: any) => void
  onError?: (error: Error) => void
  onSettled?: (data: any | undefined, error: Error | null) => void
  refetchOnWindowFocus?: boolean
  refetchInterval?: number | false
  refetchIntervalInBackground?: boolean
  keepPreviousData?: boolean
}

export interface QueryState<T = any> {
  data: T | undefined
  error: Error | null
  status: 'idle' | 'loading' | 'success' | 'error'
  isLoading: boolean
  isError: boolean
  isSuccess: boolean
  isFetching: boolean
  dataUpdatedAt?: number
  errorUpdatedAt?: number
  fetchCount?: number
}

export interface QueryInstance<T> {
  state: QueryState<T>
  fetch: () => Promise<any>
  refetch: () => Promise<any>
  subscribe: (callback: (state: QueryState<T>) => void) => () => void
  cancel: () => void
  invalidate: () => Promise<any>
  getQueryState: (queryKey: string) => QueryState<T>
}

export interface CacheEntry {
  data: any
  timestamp: number
}

export interface QueryConfig {
  queryFn: () => Promise<any>
  options: Required<QueryOptions>
}

export interface MutationState {
  isIdle: boolean
  isLoading: boolean
  isSuccess: boolean
  isError: boolean
  data: any
  error: Error | null
  status: 'idle' | 'loading' | 'success' | 'error'
  reset: () => void
}

export interface MutationOptions<
  TData = any,
  TVariables = any,
  TContext = any,
> {
  onMutate?: (variables: TVariables) => Promise<TContext> | TContext
  onSuccess?: (
    data: TData | undefined,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  onError?: (
    error: Error,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  onSettled?: (
    data: TData | undefined,
    error: Error | null,
    variables: TVariables,
    context: TContext | undefined
  ) => Promise<void> | void
  retry?: number
  retryDelay?: number | ((attempt: number) => number)
}

export interface MutationInstance<TData = any, TVariables = any> {
  mutate: (variables: TVariables) => Promise<TData>
  reset: () => void
  subscribe: (callback: (state: MutationState) => void) => () => void
  state: MutationState
}

export class VanillaQuery {
  private cache: Map<string, CacheEntry>
  private subscribers: Map<string, Set<(state: QueryState) => void>>
  private queryConfigs: Map<string, QueryConfig>
  private queryStates: Map<string, QueryState>
  private intervals?: Map<string, NodeJS.Timeout>

  constructor() {
    this.cache = new Map()
    this.subscribers = new Map()
    this.queryConfigs = new Map()
    this.queryStates = new Map()
  }

  /**
   * Creates a query instance with React Query-like functionality
   * @param queryKey - Unique key for the query
   * @param queryFn - Async function that fetches data
   * @param options - Configuration options
   * @returns Query instance with state and methods
   */
  useQuery<T = unknown>(
    queryKey: string,
    queryFn: () => Promise<T>,
    options: QueryOptions = {}
  ): QueryInstance<T> {
    // Default options
    const defaultOptions: Required<QueryOptions> = {
      enabled: true,
      staleTime: 0,
      cacheTime: 5 * 60 * 1000, // 5 minutes
      retry: 3,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
      //@ts-ignore
      onSuccess: null,
      //@ts-ignore
      onError: null,
      //@ts-ignore
      onSettled: null,
      refetchOnWindowFocus: true,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      keepPreviousData: false,
    }

    const finalOptions = {
      ...defaultOptions,
      ...options,
    } as Required<QueryOptions>
    this.queryConfigs.set(queryKey, { queryFn, options: finalOptions })

    // Initialize query state if it doesn't exist
    if (!this.queryStates.has(queryKey)) {
      this.queryStates.set(queryKey, {
        data: undefined,
        error: null,
        status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
        isLoading: false,
        isError: false,
        isSuccess: false,
        isFetching: false,
        dataUpdatedAt: 0,
        errorUpdatedAt: 0,
        fetchCount: 0,
      })
    }

    // Create and return query instance
    const query: QueryInstance<T> = {
      // Get current state
      get state() {
        return this.getQueryState(queryKey)
      },

      // Fetch data
      fetch: async () => {
        return this.fetchQuery(queryKey)
      },

      // Refetch the query
      refetch: async () => {
        return this.refetchQuery(queryKey)
      },

      // Subscribe to state changes
      subscribe: (callback) => {
        return this.subscribeToQuery(queryKey, callback)
      },

      // Cancel ongoing requests
      cancel: () => {
        return this.cancelQuery(queryKey)
      },

      // Invalidate query to force refetch
      invalidate: () => {
        return this.invalidateQuery(queryKey)
      },

      // Get query state
      getQueryState: (queryKey: string) => {
        return this.getQueryState(queryKey)
      },
    }

    // Bind methods to this class
    query.fetch = query.fetch.bind(this)
    query.refetch = query.refetch.bind(this)
    query.subscribe = query.subscribe.bind(this)
    query.cancel = query.cancel.bind(this)
    query.invalidate = query.invalidate.bind(this)
    query.getQueryState = this.getQueryState.bind(this)

    // Auto-fetch if enabled
    if (finalOptions.enabled) {
      setTimeout(() => {
        this.fetchQuery(queryKey)
      }, 0)
    }

    // Set up window focus refetching
    if (finalOptions.refetchOnWindowFocus && typeof window !== 'undefined') {
      window.addEventListener('focus', () => {
        if (finalOptions.enabled) {
          this.fetchQuery(queryKey)
        }
      })
    }

    // Set up refetch interval if specified
    if (finalOptions.refetchInterval && finalOptions.enabled) {
      const intervalId = setInterval(() => {
        if (
          finalOptions.refetchIntervalInBackground ||
          (typeof document !== 'undefined' &&
            document.visibilityState === 'visible')
        ) {
          this.fetchQuery(queryKey)
        }
      }, finalOptions.refetchInterval)

      // Store interval ID for cleanup
      if (!this.intervals) this.intervals = new Map()
      this.intervals.set(queryKey, intervalId)
    }

    return query
  }

  /**
   * Gets the current state of a query
   * @param queryKey - Query key
   * @returns Current query state
   */
  getQueryState<T = unknown>(queryKey: string): QueryState<T> {
    return (
      this.queryStates.get(queryKey) || {
        data: undefined,
        error: null,
        status: 'idle',
        isLoading: false,
        isError: false,
        isSuccess: false,
        isFetching: false,
      }
    )
  }

  /**
   * Fetches data for a query
   * @param queryKey - Query key
   * @returns Promise that resolves with the fetched data
   */
  async fetchQuery<T = unknown>(queryKey: string): Promise<T | undefined> {
    const config = this.queryConfigs.get(queryKey)
    if (!config) return

    const { queryFn, options } = config
    const currentState = this.queryStates.get(queryKey)

    if (!currentState) return

    // Update state to loading
    const newState: QueryState<T> = {
      ...currentState,
      status: currentState?.data ? 'success' : 'loading',
      isLoading: !currentState?.data,
      isFetching: true,
      fetchCount: (currentState?.fetchCount || 0) + 1,
    }

    this.queryStates.set(queryKey, newState)
    this.notifySubscribers(queryKey, newState)

    // Perform fetch with retries
    let attempt = 0
    let data: any
    let error: Error

    const performFetch = async () => {
      try {
        data = await queryFn()
        return { success: true, data }
      } catch (err) {
        error = err as Error
        return { success: false, error }
      }
    }

    let result = await performFetch()

    const maxRetries =
      typeof options.retry === 'boolean'
        ? options.retry
          ? 3
          : 0
        : options.retry

    while (!result.success && attempt < maxRetries) {
      attempt++
      // Wait for retry delay
      await new Promise((resolve) =>
        setTimeout(
          resolve,
          typeof options.retryDelay === 'function'
            ? options.retryDelay(attempt)
            : options.retryDelay
        )
      )
      result = await performFetch()
    }

    // Update cache and state based on result
    if (result.success) {
      const successState: QueryState<T> = {
        data: result.data,
        error: null,
        status: 'success',
        isLoading: false,
        isError: false,
        isSuccess: true,
        isFetching: false,
        dataUpdatedAt: Date.now(),
      }

      this.cache.set(queryKey, {
        data: result.data,
        timestamp: Date.now(),
      })

      this.queryStates.set(queryKey, successState)
      this.notifySubscribers(queryKey, successState)

      if (options.onSuccess) {
        options.onSuccess(result.data)
      }

      if (options.onSettled) {
        options.onSettled(result.data, null)
      }

      return result.data
    } else {
      const errorState: QueryState<T> = {
        ...newState,
        status: 'error',
        error: result.error || null,
        isLoading: false,
        isError: true,
        isSuccess: false,
        isFetching: false,
        errorUpdatedAt: Date.now(),
      }

      this.queryStates.set(queryKey, errorState)
      this.notifySubscribers(queryKey, errorState)

      if (result.error) {
        if (options.onError) {
          options.onError(result.error)
        }

        if (options.onSettled) {
          options.onSettled(undefined, result.error)
        }
      }

      return
    }
  }

  /**
   * Forces a refetch of the query
   * @param queryKey - Query key
   * @returns Promise that resolves with the refetched data
   */
  async refetchQuery(queryKey: string): Promise<any> {
    return this.fetchQuery(queryKey)
  }

  /**
   * Subscribes to changes in query state
   * @param queryKey - Query key
   * @param callback - Function to call when state changes
   * @returns Unsubscribe function
   */
  subscribeToQuery<T = unknown>(
    queryKey: string,
    callback: (state: QueryState<T>) => void
  ): () => void {
    if (!this.subscribers.has(queryKey)) {
      this.subscribers.set(queryKey, new Set())
    }

    const subscribers = this.subscribers.get(queryKey)
    subscribers?.add(callback)

    // Call callback immediately with current state
    const currentState = this.getQueryState<T>(queryKey)
    callback(currentState)

    // Return unsubscribe function
    return () => {
      const subscribers = this.subscribers.get(queryKey)
      if (subscribers) {
        subscribers.delete(callback)
      }
    }
  }

  /**
   * Notifies all subscribers of state changes
   * @param queryKey - Query key
   * @param state - New state
   */
  notifySubscribers<T = unknown>(queryKey: string, state: QueryState<T>): void {
    const subscribers = this.subscribers.get(queryKey)
    if (subscribers) {
      subscribers.forEach((callback) => {
        try {
          callback(state)
        } catch (error) {
          console.error('Error in query subscriber callback:', error)
        }
      })
    }
  }

  /**
   * Cancels ongoing queries (placeholder - would need AbortController in real implementation)
   * @param queryKey - Query key
   */
  cancelQuery<T = unknown>(queryKey: string): void {
    // In a real implementation, you would use AbortController
    // This is a simplified version
    const state = this.queryStates.get(queryKey)
    if (state && state.isFetching) {
      const cancelledState: QueryState<T> = {
        ...state,
        isFetching: false,
      }
      this.queryStates.set(queryKey, cancelledState)
      this.notifySubscribers(queryKey, cancelledState)
    }
  }

  /**
   * Invalidates the query cache to force refetch
   * @param queryKey - Query key
   */
  invalidateQuery(queryKey: string): Promise<any> {
    this.cache.delete(queryKey)
    return this.fetchQuery(queryKey)
  }

  /**
   * Creates a mutation instance for data updates
   * @param mutationFn - Async function that performs the mutation
   * @param options - Configuration options
   * @returns Mutation instance with state and methods
   */
  useMutation<TData = any, TVariables = any, TContext = any>(
    mutationFn: (variables: TVariables) => Promise<TData>,
    options: MutationOptions<TData, TVariables, TContext> = {}
  ): MutationInstance<TData, TVariables> {
    const defaultOptions: Required<
      MutationOptions<TData, TVariables, TContext>
    > = {
      //@ts-ignore
      onMutate: null,
      //@ts-ignore
      onSuccess: null,
      //@ts-ignore
      onError: null,
      //@ts-ignore
      onSettled: null,
      retry: 0,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
    }

    const finalOptions = { ...defaultOptions, ...options } as Required<
      MutationOptions<TData, TVariables, TContext>
    >

    // Create mutation state
    const mutationState: MutationState = {
      isIdle: true,
      isLoading: false,
      isSuccess: false,
      isError: false,
      data: undefined,
      error: null,
      status: 'idle', // 'idle' | 'loading' | 'success' | 'error'
      //@ts-ignore
      reset: null, // Will be assigned below
    }

    // Create list of subscribers
    const subscribers = new Set<(state: MutationState) => void>()

    // Function to update state and notify subscribers
    const setState = (updates: Partial<MutationState>) => {
      Object.assign(mutationState, updates)
      subscribers.forEach((callback) => {
        try {
          callback({ ...mutationState })
        } catch (error) {
          console.error('Error in mutation subscriber callback:', error)
        }
      })
    }

    // Assign reset function
    mutationState.reset = () => {
      setState({
        isIdle: true,
        isLoading: false,
        isSuccess: false,
        isError: false,
        data: undefined,
        error: null,
        status: 'idle',
      })
    }

    // Create mutation function
    const mutate = async (variables: TVariables): Promise<TData> => {
      // Call onMutate if provided
      let context: TContext | undefined = undefined
      if (finalOptions.onMutate) {
        try {
          context = await finalOptions.onMutate(variables)
        } catch (error) {
          console.error('Error in onMutate:', error)
        }
      }

      // Update state to loading
      setState({
        isIdle: false,
        isLoading: true,
        status: 'loading',
      })

      // Perform mutation with retries
      let attempt = 0
      let data: TData
      let error: Error

      const performMutation = async () => {
        try {
          data = await mutationFn(variables)
          return { success: true, data }
        } catch (err) {
          error = err as Error
          return { success: false, error }
        }
      }

      let result = await performMutation()

      while (!result.success && attempt < finalOptions.retry) {
        attempt++
        // Wait for retry delay
        await new Promise((resolve) =>
          setTimeout(
            resolve,
            typeof finalOptions.retryDelay === 'function'
              ? finalOptions.retryDelay(attempt)
              : finalOptions.retryDelay
          )
        )
        result = await performMutation()
      }

      // Update state based on result
      if (result.success) {
        setState({
          isLoading: false,
          isSuccess: true,
          isError: false,
          data: result.data,
          error: null,
          status: 'success',
        })

        if (finalOptions.onSuccess) {
          await finalOptions.onSuccess(result.data, variables, context)
        }
      } else {
        setState({
          isLoading: false,
          isSuccess: false,
          isError: true,
          data: undefined,
          error: result.error,
          status: 'error',
        })

        if (finalOptions.onError) {
          if (result.error) {
            await finalOptions.onError(result.error, variables, context)
          }
        }
      }

      if (finalOptions.onSettled) {
        await finalOptions.onSettled(
          result.success ? result.data : undefined,
          result.success ? null : result.error || null,
          variables,
          context
        )
      }

      let resultData = result.data
      return result.success && resultData
        ? resultData
        : Promise.reject(result.error)
    }

    // Create subscribe function
    const subscribe = (callback: (state: MutationState) => void) => {
      subscribers.add(callback)

      // Call immediately with current state
      callback({ ...mutationState })

      // Return unsubscribe function
      return () => {
        subscribers.delete(callback)
      }
    }

    return {
      mutate,
      reset: mutationState.reset,
      subscribe,
      get state() {
        return { ...mutationState }
      },
    }
  }

  /**
   * Prefetches and caches data for a query
   * @param queryKey - Query key
   * @param queryFn - Async function that fetches data
   * @param options - Configuration options
   * @returns Promise that resolves with the fetched data
   */
  prefetchQuery(
    queryKey: string,
    queryFn: () => Promise<any>,
    options: QueryOptions = {}
  ): Promise<any> {
    const defaultOptions: Required<QueryOptions> = {
      enabled: true,
      staleTime: 0,
      cacheTime: 5 * 60 * 1000,
      retry: 3,
      retryDelay: (attempt: number) => Math.min(1000 * 2 ** attempt, 30000),
      //@ts-ignore
      onSuccess: null,
      //@ts-ignore
      onError: null,
      //@ts-ignore
      onSettled: null,
      refetchOnWindowFocus: true,
      refetchInterval: false,
      refetchIntervalInBackground: false,
      keepPreviousData: false,
    }

    const finalOptions = {
      ...defaultOptions,
      ...options,
    } as Required<QueryOptions>
    this.queryConfigs.set(queryKey, { queryFn, options: finalOptions })
    return this.fetchQuery(queryKey)
  }

  /**
   * Gets cached data for a query
   * @param queryKey - Query key
   * @returns Cached data or undefined
   */
  getQueryData(queryKey: string): any {
    const cached = this.cache.get(queryKey)
    return cached ? cached.data : undefined
  }

  /**
   * Sets data for a query manually
   * @param queryKey - Query key
   * @param data - Data to set
   */
  setQueryData<T = unknown>(queryKey: string, data: T): any {
    this.cache.set(queryKey, {
      data,
      timestamp: Date.now(),
    })

    const newState: QueryState<T> = {
      data,
      error: null,
      status: 'success',
      isLoading: false,
      isError: false,
      isSuccess: true,
      isFetching: false,
      dataUpdatedAt: Date.now(),
    }

    this.queryStates.set(queryKey, newState)
    this.notifySubscribers(queryKey, newState)

    return data
  }

  /**
   * Removes query data from cache
   * @param queryKey - Query key to remove
   */
  removeQueryData(queryKey: string): void {
    this.cache.delete(queryKey)

    // Also clean up related resources
    this.queryStates.delete(queryKey)
    this.queryConfigs.delete(queryKey)
    this.subscribers.delete(queryKey)

    if (this.intervals && this.intervals.has(queryKey)) {
      clearInterval(this.intervals.get(queryKey))
      this.intervals.delete(queryKey)
    }
  }

  /**
   * Clear the entire cache and stop all queries
   */
  clear(): void {
    this.cache.clear()
    this.queryStates.clear()
    this.queryConfigs.clear()

    // Clear all intervals
    if (this.intervals) {
      this.intervals.forEach((intervalId) => {
        clearInterval(intervalId)
      })
      this.intervals.clear()
    }

    // Notify all subscribers of reset
    this.subscribers.forEach((subscribers, _) => {
      const resetState: QueryState = {
        data: undefined,
        error: null,
        status: 'idle',
        isLoading: false,
        isError: false,
        isSuccess: false,
        isFetching: false,
      }

      subscribers.forEach((callback) => {
        try {
          callback(resetState)
        } catch (error) {
          console.error(
            'Error in query subscriber callback during clear:',
            error
          )
        }
      })
    })

    this.subscribers.clear()
  }
}

// Default export for easier imports
export default VanillaQuery
