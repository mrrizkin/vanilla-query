import { VanillaQuery } from '../vanilla-query'

describe('VanillaQuery', () => {
  let queryClient: VanillaQuery

  beforeEach(() => {
    queryClient = new VanillaQuery()
    jest.useFakeTimers()
  })

  afterEach(() => {
    queryClient.clear()
    jest.clearAllMocks()
    jest.useRealTimers()
  })

  test('should fetch data successfully', async () => {
    const mockFetch = jest.fn().mockResolvedValue('mocked data')
    const query = queryClient.useQuery('testQuery', mockFetch)

    await jest.runAllTimersAsync()

    expect(query.state.isSuccess).toBe(true)
    expect(query.state.data).toBe('mocked data')
  })

  test('should handle fetch error', async () => {
    const error = 'Fetch failed'
    const mockFetch = jest.fn().mockRejectedValue(error)
    const query = queryClient.useQuery('errorQuery', mockFetch)

    await jest.runAllTimersAsync()

    expect(query.state.isError).toBe(true)
    expect(query.state.error).toEqual(error)
  })

  test('should cache data', async () => {
    const mockFetch = jest.fn().mockResolvedValue('cached data')
    queryClient.useQuery('cacheQuery', mockFetch)

    await jest.runAllTimersAsync()

    expect(queryClient.getQueryData('cacheQuery')).toBe('cached data')
  })

  test('should refetch data on demand', async () => {
    const mockFetch = jest
      .fn()
      .mockResolvedValueOnce('first fetch')
      .mockResolvedValueOnce('second fetch')

    const query = queryClient.useQuery('refetchQuery', mockFetch)

    await jest.runAllTimersAsync()
    expect(query.state.data).toBe('first fetch')

    await query.refetch()
    expect(query.state.data).toBe('second fetch')
  })

  test('should subscribe to query state changes', async () => {
    const mockFetch = jest.fn().mockResolvedValue('subscribed data')
    const query = queryClient.useQuery('subscribeQuery', mockFetch)

    const subscriber = jest.fn()
    query.subscribe(subscriber)

    await jest.runAllTimersAsync()

    expect(subscriber).toHaveBeenCalledWith(
      expect.objectContaining({
        isLoading: false,
        isSuccess: true,
        data: 'subscribed data',
      })
    )
  })
})
