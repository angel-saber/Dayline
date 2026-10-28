// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=dc42e2a6f2c9';
export { CloudError } from './errors.js?v=dc42e2a6f2c9';
export { takeSignInReturn } from './sign-in-return.js?v=dc42e2a6f2c9';
