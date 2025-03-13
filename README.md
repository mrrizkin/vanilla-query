# VanillaQuery

A React Query-like data fetching and caching library for vanilla JavaScript/TypeScript applications.

## Features

- 📡 Async data fetching with automatic caching
- 🔄 Request deduplication and refetching
- ⚙️ Configurable retry logic
- 🪝 Rich lifecycle callbacks
- 🧠 Intelligent cache invalidation
- 🔄 Automatic refetching (on window focus, interval)
- 📝 TypeScript support
- 🔄 No dependencies

## Installation

```sh
npm install vanilla-query
```

or

```sh
pnpm add vanilla-query
```

## Basic Usage

```typescript
import { VanillaQuery } from 'vanilla-query'

// Create an instance
const queryClient = new VanillaQuery()

// Fetch and cache data
const usersQuery = queryClient.useQuery('users', async () => {
  const response = await fetch('https://api.example.com/users')
  return response.json()
})

// Subscribe to state changes
const unsubscribe = usersQuery.subscribe((state) => {
  if (state.isLoading) {
    console.log('Loading users...')
  } else if (state.isError) {
    console.error('Failed to load users:', state.error)
  } else if (state.isSuccess) {
    console.log('Users loaded:', state.data)
  }
})

// Manual refetch
button.addEventListener('click', () => {
  usersQuery.refetch()
})

// Cleanup subscription when done
// unsubscribe();
```

## API Reference

### `VanillaQuery` Class

The main class that provides all functionality.

```typescript
const queryClient = new VanillaQuery()
```

#### `useQuery(queryKey, queryFn, options)`

Creates a query instance for fetching and caching data.

- `queryKey`: Unique string identifier for the query
- `queryFn`: Async function that fetches the data
- `options`: Configuration options

```typescript
const query = queryClient.useQuery('users', fetchUsers, {
  staleTime: 60000,
  cacheTime: 300000,
  retry: 3,
})
```

#### `useMutation(mutationFn, options)`

Creates a mutation instance for updating data.

```typescript
const mutation = queryClient.useMutation(createUser, {
  onSuccess: (data) => {
    queryClient.invalidateQuery('users')
  },
})

// Use the mutation
mutation.mutate({ name: 'John Doe' })
```

#### Other Methods

- `prefetchQuery(queryKey, queryFn, options)`: Pre-fetch and cache data
- `getQueryData(queryKey)`: Get cached data directly
- `setQueryData(queryKey, data)`: Manually update cached data
- `removeQueryData(queryKey)`: Remove data from cache
- `clear()`: Clear all cached data and stop active queries

## Contributing

We welcome contributions! Please read our [Contributing Guide](CONTRIBUTING.md) before submitting pull requests.

## Code of Conduct

By participating in this project, you agree to abide by our [Code of Conduct](CODE_OF_CONDUCT.md).

## License

[MIT](LICENSE)
