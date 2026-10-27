// Compatibility exports for existing adapter tests and private developer tools.
// App features use services.js instead of depending on a provider implementation.
export {
  SupabaseClient as CloudClient,
  validateConfig,
} from './providers/supabase.js?v=ce2cc5d7358f';
export { CloudError } from './errors.js?v=ce2cc5d7358f';
export { takeSignInReturn } from './sign-in-return.js?v=ce2cc5d7358f';
