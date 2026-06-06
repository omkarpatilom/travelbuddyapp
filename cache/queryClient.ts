import { QueryClient } from '@tanstack/react-query';
import { CACHE_TTL } from './cacheConfig';

const isTestEnv = typeof jest !== 'undefined' || process.env.NODE_ENV === 'test';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: CACHE_TTL.DEFAULT_STALE,
      gcTime: CACHE_TTL.DEFAULT_GC,
      // Disable retries in tests to allow immediate failures
      retry: isTestEnv ? false : 2,
      refetchOnWindowFocus: false,
      refetchOnReconnect: 'always',
    },
  },
});

// Periodic cache size management/pruning helper
// Ensures unused query memory is cleared regularly to maintain < 50MB memory footprint
export const pruneQueryCache = () => {
  const queryCache = queryClient.getQueryCache();
  const queries = queryCache.getAll();
  
  // Sort queries by last updated / popularity or simply remove inactive queries
  const inactiveQueries = queries.filter(query => !query.isActive());
  
  // Remove inactive queries to free memory
  inactiveQueries.forEach(query => {
    queryCache.remove(query);
  });
  
  console.log(`Pruned ${inactiveQueries.length} inactive queries from Query Cache.`);
};

// Prune cache every 10 minutes (disabled in tests to prevent open handle leaks)
if (typeof setInterval !== 'undefined' && !isTestEnv) {
  setInterval(pruneQueryCache, 10 * 60 * 1000);
}
