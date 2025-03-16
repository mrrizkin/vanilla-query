/**
 * Alpine.js plugin for VanillaQuery
 * This plugin provides ways to use VanillaQuery in Alpine.js applications
 * with $query magic helper for programmatic use in Alpine components
 *
 * @param {VanillaQuery} client - An instance of the VanillaQuery client
 * @returns {Function} Alpine plugin installer function
 */
export default function (client) {
  return function (Alpine) {
    // Register a custom Alpine.js magic property '$query'
    Alpine.magic('query', () => {
      return {
        /**
         * Create and manage a query
         * @param {string} key - Unique identifier for the query
         * @param {Function} fetcher - Async function that fetches data
         * @param {Object} options - Configuration options
         * @returns {Object} Reactive query state and methods
         */
        get(key, fetcher, options = {}) {
          // Create the query
          const query = client.useQuery(key, fetcher, options)

          // Create a reactive Alpine.js store for the query state
          const queryStore = Alpine.reactive({
            // State properties
            data: query.state.data,
            error: query.state.error,
            status: query.state.status,
            isLoading: query.state.isLoading,
            isError: query.state.isError,
            isSuccess: query.state.isSuccess,
            isFetching: query.state.isFetching,

            // Additional helpful properties
            dataUpdatedAt: query.state.dataUpdatedAt || 0,
            errorUpdatedAt: query.state.errorUpdatedAt || 0,
            fetchCount: query.state.fetchCount || 0,

            // Methods
            refetch: () => query.refetch(),
            fetch: () => query.fetch(),
            invalidate: () => query.invalidate(),
          })

          // Subscribe to query updates and sync them to the Alpine store
          query.subscribe((state) => {
            // Update all state properties
            Object.entries(state).forEach(([key, value]) => {
              if (key in queryStore) {
                queryStore[key] = value
              }
            })
          })

          return queryStore
        },

        /**
         * Create and manage a mutation
         * @param {Function} mutationFn - Async function that performs the mutation
         * @param {Object} options - Configuration options
         * @returns {Object} Reactive mutation state and methods
         */
        mutation(mutationFn, options = {}) {
          const mutation = client.useMutation(mutationFn, options)

          // Create a reactive Alpine.js store for the mutation state
          const mutationStore = Alpine.reactive({
            // State properties
            data: mutation.state.data,
            error: mutation.state.error,
            status: mutation.state.status,
            isLoading: mutation.state.isLoading,
            isError: mutation.state.isError,
            isSuccess: mutation.state.isSuccess,
            isIdle: mutation.state.isIdle,

            // Methods
            mutate: (variables) => mutation.mutate(variables),
            reset: () => mutation.reset(),
          })

          // Subscribe to mutation updates and sync them to the Alpine store
          mutation.subscribe((state) => {
            // Update all state properties
            Object.entries(state).forEach(([key, value]) => {
              if (key in mutationStore) {
                mutationStore[key] = value
              }
            })
          })

          return mutationStore
        },

        // Helper methods that directly access client methods
        fetch: (key) => client.fetchQuery(key),
        refetch: (key) => client.refetchQuery(key),
        prefetch: (key, fetcher, options) =>
          client.prefetchQuery(key, fetcher, options),
        invalidate: (key) => client.invalidateQuery(key),
        cancel: (key) => client.cancelQuery(key),
        subscribe: (key, callback) => client.subscribeToQuery(key, callback),
        notifySubscribers: (key, state) => client.notifySubscribers(key, state),
        setQueryData: (key, data) => client.setQueryData(key, data),
        getQueryData: (key) => client.getQueryData(key),
        removeQueryData: (key) => client.removeQueryData(key),
        clear: () => client.clear(),

        // Get the current client instance
        client: () => client,
      }
    })
  }
}
